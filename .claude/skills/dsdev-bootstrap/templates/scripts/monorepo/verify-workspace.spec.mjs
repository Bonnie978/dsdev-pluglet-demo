import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

const COV = 'node --test --experimental-test-coverage --test-coverage-lines=100 --test-coverage-branches=100'
const pkg = (name, extra = {}) => JSON.stringify({ name, exports: './src/index.mjs', scripts: { test: 'node --test', 'test:coverage': COV }, ...extra })
const valid = () => ({
  'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
  'tsconfig.json': JSON.stringify({ files: [], references: [{ path: 'packages/a' }, { path: 'packages/b' }] }),
  'packages/a/package.json': pkg('@x/a'),
  'packages/a/tsconfig.json': '{}',
  'packages/a/README.md': '# a\n',
  'packages/b/package.json': pkg('@x/b', { bin: { b: './src/bin.mjs' }, dependencies: { '@x/a': 'workspace:*' }, scripts: { test: 'node --test', 'test:coverage': COV, 'test:e2e': COV } }),
  'packages/b/tsconfig.json': JSON.stringify({ references: [{ path: '../a' }] }),
  'packages/b/README.md': '# b\n',
})

test('a fully registered workspace passes and names its packages', () => {
  const f = fixture(valid())
  try { const r = runGate('verify-workspace.mjs', f.root); assert.equal(r.status, 0, r.out); assert.match(r.out, /2 package\(s\) registered \(a, b\)/) } finally { f.dispose() }
})

test('a tsconfig that does not reference a workspace dependency is named', () => {
  const f = fixture({ ...valid(), 'packages/b/tsconfig.json': '{}' })
  try { const r = runGate('verify-workspace.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /packages\/b\/tsconfig\.json: references lacks packages\/a/) } finally { f.dispose() }
})

test('missing README, missing tier scripts and weak thresholds are each named', () => {
  const files = valid()
  delete files['packages/a/README.md']
  files['packages/a/package.json'] = JSON.stringify({ name: '@x/a', exports: './src/index.mjs', scripts: { test: 'node --test' } })
  files['packages/b/package.json'] = pkg('@x/b', { bin: { b: './src/bin.mjs' }, dependencies: { '@x/a': 'workspace:*' }, scripts: { test: 'node --test', 'test:coverage': 'node --test --test-coverage-lines=100' } })
  const f = fixture(files)
  try {
    const r = runGate('verify-workspace.mjs', f.root); assert.equal(r.status, 1)
    assert.match(r.out, /packages\/a: missing README\.md/)
    assert.match(r.out, /packages\/a\/package\.json: has exports but no scripts\["test:coverage"\]/)
    assert.match(r.out, /packages\/a\/package\.json: declares no test tier/)
    assert.match(r.out, /packages\/b\/package\.json: has bin but no scripts\["test:e2e"\]/)
    assert.match(r.out, /packages\/b\/package\.json: scripts\["test:coverage"\] lacks --test-coverage-branches=100/)
  } finally { f.dispose() }
})

test('a non-workspace range for a workspace package and a root tsconfig gap are named', () => {
  const files = valid()
  files['packages/b/package.json'] = pkg('@x/b', { dependencies: { '@x/a': '^0.1.0' } })
  files['tsconfig.json'] = JSON.stringify({ files: [], references: [{ path: 'packages/a' }] })
  const f = fixture(files)
  try {
    const r = runGate('verify-workspace.mjs', f.root); assert.equal(r.status, 1)
    assert.match(r.out, /@x\/a must use the workspace: protocol/); assert.match(r.out, /tsconfig\.json: references lacks packages\/b/)
  } finally { f.dispose() }
})

test('an unsupported workspace glob fails instead of matching nothing', () => {
  const f = fixture({ ...valid(), 'pnpm-workspace.yaml': 'packages:\n  - "packages/**"\n' })
  try { const r = runGate('verify-workspace.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /unsupported pnpm-workspace\.yaml glob "packages\/\*\*"/) } finally { f.dispose() }
})
