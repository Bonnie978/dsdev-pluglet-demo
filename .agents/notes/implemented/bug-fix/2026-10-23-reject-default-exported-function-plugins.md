# Agent Note: Reject plugins whose default export is a function instead of adapting them

Status: implemented

## Problem

Issue #17 reported a plugin written as `export const name = 'tag'` plus `export default function apply(ctx) {...}`. `unwrapPlugin()` accepted the function as the plugin object because a function owns `.name` and inherits `Function.prototype.apply`; the CLI then crashed with an engine TypeError that named `lib/plugins.js` rather than the plugin ([postmortem 0001](../../../../docs/postmortem/0001-default-exported-function-passes-plugin-validation.md)). Two responses were possible: treat the shape as a third accepted plugin format, or reject it with an actionable `plugin-invalid`.

## Decision

`unwrapPlugin()` accepts exactly two module shapes: named exports `name` and `apply`, or a default-exported object carrying both. Before probing any field it checks `typeof unwrapped === 'object'`; a default export of any other category fails at load with `PlugletError('plugin-invalid')` whose message names the plugin path, the observed `typeof`, and both accepted shapes. The README "写一个插件" section is the consumer-facing home of this contract; `docs/defensive-patterns/general.md` holds the general rule the fix follows.

## Alternatives considered

- **Accept the hybrid shape: named `name` plus a default-exported function used as `apply`.** Rejected. It adds a third documented format that no one asked for, is ambiguous when a module has both a named `apply` and a default function, and the user's complaint was the missing diagnosis, not the missing format. It can be re-proposed as a Feature if plugin authors keep writing it; the rejection message tells them the two shapes that work today.
- **Wrap every non-`PlugletError` thrown from a plugin's `apply` into `plugin-invalid` naming the plugin.** Rejected for this change. `runCli` documents that defects propagate; wrapping them would hide plugin authors' own stack traces behind our message and change a contract the CLI tests pin. It is a separate decision about defect reporting, independent of the validation bug.
- **Require own properties (`Object.hasOwn(candidate, 'apply')`) instead of a category check.** Rejected. It would reject a default-exported class instance whose `apply` lives on its prototype, which the object shape legitimately permits. Checking the category first is the precise fix: it rules out the one family of values (functions, primitives) whose inherited properties fool the field probes while leaving every object shape alone.

## Consequences

- A default-exported function plugin now exits 1 with `pluglet: plugin <path>: default export is a function, not a plugin object; ...` and no stack trace; no previously working configuration changes behavior, so no upgrade guide is needed.
- Plugin authors get the accepted shapes from the error itself and from the README; the loader never silently adapts a shape it did not document.
- Validation of module shapes is tested at three tiers with the user's file verbatim (`DEFAULT_FUNCTION_PLUGIN` in `tests/harness.ts`); a future shape change must update that fixture and the README together.
