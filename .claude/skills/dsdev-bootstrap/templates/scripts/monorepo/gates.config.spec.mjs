import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SCRIPTS, fixture } from './lib/gate-test-support.mjs'

const COV = 'node --test --experimental-test-coverage --test-coverage-lines=100 --test-coverage-branches=100'
const copy = rel => readFileSync(join(SCRIPTS, rel), 'utf8')

test('packages that share a directory basename get distinct tier gates, and check-all names each one', async () => {
  // gates.config reads the repository it lives in, so the fixture carries its own copy.
  const f = fixture({
    'scripts/gates.config.mjs': copy('gates.config.mjs'),
    'scripts/lib/repo-files.mjs': copy('lib/repo-files.mjs'),
    'scripts/lib/workspace.mjs': copy('lib/workspace.mjs'),
    'pnpm-workspace.yaml': 'packages:\n  - apps/*\n  - packages/*\n',
    'apps/api/package.json': JSON.stringify({ name: '@x/app-api', scripts: { 'test:e2e': COV } }),
    'packages/api/package.json': JSON.stringify({ name: '@x/api', scripts: { 'test:coverage': COV, 'test:e2e': COV } }),
  })
  try {
    const { gates, aggregates } = await import(pathToFileURL(join(f.root, 'scripts/gates.config.mjs')).href)
    const tiers = gates.filter(g => g.args[0] === '--filter').map(g => [g.id, g.args[1]])
    assert.deepEqual(tiers, [['e2e:apps/api', '@x/app-api'], ['coverage:packages/api', '@x/api'], ['e2e:packages/api', '@x/api']])
    assert.equal(new Set(gates.map(g => g.id)).size, gates.length, 'gate ids are unique')
    assert.deepEqual(aggregates['check-all'].filter(id => id.includes(':')), tiers.map(([id]) => id))
  } finally { f.dispose() }
})
