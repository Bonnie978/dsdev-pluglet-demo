import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixture, SCRIPTS } from './lib/gate-test-support.mjs'

/** A fixture root with run-gates, its lib, and a gates.config.mjs built from `config`. */
function runner(config) {
  const f = fixture({})
  mkdirSync(join(f.root, 'scripts'), { recursive: true })
  cpSync(join(SCRIPTS, 'run-gates.mjs'), join(f.root, 'scripts/run-gates.mjs'))
  cpSync(join(SCRIPTS, 'lib'), join(f.root, 'scripts/lib'), { recursive: true })
  writeFileSync(join(f.root, 'scripts/gates.config.mjs'), config)
  return { ...f, run: mode => spawnSync(process.execPath, [join(f.root, 'scripts/run-gates.mjs'), mode], { encoding: 'utf8', cwd: f.root }) }
}

const sh = (code) => `{ command: process.execPath, args: ['-e', 'process.exit(${code})'] }`

test('a failing gate fails the aggregate and skips its dependents; independent gates still run', () => {
  const f = runner(`export const gates = [
  { id: 'a', label: 'a', ...${sh(1)} },
  { id: 'b', label: 'b', needs: ['a'], ...${sh(0)} },
  { id: 'c', label: 'c', ...${sh(0)} },
]
export const aggregates = { all: ['a', 'b', 'c'] }
`)
  try { const r = f.run('all'); assert.equal(r.status, 1); assert.match(r.stdout, /FAILED {2}a/); assert.match(r.stdout, /skipped b \(dependency failed\)/); assert.match(r.stdout, /ok {6}c/) } finally { f.dispose() }
})

test('allowFailure keeps a failure visible without failing the aggregate', () => {
  const f = runner(`export const gates = [{ id: 'a', label: 'a', allowFailure: true, ...${sh(1)} }]\nexport const aggregates = { all: ['a'] }\n`)
  try { const r = f.run('all'); assert.equal(r.status, 0, r.stdout); assert.match(r.stdout, /\[allowed\]/) } finally { f.dispose() }
})

test('an empty aggregate and an unknown aggregate are refused', () => {
  const f = runner(`export const gates = [{ id: 'a', label: 'a', ...${sh(0)} }]\nexport const aggregates = { all: ['a'], empty: [] }\n`)
  try {
    assert.equal(f.run('empty').status, 2); assert.match(f.run('empty').stderr, /names no gates/)
    assert.equal(f.run('nope').status, 2)
  } finally { f.dispose() }
})
