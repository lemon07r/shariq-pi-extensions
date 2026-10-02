import assert from "node:assert/strict";
import test from "node:test";
import extension, { deriveBtwTitle } from "./index.ts";

test("derives compact Unicode-safe titles for by-the-way questions", () => {
  assert.equal(deriveBtwTitle("  Why is this failing?\nMore detail"), "Why is this failing?");
  const long = "🧪".repeat(80);
  assert.equal([...deriveBtwTitle(long)].length, 60);
  assert.match(deriveBtwTitle(long), /…$/);
});

test("registers one Pi-only canonical API and the takeover dashboard", () => {
  const tools = new Map<string, any>();
  const commands: string[] = [];
  const hooks: string[] = [];
  const fakePi = {
    events: {
      on() { return () => {}; },
      emit() {},
    },
    registerTool(definition: any) {
      tools.set(definition.name, definition);
    },
    registerCommand(name: string) {
      commands.push(name);
    },
    registerMessageRenderer() {},
    registerEntryRenderer() {},
    on(name: string) {
      hooks.push(name);
    },
    sendMessage() {},
    getThinkingLevel() {
      return "medium";
    },
  };

  extension(fakePi as never);

  assert.deepEqual([...tools.keys()], [
    "spawn_agent",
    "wait_agent",
    "close_agent",
    "check_agent",
    "list_agent_profiles",
    "list_agents",
    "send_message",
    "apply_agent_changes",
    "reply_question",
    "task",
  ]);
  assert.deepEqual(commands, ["btw", "subagents"]);
  for (const tool of tools.values()) {
    assert.equal(tool.exposure, "model-only", `${tool.name} should stay declared to the model`);
    assert.equal(typeof tool.renderCall, "function", `${tool.name} should render a compact call card`);
    assert.equal(typeof tool.renderResult, "function", `${tool.name} should render a compact result card`);
  }
  assert.ok(hooks.includes("session_start"));
  assert.ok(hooks.includes("agent_start"));
  assert.ok(hooks.includes("agent_settled"));
  assert.ok(hooks.includes("session_shutdown"));

  const spawnSchema = JSON.stringify(tools.get("spawn_agent")?.parameters);
  assert.match(spawnSchema, /message/);
  assert.match(spawnSchema, /agent_type/);
  assert.match(spawnSchema, /capability/);
  assert.match(spawnSchema, /fork_turns/);
  assert.match(spawnSchema, /resume_from/);
  assert.match(spawnSchema, /worktree/);
  assert.match(spawnSchema, /Default none/);
  assert.match(spawnSchema, /concurrent writers would overlap/);
  assert.doesNotMatch(spawnSchema, /harness|claude|codex/);

  const taskTool = tools.get("task");
  assert.match(JSON.stringify(taskTool?.parameters), /Default none/);
  assert.match(taskTool?.description ?? "", /background/);
  assert.match(taskTool?.description ?? "", /return their ids/);
  assert.match(taskTool?.description ?? "", /arrives as a message that starts your next turn/);
  assert.equal(taskTool?.promptGuidelines, undefined);

  const waitTool = tools.get("wait_agent");
  assert.match(waitTool?.description ?? "", /without waiting/);

  const guidelines = tools.get("spawn_agent")?.promptGuidelines.join("\n") ?? "";
  assert.match(guidelines, /only when the user asks to delegate/);
  assert.match(guidelines, /end the turn/);
  assert.match(guidelines, /instead of polling wait_agent, check_agent, or list_agents/);
  for (const legacy of [
    "subagent_spawn",
    "subagent_wait",
    "subagent_cancel",
    "subagent_check",
    "subagent_list",
  ]) {
    assert.equal(tools.has(legacy), false);
  }
});
