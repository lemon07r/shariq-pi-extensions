# Smart Compaction

Replaces Pi's default compaction summary with a structured checkpoint and a deterministic record of file and worktree state, so a long session can continue after compaction without losing goals, constraints, or in-flight edits.

## What a checkpoint contains

The summarizer must return six numbered sections:

1. Primary goal and nuanced intent, including user constraints and negative rules.
2. Progress ledger: done, in progress (with batch counts), and blocked. Done items are closed history the next turn must not redo.
3. Code changes and in-progress snippets.
4. Errors, root causes, and fixes.
5. Key decisions and hypotheses.
6. Resume anchor and the single next action.

On a later compaction the previous checkpoint is merged with the new turns instead of being summarized again from scratch.

After the model's text, the extension appends sections it computes itself:

- files read and files written or edited, accumulated across compactions;
- uncommitted files from `git status`, with lockfiles, minified bundles, and build output listed separately and kept out of the diff;
- running background terminals, so the next turn does not start a duplicate server;
- a bounded uncommitted diff (16,000 characters, shared across files) with previews of untracked files, or a marker when worktree state is unavailable.

## Validation and retries

A summary is accepted only when the model stopped normally, made no tool calls, and returned all six sections. Commit SHAs, UUIDs, URLs, and IPv4 addresses found in user messages and the previous checkpoint are protected facts; a summary that drops one is rejected. When the only defect is dropped identifiers, they are appended verbatim under a "Retained Identifiers" heading instead of failing.

Each attempt has a 10-minute timeout. The attempts are:

1. the configured model with the configured thinking level;
2. the same model with thinking off;
3. the session model with thinking off, when it differs.

Authentication, permission, quota, and cancellation errors stop the ladder immediately. If every attempt fails, compaction is cancelled and the full conversation is kept; the extension does not fall back to Pi's default summarizer.

The conversation is serialized for the summarizer with head and tail excerpts of long tool output, more room for failures and edits than for routine reads, bounded write and edit arguments, and terminal control sequences and repeated lines removed. Session history itself is never modified.

Each compaction entry records its source, serialized, and summary sizes, attempt count, and duration in `details`.

## Threshold

Pi's own reserve-token threshold still applies. Smart Compaction adds an upper bound, checked before each provider request:

- `percent`: a percentage of the model's context window;
- `hard`: an absolute token count;
- `hybrid` (default): whichever comes first of 95% and 400,000 tokens.

When the bound is reached, the extension starts compaction and then sends "Continue." as a follow-up so the run resumes. Manual `/compact` input is routed through the same compaction path.

## Commands

- `/compaction-model`: pick the compaction model, or `inherit` to use the session model.
- `/compaction-model <provider/model>`: set it directly.
- `/smart-compaction`: show status and settings.
- `/smart-compaction enable | disable`
- `/smart-compaction threshold percent | hard | hybrid`
- `/smart-compaction percent <1-100>`
- `/smart-compaction hard-limit <tokens>`

## Configuration

Settings live in `<agent-dir>/smart-compaction.json`:

```json
{
  "version": 1,
  "enabled": true,
  "model": "inherit",
  "thinkingLevel": "inherit",
  "thresholdMode": "hybrid",
  "thresholdPercent": 95,
  "hardLimitTokens": 400000
}
```

`maxSummaryTokens` is optional. Without it, the summary may use the model's full output limit.