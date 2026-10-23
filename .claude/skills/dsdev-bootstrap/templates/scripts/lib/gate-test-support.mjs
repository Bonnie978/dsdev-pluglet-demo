/**
 * Shared support for the gates' own tests: build a throwaway repository root, run a gate
 * script against it through the real runner (`node scripts/<gate>.mjs --root <dir>`), and
 * assert on exit code and output. Every test owns a private mkdtemp root and disposes it.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

/** Directory holding the gate scripts under test (this file's parent). */
export const SCRIPTS = resolve(dirname(new URL(import.meta.url).pathname), '..')

/** Create a fixture root from a `{ 'relative/path': 'content' }` map; returns root and dispose. */
export function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'dsdev-gate-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  return { root, dispose: () => rmSync(root, { recursive: true, force: true }) }
}

/** Run one gate against a root; returns { status, out } with stdout+stderr joined. */
export function runGate(script, root, ...args) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), '--root', root, ...args], { encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}

/** A minimal valid Agent Note body for the given lifecycle. */
export function note(lifecycle, extra = '') {
  const status = { proposed: 'Status: proposed', implemented: 'Status: implemented', rejected: 'Status: rejected — superseded' }[lifecycle]
  const body = {
    proposed: '## Problem\n\nP.\n\n## Proposal\n\nQ.\n\n## Alternatives considered\n\n- **X.** Lost.\n\n## Acceptance criteria\n\n- A.\n\n## Risks\n\nR.\n',
    implemented: '## Problem\n\nP.\n\n## Decision\n\nD.\n\n## Alternatives considered\n\n- **X.** Lost.\n\n## Consequences\n\nC.\n',
    rejected: '## Problem\n\nP.\n\n## Proposal\n\nQ.\n\n## Alternatives considered\n\n- **X.** Lost.\n',
  }[lifecycle]
  return `# Agent Note: T\n\n${status}\n${extra}\n${body}`
}
