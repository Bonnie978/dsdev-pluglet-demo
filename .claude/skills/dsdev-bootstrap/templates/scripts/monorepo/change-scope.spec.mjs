import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixture, runGate } from './lib/gate-test-support.mjs'

const git = (root, ...args) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}
const COV = 'node --test --test-coverage-lines=100 --test-coverage-branches=100'
/** A committed three-package workspace a ← b ← c (c reaches a only transitively). */
function workspace() {
  const f = fixture({
    'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
    'packages/a/package.json': JSON.stringify({ name: '@x/a', scripts: { 'test:coverage': COV } }),
    'packages/a/src/index.mjs': 'export const a = 1\n',
    'packages/a/test/a.test.mjs': '\n',
    'packages/b/package.json': JSON.stringify({ name: '@x/b', dependencies: { '@x/a': 'workspace:*' }, scripts: { 'test:coverage': COV } }),
    'packages/b/src/index.mjs': 'export const b = 1\n',
    'packages/c/package.json': JSON.stringify({ name: '@x/c', dependencies: { '@x/b': 'workspace:*' }, scripts: { 'test:e2e': COV } }),
    'packages/c/src/bin.mjs': '\n',
  })
  git(f.root, 'init', '-q', '-b', 'main')
  git(f.root, 'add', '-A')
  git(f.root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init')
  return f
}
const scope = (root) => {
  const r = runGate('change-scope.mjs', root, '--base', 'main')
  assert.equal(r.status, 0, r.out)
  return JSON.parse(r.out)
}

test('a source change in a leaf dependency selects the owner and every transitive dependent', () => {
  const f = workspace()
  try {
    writeFileSync(join(f.root, 'packages/a/src/index.mjs'), 'export const a = 2\n')
    const s = scope(f.root)
    assert.deepEqual(s.packages.map(p => [p.name, p.why]), [['@x/a', ['changed src/index.mjs']], ['@x/b', ['depends on @x/a']], ['@x/c', ['depends on @x/a']]])
    assert.deepEqual(s.suggestedEvidence, ['pnpm --filter @x/a run test:coverage', 'pnpm --filter @x/b run test:coverage', 'pnpm --filter @x/c run test:e2e'])
  } finally { f.dispose() }
})

test('a test-only change selects only the owning package; a README selects only the doc gates', () => {
  const f = workspace()
  try {
    writeFileSync(join(f.root, 'packages/a/test/a.test.mjs'), '// changed\n')
    writeFileSync(join(f.root, 'packages/b/README.md'), '# b\n')
    const s = scope(f.root)
    assert.deepEqual(s.packages.map(p => p.name), ['@x/a'])
    assert.deepEqual(s.surfaces.docs, ['packages/b/README.md'])
    assert.deepEqual(s.suggestedEvidence, ['pnpm --filter @x/a run test:coverage', 'pnpm run test:docs'])
  } finally { f.dispose() }
})

test('scripts, manifests and unknown paths are reported as their own surfaces', () => {
  const f = workspace()
  try {
    writeFileSync(join(f.root, 'scripts.mjs'), '\n')
    writeFileSync(join(f.root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n# x\n')
    const s = scope(f.root)
    assert.deepEqual(s.packages, [])
    assert.deepEqual(s.surfaces.manifests, ['pnpm-workspace.yaml']); assert.deepEqual(s.surfaces.unclassified, ['scripts.mjs'])
    assert.deepEqual(s.suggestedEvidence, ['pnpm run hygiene', 'pnpm run typecheck'])
  } finally { f.dispose() }
})

test('a missing --base exits 2', () => {
  const f = workspace()
  try { const r = runGate('change-scope.mjs', f.root); assert.equal(r.status, 2); assert.match(r.out, /missing required --base/) } finally { f.dispose() }
})
