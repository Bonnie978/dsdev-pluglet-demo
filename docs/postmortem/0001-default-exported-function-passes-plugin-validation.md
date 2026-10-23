# Post-mortem 0001: `pluglet` crashed with a raw TypeError on a plugin that default-exports its `apply` function — the validator accepted `Function.prototype.apply` as the plugin's `apply`

Status: resolved (fix in the PR that closes Issue #17)

## Executive summary

A user of the released 0.1.0 CLI wrote a plugin with `export const name = 'tag'` and `export default function apply(ctx) {...}`. `unwrapPlugin()` takes `ns.default ?? ns` as the plugin object and probes `typeof candidate.name === 'string'` and `typeof candidate.apply === 'function'`. A function satisfies both: its own `.name` is `"apply"` and it inherits `Function.prototype.apply`. The loader therefore built a plugin named `apply` whose `apply` was `Function.prototype.apply`, called it, and the process died with an engine TypeError and a stack trace that named `lib/plugins.js`, never the plugin file. All 27 unit tests passed and per-file coverage was 100% throughout, because the bug is a missing check: no line was uncovered, the input was simply never considered. The fix checks the category of the unwrapped value before probing fields and fails as `plugin-invalid` naming the file, the observed type and the two accepted shapes; the lasting lesson is that structural validation of an external value must establish what kind of value it is before duck-typing its fields, and that validators are tested with realistic wrong inputs through the real loader, not only with hand-built right ones.

## Summary

Symptom: `pluglet list` (any command) with the plugin above listed in `pluglet.json` exits with an uncaught `TypeError` and a Node stack trace; stderr does not mention the plugin path or what is wrong with it. One bug; one mechanism; the surface message depends on how the engine reports a call to `Function.prototype.apply` on a non-callable receiver (`plugin.apply is not a function` on Node 24.11; the report quotes `Cannot read properties of undefined (reading 'commands')`).

## Impact

Every 0.1.0 user whose plugin default-exports a function (or any non-object value) could not run any command while that plugin was configured, and had no actionable diagnostic. No data loss: the crash happens in `loadPlugins`, before any command runs or the store is written. Cost: a user report that questioned the test suite's credibility, plus the investigation recorded below.

## Timeline

1. 0.1.0 ships `unwrapPlugin` with `const candidate = (ns.default ?? ns) as Partial<PluginModule>` followed by two `typeof` probes. Unit tests feed it hand-built objects; the only plugin fixture in the composition and e2e tests is the well-formed `SHOUT_PLUGIN`.
2. Issue #17: the user reports the crash with the plugin file quoted above and asks how it shipped with 27 passing tests and 100% coverage.
3. Investigation reproduces the crash through the built bin with the user's exact file. The observed message (`plugin.apply is not a function`, thrown at `lib/plugins.js` in `loadPlugins`) differs from the report's text, which briefly suggested a second bug.
4. A probe of the imported namespace settles it: `typeof ns.default === 'function'`, `candidate.name === 'apply'`, `candidate.apply === Function.prototype.apply`. One acceptance error, two engine-dependent message texts. The guards below assert on the typed failure, not on message text.
5. Guards are written first and observed red on the unfixed `src/` and the unfixed built `lib/`; the fix lands; guards go green with per-file coverage still 100%.

## Root cause #1 — duck typing on a value whose category was never established

`src/plugins.ts`, `unwrapPlugin`: `ns.default ?? ns` is cast to `Partial<PluginModule>`, erasing the question of what the default export is. Then `typeof candidate.name !== 'string' || candidate.name === ''` and `typeof candidate.apply !== 'function'` are the only checks. For `export default function apply(ctx) {...}` both probes hit properties supplied by the function itself and by `Function.prototype`, so validation passes and `loadPlugins` calls `plugin.apply(ctx)` where `plugin.apply` is `Function.prototype.apply` with a plain object as receiver. The code looked reasonable because the two probes do express the contract ("has a name, has an apply") — they just express it against the wrong object.

## Why every test missed it

- **Unit tests of the validator used hand-built right inputs.** `unwrapPlugin` was exercised with `{ name, apply() {} }`, `{ default: { name, apply() {} } }` and four objects missing fields. No case was a function, a string or a number, so the inherited-property path was never taken. Hand-built objects cannot carry a plugin author's realistic mistake; a module namespace with a default-exported function is one `import()` away and was never imported.
- **Composition and e2e tests had one plugin fixture.** `loadPlugins`, `runCli` and the built-bin e2e all loaded `SHOUT_PLUGIN`; the failure-path fixtures were a module that throws at import and an `apply` that throws. Both exercise what happens after a well-formed module is recognised, not whether recognition is right.
- **100% line and branch coverage held throughout.** Every line of `unwrapPlugin` executed in every run. Coverage measures lines executed, not inputs considered; a check that does not exist cannot show up as an uncovered line.
- **The type cast made the compiler agree.** `as Partial<PluginModule>` on a value of type `unknown` typechecks under `strict`; nothing in the type system distinguishes "object with an `apply` method" from "function with the inherited `apply` method".
- **`runCli` treats non-`PlugletError`s as defects and lets them propagate.** That contract is right for genuine defects, but it meant the misclassification surfaced as a raw stack trace about pluglet's own file rather than a `plugin-invalid` report about the plugin.

## Guardrails added

- Code: `unwrapPlugin` checks `typeof unwrapped !== 'object'` before any field probe and throws `PlugletError('plugin-invalid')` naming the path, the observed type and the two accepted shapes ([src/plugins.ts](../../src/plugins.ts)).
- Unit guard: `tests/plugins.spec.ts` "rejects a non-object default export instead of probing its inherited properties" feeds a default-exported function, a string and a number. On the unfixed code it fails with `expected undefined to be an instance of PlugletError`.
- Source-plane composition guard: `tests/cli.spec.ts` "reports a default-exported function plugin as a handled plugin-invalid failure, not a defect" drives `runCli` with the user's file. On the unfixed code it fails with `TypeError: plugin.apply is not a function`.
- Real-entry guard: `tests/cli.e2e.ts` "rejects a default-exported function plugin with exit 1, naming the file and the fix, with no stack trace" spawns the built `lib/bin.js`. On the unfixed build it fails because stderr is a stack trace instead of `pluglet: plugin <path>: default export is a function...`.
- Shared fixture: `DEFAULT_FUNCTION_PLUGIN` in `tests/harness.ts` is the user's plugin verbatim, so every tier loads the same realistic mistake.
- Rule: [defensive pattern "校验先判类别再探测字段"](../defensive-patterns/general.md#校验先判类别再探测字段) and one line in the root `AGENTS.md`.
- Decision record: [Agent Note: reject default-exported function plugins](../../.agents/notes/implemented/bug-fix/2026-10-23-reject-default-exported-function-plugins.md) records why the shape is rejected rather than adapted.
- Consumer contract: the README "写一个插件" section names the two accepted module shapes and the load-time rejection of everything else.

## Lessons

1. Before duck-typing a value that came from outside the process (a module namespace, parsed JSON, a CLI argument), assert its category: `typeof v === 'object'` and not a function. `Function.prototype` supplies `apply`, `call`, `bind`, `name` and `length`, so a function passes any probe for those names.
2. Test a validator with the realistic wrong inputs an author will produce, loaded through the real loader, not only with hand-built right inputs. The fixture is the user's mistake, verbatim.
3. 100% coverage of a validator proves every existing check ran once. It says nothing about checks that do not exist. Negative cases enumerate the input space, not the code.
4. A third-party module failing to load must surface as a typed failure naming that module. A raw stack trace that names our own file is a report about us, not about the plugin, and the user cannot act on it.
