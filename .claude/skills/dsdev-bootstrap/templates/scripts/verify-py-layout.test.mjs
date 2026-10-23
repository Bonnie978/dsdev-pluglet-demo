import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

// The gate is exercised through its real runner (`node scripts/verify-py-layout.mjs --root <fixture>`)
// against a disposable mini-repository, so each case asserts the exit code and the diagnostic a
// contributor would see, not an internal function.
const SCRIPT = resolve(import.meta.dirname, 'verify-py-layout.mjs')

/** @param {string} root */
function run(root) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout + r.stderr }
}

describe('verify-py-layout (pytest discovery + package __init__)', () => {
  /** @type {string} */ let root
  /** @param {string} rel @param {string} [text] */
  const file = (rel, text = '') => {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'verify-py-layout-'))
    file('src/pkg/__init__.py', 'def f(): pass\n')
    file('tests/test_pkg.py', 'def test_f(): pass\n')
    file('tests/conftest.py')
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('passes a conforming layout', () => {
    const r = run(root)
    assert.equal(r.status, 0, r.out)
    assert.match(r.out, /1 test module\(s\) discoverable, 1 package dir\(s\)/)
  })

  it('rejects a tests/ module pytest would never collect', () => {
    file('tests/helpers_pkg.py', 'def test_hidden(): pass\n')
    const r = run(root)
    assert.equal(r.status, 1, r.out)
    assert.match(r.out, /tests\/helpers_pkg\.py: pytest never collects this name/)
  })

  it('accepts the *_test.py spelling', () => {
    file('tests/pkg_test.py', 'def test_g(): pass\n')
    const r = run(root)
    assert.equal(r.status, 0, r.out)
  })

  it('rejects a src/ directory holding modules without __init__.py', () => {
    file('src/pkg/sub/mod.py', 'x = 1\n')
    const r = run(root)
    assert.equal(r.status, 1, r.out)
    assert.match(r.out, /src\/pkg\/sub\/: holds Python modules but no __init__\.py/)
  })

  it('exits 2 when --root does not exist', () => {
    const r = run(join(root, 'missing'))
    assert.equal(r.status, 2, r.out)
    assert.ok(r.out.includes('--root'), r.out)
  })
})
