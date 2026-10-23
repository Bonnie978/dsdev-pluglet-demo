# Agent Note: Rename --config to --profile with no alias and reject unknown options

Status: implemented

## Problem

Issue #21 renames the CLI's configuration selector: `--config <file>` becomes `--profile <file>` and the default file `pluglet.json` becomes `pluglet.profile.json`; the file's content (`store`, `plugins`) is unchanged. The rename breaks every existing call site, and the parser has to decide what happens to a token it does not recognize. 0.1.0 passed every token other than `--config` through to the command as an ordinary argument, so a leftover `--config ./x.json` placed after the command would disappear into the command's arguments: `pluglet add --config ./x.json buy milk` exits 0 and stores a task titled `--config ./x.json buy milk`, and a migration checked by exit status cannot detect it.

## Decision

`--profile <file>` is the only option `parseArgv` recognizes. Any other token that starts with `--`, in any position, fails at parse time with `PlugletError('usage', 'unknown option "<arg>"; the only option is --profile <file>')` (exit 2) before any profile or store is read. `--config` gets no alias and no deprecation period: it fails like every other unknown option. Tokens starting with a single `-` remain ordinary arguments. The README states the consumer contract; the [upgrade guide](../../../../docs/upgrade-guide/v0.1.0/profile-flag-rename/guide.md) carries the migration.

The maintainers' rationale: the CLI is in developer preview with breaking changes announced, so an alias would have to be removed later with a second upgrade guide; a loud failure at every call site is cheaper for users than a silent alias that is removed afterwards. No plugin is planned to receive dash-prefixed arguments, so rejecting them costs no current consumer.

## Alternatives considered

- **Keep `--config` as an alias for one release.** Rejected: an alias is a second surface that must itself be removed with a second upgrade guide, and during the overlap scripts keep working without anyone noticing they are on a flag that is going away. The developer-preview announcement already licenses the break; one loud failure per call site ends the migration in one release.
- **Reject the old flag with a dedicated error (`--config was renamed to --profile`).** Rejected: a dedicated branch is a reverse alias with the same lifecycle problem (it has to be deleted later) and it treats one unknown option differently from every other. The generic `unknown option "<arg>"; the only option is --profile <file>` names the only valid option, which is the same actionable information without a flag-specific code path.
- **Pass unknown `--` tokens through to the command.** Rejected: the leftover flag becomes command input and exits 0, so neither the user nor the upgrade guide can verify the migration by exit status. AGENTS.md requires configuration errors to fail at the earliest resolvable point, which for argv is `parseArgv`. Nothing today needs dash-prefixed arguments; a plugin that does can propose an end-of-options marker as a Feature.

## Consequences

- Every leftover `--config`, leading or trailing, exits 2 with a message naming the replacement; every migrated call exits 0, so exit status verifies the migration.
- Command arguments cannot start with `--` (for example `add --urgent fix`); a single-dash argument still can.
- `tests/cli.spec.ts` pins the parser contract and `tests/cli.e2e.ts` pins the exit code, the exact stderr line and the untouched store through the built bin in both positions, with and without the default profile present.
