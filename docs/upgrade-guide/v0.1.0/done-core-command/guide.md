---
kind: upgrade-guide
description: "The core gains a `done` command and the `unknown-task` error kind; plugins named `done` and exhaustive switches on PlugletErrorKind must change."
---

# `done` becomes a core command; `PlugletErrorKind` gains `unknown-task`

## Change

Before, the core registered `list`, `add` and `help`, and a plugin could register its own `done` command. Now the core registers `done` too, so a plugin that registers `done` fails at startup with `PlugletError('duplicate-registration')` (exit 1) and no command runs.

Before, `PlugletErrorKind` had six members. Now it also has `unknown-task`, thrown by `TaskStore.complete()` and the `done` command when no task has the given id. An embedder that switches exhaustively on the kind (for example with `assertNever`) stops compiling until it handles the new member; `exitCodeFor()` already maps it to 1.

## Migration

1. Plugins: rename your `done` command, or delete it if the core behavior (mark done, `already done` on repeat, `unknown-task` on a missing id) is what you want. Confirm with `pluglet help`: the command list prints without a `duplicate-registration` error.
2. Embedders: add `case 'unknown-task':` to every exhaustive switch on `PlugletErrorKind`, next to `unknown-command`. Confirm with `pnpm run typecheck` in your project.
