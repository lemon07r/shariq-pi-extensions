import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTaskPrompt, forkConversation, parseForkTurns } from "./src/context.ts";
import { loadConfigDocument, loadSubagentConfig, resolveProfile, saveConfigDocument, type SubagentConfig } from "./src/config.ts";
import { SUBAGENT_SPAWN_PROMPT_GUIDELINES, WORKTREE_ISOLATION_DESCRIPTION } from "./src/prompt.ts";
import { allocateSubagentId } from "./src/catalog.ts";
import { capabilityGuardExtension, filterToolsForCapability } from "./src/backends/pi.ts";

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const user = (text: string) => ({ role: "user" as const, content: [{ type: "text" as const, text }], timestamp: 1 });
const assistant = (text: string) => ({
  role: "assistant" as const,
  content: [
    { type: "thinking" as const, thinking: "private" },
    { type: "text" as const, text },
    { type: "toolCall" as const, id: "call", name: "read", arguments: {} },
  ],
  api: "test" as const,
  provider: "test",
  model: "test",
  usage,
  stopReason: "toolUse" as const,
  timestamp: 2,
});

test("persistent ids preserve the legacy sa-N shape without collisions", () => {
  const first = allocateSubagentId();
  const second = allocateSubagentId();
  assert.match(first, /^sa-\d+$/);
  assert.notEqual(first, second);
});

test("subagent guidance defaults to shared workspace and reserves isolation for real interference", () => {
  const guidance = SUBAGENT_SPAWN_PROMPT_GUIDELINES.join(" ");
  assert.match(guidance, /Keep isolation none unless concurrent writers would overlap/);
  assert.match(WORKTREE_ISOLATION_DESCRIPTION, /^Default none/);
  assert.match(WORKTREE_ISOLATION_DESCRIPTION, /clean source checkout/);
});

test("profile instructions and the assigned task have explicit prompt boundaries", () => {
  assert.equal(
    buildTaskPrompt("Inspect auth.", "Do not edit.", "careful"),
    '<subagent_instructions>\nProfile instructions with persona "careful":\nDo not edit.\n</subagent_instructions>\n\nTask:\nInspect auth.',
  );
});

test("fork_turns accepts none, all, and positive counts", () => {
  assert.equal(parseForkTurns(undefined), "none");
  assert.equal(parseForkTurns("all"), "all");
  assert.equal(parseForkTurns("2"), 2);
  assert.throws(() => parseForkTurns("0"), /fork_turns/);
});

test("context forks keep selected conversation but remove tool protocol and thinking", () => {
  const messages = [user("one"), assistant("answer one"), user("two"), assistant("answer two")];
  const forked = forkConversation(messages, 1);
  assert.deepEqual(forked.map((message) => message.role), ["user", "assistant"]);
  assert.ok(forked[0]?.role === "user");
  assert.deepEqual(forked[0].content, [{ type: "text", text: "two" }]);
  const final = forked[1];
  assert.ok(final?.role === "assistant");
  assert.deepEqual(final.content, [{ type: "text", text: "answer two" }]);
  assert.equal(final.stopReason, "stop");
});

test("configuration editor validates and saves trusted project documents", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-subagent-config-test-"));
  try {
    const text = JSON.stringify({ maxConcurrent: 7, profiles: { reviewer: { capability: "execute" } }, personas: {} });
    saveConfigDocument("project", cwd, text);
    assert.equal(JSON.parse(loadConfigDocument("project", cwd)).maxConcurrent, 7);
    assert.throws(
      () => saveConfigDocument("project", cwd, '{"maxConcurrent":99}'),
      /1 to 50/,
    );
    assert.throws(
      () => saveConfigDocument("project", cwd, '{"profiles":{"bad":{"capability":"root"}}}'),
      /capability must be one of/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("partial profile overrides keep the built-in capability and instructions", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-subagent-config-test-"));
  const agentDir = mkdtempSync(join(tmpdir(), "pi-subagent-agent-dir-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    saveConfigDocument("global", cwd, JSON.stringify({ profiles: { explore: { model: "global/model" } } }));
    saveConfigDocument("project", cwd, JSON.stringify({ profiles: { explore: { description: "Project explorer" } } }));
    const explore = loadSubagentConfig(cwd, true).profiles.explore;
    assert.equal(explore?.capability, "execute");
    assert.equal(explore?.model, "global/model");
    assert.equal(explore?.description, "Project explorer");
    assert.match(explore?.instructions ?? "", /Do not modify files/);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(cwd, { recursive: true, force: true });
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("restrictive capabilities fail closed for extension execution tools", () => {
  const inventory = [
    "read",
    "write",
    "edit",
    "bash",
    "web_fetch",
    "task_list",
    "start_terminal",
    "write_terminal",
    "unclassified_extension_tool",
    "unknown_project_tool",
    "message_parent",
  ];
  assert.deepEqual(
    filterToolsForCapability(inventory, "read-only"),
    ["read", "web_fetch", "task_list", "message_parent"],
  );
  assert.deepEqual(
    filterToolsForCapability(inventory, "read-write"),
    ["read", "write", "edit", "web_fetch", "task_list", "message_parent"],
  );
  assert.deepEqual(
    filterToolsForCapability(inventory, "execute"),
    ["read", "bash", "web_fetch", "task_list", "start_terminal", "write_terminal", "message_parent"],
  );
  assert.deepEqual(filterToolsForCapability(inventory, "all"), inventory);
});

test("profile resolution applies explicit overrides before profile and persona defaults", () => {
  const config: SubagentConfig = {
    maxConcurrent: 4,
    profiles: { reviewer: { capability: "read-only", model: "profile-model", instructions: "Review." } },
    personas: { concise: { instructions: "Be concise.", model: "persona-model", isolation: "worktree" } },
  };
  assert.deepEqual(resolveProfile(config, {
    agentType: "reviewer",
    persona: "concise",
    model: "explicit-model",
    capability: "execute",
  }), {
    agentType: "reviewer",
    persona: "concise",
    instructions: "Review.\n\nBe concise.",
    capability: "execute",
    model: "explicit-model",
    thinking: undefined,
    isolation: "worktree",
  });
});

test("restrictive children block unclassified tools at call time, including late registrations", () => {
  const handlers = new Map<string, (event: any) => any>();
  capabilityGuardExtension("read-only")({ on: (name: string, handler: any) => handlers.set(name, handler) } as never);
  const guard = handlers.get("tool_call")!;
  assert.equal(guard({ toolName: "read" }), undefined);
  assert.deepEqual(guard({ toolName: "late_extension_tool" }), {
    block: true,
    reason: 'Tool "late_extension_tool" is not permitted for a read-only subagent.',
  });
  assert.equal(guard({ toolName: "bash" }).block, true);

  const unrestricted = new Map<string, unknown>();
  capabilityGuardExtension("all")({ on: (name: string, handler: unknown) => unrestricted.set(name, handler) } as never);
  assert.equal(unrestricted.size, 0);
});
