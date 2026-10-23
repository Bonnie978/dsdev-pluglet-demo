# Agent Note: `done <id>` is a core command with idempotent completion

Status: implemented

## Problem

pluglet rendered `Task.done` in `list` as `[x]` but offered no way to set it: a user had to write a plugin or edit `tasks.json` by hand. Issue #12 asks for a `done <id>` command. Two choices are not obvious from code alone: whether `done` belongs in the core (the architecture map said the core keeps only `list`/`add`/`help` and new commands are plugins), and what `done` does when the id does not exist or the task is already done.

## Decision

`done` is a core command registered by `registerCoreCommands()` between `add` and `help`, backed by `TaskStore.complete(id)`.

- **Unknown id fails loud**: `complete()` throws `PlugletError('unknown-task')`, a new discriminant mapped to exit code 1 like `unknown-command`. The file is not touched. The message names the id and points at `list`.
- **Already done is idempotent success**: `complete()` returns `{ task, changed: false }`, the command prints `already done <id>: <title>`, exits 0, and the store file is not rewritten (byte-identical, no temp file). The result shape states both facts (final state and whether this call changed it) instead of folding them into one value.
- **Malformed arguments are usage errors**: `done` requires exactly one positive decimal integer; a missing, extra, or non-integer argument throws `PlugletError('usage')` (exit 2), parsed before the store is read.

The core set is the task lifecycle a to-do CLI cannot ship without: create, complete, read, discover. Everything else stays a plugin.

## Alternatives considered

- **Ship `done` as a plugin instead of core.** Rejected: plugins load only from paths in the user's config, so a "bundled" plugin would need every config to reference a path inside the package, and `list` already renders `done` state; a CLI that displays a field it cannot set is incomplete, not minimal. The core/plugin boundary is redrawn once, at the task lifecycle, and recorded here and in `docs/architecture.md`.
- **Already done → error (exit 1).** Rejected: `done` declares a desired end state; failing when that state already holds makes re-running a script after a partial failure fail, and nothing is protected by the error (no data is lost by a repeat). The distinct `already done` wording keeps the fact visible without making it a failure.
- **Already done → print the same `done <id>: <title>` line.** Rejected: it reports a write that did not happen; the output should state one fact per value.
- **Unknown id → usage error (exit 2).** Rejected: the argv is well-formed; the failure is a reference to missing data, the same class as `unknown-command`. A separate `unknown-task` kind lets embedders route on it without parsing text.
- **Accept several ids (`done 1 2 3`).** Deferred, not rejected: the issue asks for one id, and rejecting extra arguments now keeps the surface small; a later change can relax the parser without breaking single-id callers.
- **Reuse `TaskStore.publish()` from the command instead of adding `complete()`.** Rejected: the lookup, the no-op rule and the `unknown-task` failure belong to the store that owns the file, so plugins get the same semantics through `ctx.store.complete()`.

## Consequences

- `PlugletErrorKind` gains `unknown-task`; `exitCodeFor()` maps it to 1 and the exhaustive switch forces every future kind to choose an exit code. Embedders with their own exhaustive switch on the kind must add the case ([upgrade guide](../../../../docs/upgrade-guide/v0.1.0/done-core-command/guide.md)).
- A plugin that registered its own `done` now fails at startup with `duplicate-registration`; the upgrade guide names the fix.
- The `help` expected output and the README command table are the two homes of the user-visible wording; both change together.

## Testing

`tests/store.spec.ts` owns `complete()` (change, byte-identical no-op, untouched file on unknown id); `tests/commands.spec.ts` owns the command output and the usage rejections; `tests/cli.spec.ts` owns the exit-code mapping; `tests/cli.e2e.ts` runs the same flow through the built `lib/bin.js`; `tests/expected/help.expected.txt` pins the help line.
