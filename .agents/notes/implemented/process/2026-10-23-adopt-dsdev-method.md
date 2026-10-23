# Agent Note: Adopt the dsdev development method

Status: implemented

## Problem

pluglet is a small repository whose changes are made mostly by agents. Without written standing orders, every session re-derives conventions from the code, decisions live only in chat transcripts, and escaped bugs produce fixes but no durable guardrails. The repository needs one place for rules an agent must keep in context, one place for decision rationale, and mechanically executed checks for everything that can be checked.

## Decision

pluglet uses the dsdev method as installed by `dsdev-bootstrap`: a root `AGENTS.md` (with `CLAUDE.md` symlinked to it) carries standing orders with links to their homes; `docs/AGENTS.md` fixes the tier taxonomy; decisions live in `.agents/notes/{lifecycle}/{class}/`; escaped bugs get a postmortem under `docs/postmortem/`; review-enforced rules live in `docs/defensive-patterns/`; `scripts/run-gates.mjs` runs the `doc-quick`, `doc-sync`, `hygiene` and `check-all` aggregates; git hooks stay narrow (staged whitespace and Markdown wrap on commit, typecheck on push). Skills are copied into `.claude/skills/` and committed with the code (version in `.claude/skills/VERSION`); upgrading replaces the whole set in one PR.

## Alternatives considered

- **A single CLAUDE.md with everything in it.** Rejected: one file cannot hold rules, rationale and procedures without exceeding what an agent should load every session; the tier taxonomy keeps the standing orders short and links the rest.
- **Conventional ADRs under `docs/adr/` without lifecycle folders.** Rejected: ADRs without `proposed/implemented/rejected` folders and a format gate drift into spec-speak after shipping; the path-encoded lifecycle and `verify-agent-note-format` keep implemented notes describing present reality.
- **No executed gates, rely on review.** Rejected: review catches judgement calls, not mechanical drift (hard-wrapped paragraphs, broken links, malformed notes); a gate that is never run is a rule that does not exist.

## Consequences

- Every change carries its documentation and its evidence in the same PR; "docs later" is not an option.
- The method costs a few minutes per change (reading rules, running `test:docs`); it buys a repository whose rules a fresh agent can learn from files alone.
- Language-specific gates (`typecheck`, `verify-export-jsdoc`, unit tests) are registered in `scripts/gates.config.mjs`; adding one follows `dsdev-gate-authoring`, including the negative control.
