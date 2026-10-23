import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

test('a root without any lockfile fails and names the accepted lockfiles', () => {
  const f = fixture({ 'package.json': '{"name":"x","version":"0.0.0"}\n' })
  try { const r = runGate('verify-lockfile.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /no lockfile \(pnpm-lock\.yaml, yarn\.lock, package-lock\.json, bun\.lock\)/) } finally { f.dispose() }
})

test('a lockfile that does not match package.json fails naming the package manager', () => {
  // A pnpm lockfile for an empty manifest versus a manifest that declares a dependency.
  const f = fixture({
    'package.json': '{"name":"x","version":"0.0.0","devDependencies":{"left-pad":"^1.3.0"}}\n',
    'pnpm-lock.yaml': "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n",
  })
  try {
    const r = runGate('verify-lockfile.mjs', f.root)
    if (/command not found|ENOENT|spawnSync pnpm/.test(r.out)) return // no pnpm on this host: the detection path above is still covered
    assert.equal(r.status, 1); assert.match(r.out, /pnpm-lock\.yaml does not match package\.json \(pnpm/)
  } finally { f.dispose() }
})
