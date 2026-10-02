# Pi background terminals

Session-scoped background pseudo-terminals for Pi. The extension combines Codex-style PTY input and cursor reads with bounded capture, size-limited private logs, automatic completion delivery, process-group shutdown, and a live Pi control center.

## Model tools

- `start_terminal` — start a long-running or interactive command in a PTY.
- `read_terminal` — read retained or incremental output, with optional long polling.
- `write_terminal` — send input or control characters and collect the response.
- `list_terminals` — list running and settled terminals.
- `stop_terminal` — stop complete process groups with TERM-to-KILL escalation.

Each output response carries a byte cursor; pass it to the next read or write to get only new output. The tools render as compact cards with expandable output, use `model-only` exposure, and running terminals appear in the shared **Active work** dock with elapsed time and the latest output line.

When a model-started terminal exits, its status and a bounded output tail are delivered as a custom message. An idle parent starts a new turn for it; a busy parent receives it, together with any other pending results, when its run settles. The message never appears as user-authored or follow-up input, and reading the terminal does not suppress it.

## User interface

`/term`, `/term list`, and `/ps` open the fullscreen control center. `/term start <command>` starts the process and immediately returns to the editor; `/term stop <id> [id…]` stops exact processes. The control center provides:

- live counts and status;
- terminal list with a selected-session inspector;
- live output, elapsed time, dimensions, command, cwd, and full-log size;
- real PTY input;
- Ctrl+C delivery to the PTY;
- scrolling and top/bottom navigation;
- two-press process-stop guard.

## Lifecycle and safety

- Maximum eight concurrent terminals and 32 tracked entries.
- Newest 2 MiB retained in memory per terminal.
- Raw output spills to a mode-`0600` file under a mode-`0700` temporary session directory, capped at 64 MiB per terminal.
- Spill backpressure pauses and resumes the PTY; reaching the cap stops log growth while retaining the newest live-output tail.
- Pruning an old settled terminal deletes its spill file immediately; session shutdown removes the complete temporary directory.
- Output is sanitized before TUI or model rendering.
- Processes run in their own PTY process group and are stopped on session shutdown, replacement, or reload.
- Shutdown and stop operations are bounded and escalate from SIGTERM to SIGKILL.
- Completion delivery is keyed by terminal id, so each terminal produces at most one result message.
