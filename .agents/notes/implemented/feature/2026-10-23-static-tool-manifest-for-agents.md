# Agent Note: Expose the core commands to LLM agents through a static tool manifest

Status: implemented

## Problem

Issue #52 exposes pluglet to LLM agents as tools behind an MCP-style manifest. The CLI already carries one description per command, but those strings are written for `help` output read by a human at a terminal; an agent needs to know what a call returns, what a parameter means, and when the toolset applies at all. The manifest also has to stay in step with the CLI it fronts: the set of core commands, the name of the profile option and its default file are all facts of `src/` that the model-visible text repeats.

## Decision

`tools/pluglet.tools.json` is a hand-written, reviewed file: a `tools` array with one definition (`name`, `description`, JSON Schema `parameters`) per core command, in registration order, and a `systemPromptSection` string that says when to use the toolset and what it cannot do. The tool set is exactly the commands `registerCoreCommands` registers, and every tool takes the same optional `profile` parameter, named after the CLI's `--profile` option and defaulting to its `pluglet.profile.json`; `tests/tools.spec.ts` pins both to the real code and enforces the agent-experience rules (every parameter described, no sentence shared between two tools, the system prompt section never restating a tool or parameter description). The README section "给 LLM Agent 暴露工具" is the consumer-facing home of the manifest's contract and of the tool-to-CLI mapping an MCP server implements.

## Alternatives considered

- **Generate the manifest from the command registry when the server starts.** Rejected. The registry's descriptions are terse `help` strings for humans and would reach the model verbatim; the set of commands would change with each profile's plugins, so the toolset an agent is prompted with would not be stable or reviewable; and model-facing text is behavior that review and a test should pin, which a generated file cannot offer. The test keeps the static file honest by comparing it to the registry instead.
- **Add a generic `pluglet_run` tool that forwards any command name and arguments, covering plugin commands.** Rejected for this change. An untyped passthrough gives the model no schema to fill and no description to decide by, which is what a tool definition exists to provide; it can be re-proposed as a Feature if agents need plugin commands.
- **Share the `profile` parameter through a `$ref` to one definition in the file.** Rejected. MCP clients read each tool's schema standalone, so a cross-tool reference would not resolve; the test instead requires every copy to be identical.

## Consequences

- Adding, renaming or removing a core command, or changing the `--profile` default, fails `tests/tools.spec.ts` until the manifest follows; `tests/expected/help.expected.txt` and the manifest change in the same commit.
- Plugin commands are visible to an agent through `pluglet_help` but not callable; the `systemPromptSection` says so, so the agent hands them to the user instead of guessing.
- The manifest is model-visible text: editing a description is a behavior change and is reviewed as one, under the dsdev-agent-experience rules the test partially enforces.
