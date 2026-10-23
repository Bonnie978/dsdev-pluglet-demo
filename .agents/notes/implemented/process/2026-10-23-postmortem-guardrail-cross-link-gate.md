# Agent Note: Postmortems and their guardrails must link each other, checked by `verify-postmortems`

Status: implemented

## Problem

`docs/postmortem/README.md` and the dsdev-postmortem skill both require a postmortem to link the guardrails it motivated and the guardrails to link back, but nothing executed the rule (Issue #41). A postmortem whose `## Guardrails added` only names tests in prose, or a rule line that quietly loses its postmortem link, passed `verify-postmortems`. Making the rule a gate forces a decision about how strict the back-link half should be: every guardrail, any file in the repository, or something in between.

## Decision

`verify-postmortems` enforces two checks on every `docs/postmortem/NNNN-*.md`:

- Forward: the `## Guardrails added` section contains at least one relative Markdown link that resolves to a regular file inside the repository. Links in fenced code, image links, URLs and absolute paths do not count; a link that does not resolve is its own violation naming the line.
- Back: at least one file in a bounded candidate set links back to the postmortem with a relative Markdown link. The set is the guardrail targets that are Markdown files plus the two standing rule homes, root `AGENTS.md` and every `docs/defensive-patterns/*.md`. The failure message lists the set so the fix is one edit in a named file.

Non-Markdown guardrails (tests, source) are valid forward targets but are never searched for back-links. The rule's home is `docs/postmortem/README.md § 护栏互链`; `tests/verify-postmortems.spec.ts` drives the gate through its real runner against temporary fixtures and pins each rejected case.

## Alternatives considered

- **Every guardrail must link back.** Rejected. Half the guardrails are tests and source files, which cannot carry a Markdown link; the only way to satisfy it would be a `// see docs/postmortem/…` comment in each, and the root `AGENTS.md` requires comments to state contracts, not reasoning. It would also turn every postmortem with one code-only guardrail into a permanent violation.
- **Any file in the repository may link back.** Rejected. A mention from an unrelated cookbook or the postmortem README table itself would satisfy it, which checks that the file is reachable, not that a guardrail owns the pointer. The bounded set keeps the back-link where a reviewer expects to find it.
- **Count a plain-text mention of the postmortem path in a test or source file as a back-link.** Rejected. It would make the check depend on comment text, encourage reasoning comments the doc standard forbids, and break silently when `verify-md-links` cannot see the reference. Only Markdown links are checked, so the same link that satisfies this gate is the one `verify-md-links` keeps resolving.
- **Review rule in `docs/defensive-patterns/` instead of a gate.** Rejected. Both halves are decidable by script; the gate-authoring skill routes decidable rules to gates and keeps review for judgment calls.

## Consequences

- A postmortem cannot be merged with prose-only guardrails or with a rule line that lost its reference; the diagnostic names the file, the line for a broken link, and the candidate files for a missing back-link.
- Authors who add only code guardrails must also add the rule line in `AGENTS.md` or a defensive pattern with a link back, which the postmortem skill already requires.
- `verify-postmortems` accepts `--root <dir>` so its spec can run it against fixtures; the default remains this repository and the gate stays read-only.
