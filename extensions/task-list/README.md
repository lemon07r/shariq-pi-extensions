# Pi Task List

A branch-safe checklist the active model keeps for work with several separate deliverables. There is no background planner; the model creates and updates the list itself.

Task List is independent of the Goal extension. An ordinary request can use a list without becoming a goal, and a goal can use its own evidence checklist alongside a task list.

## When the model uses it

The tool guidance limits the list to three cases: the user asks for a plan or checklist, the request has several separate deliverables, or long multi-phase work benefits from visible progress. A single objective, such as fixing one bug or implementing one spec, goes ahead without a list even when it takes many reads, edits, and test runs. The extension never prompts the model to start a list.

When a list exists, the model sends it with its first real action, updates it only when a task finishes, is blocked or cancelled, or the scope changes, and marks finished items before the final response.

## Model tool

`task_list` reads or replaces the session list:

- omit `tasks` to read the list;
- supply `tasks` to replace the whole ordered list, keeping stable ids;
- add `explanation` when scope, order, or approach changes.

Each item has an `id` (letters, numbers, dots, underscores, hyphens), `content`, `status` (`pending`, `in_progress`, `completed`, `blocked`, or `cancelled`), optional `priority` (`high`, `medium`, or `low`; default `medium`), and an optional `note`.

A list holds up to 64 items. While pending work remains, at least one item must be `in_progress`. The tool is declared with `model-only` exposure, so codemode scripts cannot call it.

## Continuity

Every update is stored as an immutable snapshot in a Pi custom session entry. The list is rebuilt from the active branch on startup, resume, reload, and tree navigation, so each branch keeps the list that belonged to it.

When compaction or branching removes the latest snapshot from model context and unfinished items remain, the extension adds the current list to the next request. Completed and cancelled items appear only as counts, so the model does not redo them.

Nothing is written outside the session.

## Subagents

Subagents load this extension like any other child resource. `task_list` is allowed under every child capability because it only changes the child's own planning state; a child never changes the parent's list.

## User interface

While work is active, the shared **Active work** dock above the editor shows progress next to any running terminals or subagents. A finished list stays visible for four seconds, then clears from the live view and remains in session history.

`/tasks` opens the dashboard:

- `↑`/`↓` or `j`/`k`: select an item;
- `space`: advance pending → in progress → completed;
- `b`: block or unblock;
- `c`: cancel or restore;
- `p`: cycle priority;
- `a`: add;
- `e`: edit;
- `d`: delete, after confirmation;
- `h`: hide or show completed and cancelled items;
- `X`: clear the list, after confirmation;
- `Esc` or `q`: close.

When a user edit leaves no item in progress, the next pending item is promoted. `/tasks clear` clears the list without opening the dashboard. Outside the TUI, `/tasks status` prints a text summary.
