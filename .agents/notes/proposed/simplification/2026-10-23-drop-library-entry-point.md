# Agent Note: Drop the library entry point

Status: proposed

## Problem

`src/index.ts` re-exports every module as the "public API a plugin author or embedder imports", `package.json` points `main`, `types` and `files` at its build output, and `tests/index.spec.ts` pins the export list. Nothing consumes that surface: the package is `private: true` and has no remote, so it is never installed; `src/bin.ts` imports `./cli.ts` directly; plugins receive the registry and the store through `ctx` and import nothing (README, "写一个插件"); and the only importer of `src/index.ts` in the repository is its own contract test (`rg "index\.ts|from 'pluglet'"` finds `package.json:main` and `tests/index.spec.ts`). The surface is still maintained: the JSDoc gate checks it, the coverage gate counts it, and the export-list test must be edited whenever a module adds or renames an export.

## Proposal

Delete `src/index.ts` and `tests/index.spec.ts`. Remove `main`, `types` and `files` from `package.json`, leaving `bin` as the only entry the package declares. `lib/bin.js` stays the real entry path the e2e tier spawns; no module gains or loses an export.

## Alternatives considered

- **Keep the entry point as the documented embedding API.** Rejected for now: an API with zero consumers is exactly the obligation this note removes. When an embedder exists, reintroduce the module with that embedder's import list as the contract test, so the test pins a real consumer instead of a guess.
- **Keep `src/index.ts` but drop `tests/index.spec.ts`.** Rejected: the contract test is the only thing that gives the re-export file a job; without it the file duplicates each module's export list with nothing checking the copy.
- **Make the package publishable (drop `private: true`) so the surface has a consumer.** Rejected: pluglet is a test-bed for the dsdev method (README), not a library; publishing is a product decision, not a simplification.

## Acceptance criteria

- `src/index.ts` and `tests/index.spec.ts` are gone; `package.json` declares `bin` and no `main`, `types` or `files`.
- `pnpm test`, `pnpm run test:coverage` (per-file 100% still holds for the remaining `src/` files), `pnpm run hygiene`, `pnpm run test:docs` and `pnpm run test:e2e` are green.
- `docs/architecture.md` and `README.md` need no edits because neither documents the library entry; the PR states this check was made.

## Risks

- An out-of-tree embedder importing `pluglet` would break. The evidence above says none exists; if one appears before this lands, the proposal is withdrawn and the embedder's imports become the contract test.
- The package then has no TypeScript declaration entry. That is a loss only for an embedder, which is the consumer this note finds absent.
