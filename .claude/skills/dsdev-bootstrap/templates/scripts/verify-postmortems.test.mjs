import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

// The gate is exercised through its real runner (`node scripts/verify-postmortems.mjs --root <fixture>`)
// against a disposable mini-repository, so each case asserts the exit code and the diagnostic a
// contributor would see, not an internal function.
const SCRIPT = resolve(import.meta.dirname, 'verify-postmortems.mjs')
const POSTMORTEM = 'docs/postmortem/0001-x.md'

/** @param {string} root */
function run(root) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout + r.stderr }
}

/**
 * A postmortem with every required section; `guardrails` is the body of `## Guardrails added`.
 * @param {string} guardrails
 * @param {{ withGuardrails?: boolean }} [opts]
 */
function postmortem(guardrails, { withGuardrails = true } = {}) {
  return [
    '# Post-mortem 0001: x', '', 'Status: resolved', '',
    '## Executive summary', '', 'x', '',
    '## Root cause #1 — x', '', 'x', '',
    '## Why every test missed it', '', 'x', '',
    ...(withGuardrails ? ['## Guardrails added', '', guardrails, ''] : []),
    '## Lessons', '', '1. x', '',
  ].join('\n')
}

describe('verify-postmortems (guardrail cross-links)', () => {
  /** @type {string} */ let tmp
  /** @type {string} */ let root
  /** @param {string} rel @param {string} text */
  const file = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  /**
   * Mini-repository: README table, a test guardrail, an Agent Note, the two standing rule homes (no back-links yet).
   * @param {string} guardrails
   * @param {{ withGuardrails?: boolean }} [opts]
   */
  const fixture = (guardrails, opts) => {
    file('docs/postmortem/README.md', '# Post-mortems\n\n| # | 标题 |\n|---|---|\n| 0001 | [x](0001-x.md) |\n')
    file('test/x.test.mjs', 'export {}\n')
    file('.agents/notes/implemented/bug-fix/2026-01-01-x.md', '# Agent Note: x\n\nStatus: implemented\n\n## Problem\n\nx\n')
    file('AGENTS.md', '# AGENTS.md\n\n- rule\n')
    file('docs/defensive-patterns/general.md', '# patterns\n\nrule\n')
    file(POSTMORTEM, postmortem(guardrails, opts))
  }
  // The fixture repository is a child of the temp dir so a link that escapes the repository still lands on a real file.
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'verify-postmortems-')); root = join(tmp, 'repo'); mkdirSync(root) })
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }) })

  it('passes when a Markdown guardrail target links back', () => {
    fixture('- Test: [x.test.mjs](../../test/x.test.mjs)\n- Note: [note](../../.agents/notes/implemented/bug-fix/2026-01-01-x.md)')
    file('.agents/notes/implemented/bug-fix/2026-01-01-x.md', '# Agent Note: x\n\nStatus: implemented\n\n## Problem\n\n[pm](../../../../docs/postmortem/0001-x.md)\n')
    const r = run(root)
    assert.equal(r.status, 0, r.out)
    assert.match(r.out, /1 postmortem\(s\) conform; guardrails and postmortems link each other\./)
  })

  it('passes when only a standing rule home (AGENTS.md or defensive-patterns) links back to a postmortem whose guardrails are all non-Markdown', () => {
    fixture('- Test: [x.test.mjs](../../test/x.test.mjs)')
    file('docs/defensive-patterns/general.md', '# patterns\n\nrule ([postmortem](../postmortem/0001-x.md))\n')
    assert.equal(run(root).status, 0)
    file('docs/defensive-patterns/general.md', '# patterns\n\nrule\n')
    file('AGENTS.md', '# AGENTS.md\n\n- rule ([postmortem 0001](docs/postmortem/0001-x.md))\n')
    assert.equal(run(root).status, 0)
  })

  it('fails when `## Guardrails added` has no relative Markdown link', () => {
    fixture('- Test: test/x.test.mjs "rejects a function" (named, not linked)\n- Docs: [external](https://example.invalid/x)')
    const r = run(root)
    assert.equal(r.status, 1)
    assert.ok(r.out.includes(`${POSTMORTEM}: \`## Guardrails added\` has no relative Markdown link to a guardrail`), r.out)
    assert.ok(r.out.includes('docs/postmortem/README.md § 护栏互链'), r.out)
  })

  it('ignores links inside fenced code and image links', () => {
    fixture('```md\n[x.test.mjs](../../test/x.test.mjs)\n```\n\n![diagram](../../test/x.test.mjs)')
    const r = run(root)
    assert.equal(r.status, 1)
    assert.ok(r.out.includes('has no relative Markdown link to a guardrail'), r.out)
  })

  it('fails naming the line when a guardrail link does not resolve to a file in the repository', () => {
    fixture([
      '- [missing](../../test/missing.test.mjs)',
      '- [a directory](../../test)',
      '- [outside the repository](../../../outside.md)',
      '- [absolute](/etc/hosts)',
    ].join('\n'))
    writeFileSync(join(tmp, 'outside.md'), 'x\n')
    const r = run(root)
    assert.equal(r.status, 1)
    assert.ok(r.out.includes(`${POSTMORTEM}:19: guardrail link ../../test/missing.test.mjs does not resolve to a file in the repository`), r.out)
    assert.ok(r.out.includes(`${POSTMORTEM}:20: guardrail link ../../test does not resolve`), r.out)
    assert.ok(r.out.includes(`${POSTMORTEM}:21: guardrail link ../../../outside.md does not resolve`), r.out)
    // An absolute path is not a relative link, so it is neither counted nor resolved; the broken links above already fail the gate.
    assert.ok(!r.out.includes('/etc/hosts'), r.out)
    assert.ok(!r.out.includes('links back'), r.out)
  })

  it('fails when no Markdown guardrail target or rule home links back, listing where the back-link may live', () => {
    fixture('- Test: [x.test.mjs](../../test/x.test.mjs)\n- Note: [note](../../.agents/notes/implemented/bug-fix/2026-01-01-x.md)')
    const r = run(root)
    assert.equal(r.status, 1)
    assert.ok(r.out.includes(`${POSTMORTEM}: no guardrail links back; add a link to ${POSTMORTEM} in one of: .agents/notes/implemented/bug-fix/2026-01-01-x.md, AGENTS.md, docs/defensive-patterns/general.md`), r.out)
  })

  it('does not count a back-link that lives inside fenced code', () => {
    fixture('- Note: [note](../../.agents/notes/implemented/bug-fix/2026-01-01-x.md)')
    file('.agents/notes/implemented/bug-fix/2026-01-01-x.md', '# Agent Note: x\n\nStatus: implemented\n\n## Problem\n\n```md\n[pm](../../../../docs/postmortem/0001-x.md)\n```\n')
    const r = run(root)
    assert.equal(r.status, 1)
    assert.ok(r.out.includes('no guardrail links back'), r.out)
  })

  it('reports a missing `## Guardrails added` section once, without a link error', () => {
    fixture('', { withGuardrails: false })
    const r = run(root)
    assert.equal(r.status, 1)
    assert.ok(r.out.includes(`${POSTMORTEM}: missing \`## Guardrails added\` section`), r.out)
    assert.ok(!r.out.includes('no relative Markdown link'), r.out)
    assert.ok(!r.out.includes('links back'), r.out)
  })

  it('exits 2 when --root does not exist', () => {
    const r = run(join(root, 'nope'))
    assert.equal(r.status, 2)
    assert.ok(r.out.includes('--root'), r.out)
  })
})
