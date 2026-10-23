import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fixture, note, runGate } from './lib/gate-test-support.mjs'

const archived = note('implemented', 'Archived: 2026-02-03')
const rel = '.agents/notes/archived/process/2026-01-02-topic.md'

test('an archived note without a seal fails; --write seals it; the sealed tree passes', () => {
  const f = fixture({ [rel]: archived })
  try {
    let r = runGate('verify-archived-agent-notes.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /archived but not sealed/)
    r = runGate('verify-archived-agent-notes.mjs', f.root, '--write'); assert.equal(r.status, 0, r.out)
    assert.ok(JSON.parse(readFileSync(join(f.root, '.agents/notes/archived/manifest.json'), 'utf8'))[rel])
    r = runGate('verify-archived-agent-notes.mjs', f.root); assert.equal(r.status, 0, r.out)
  } finally { f.dispose() }
})

test('editing a sealed note fails, and --write refuses to re-seal it', () => {
  const f = fixture({ [rel]: archived })
  try {
    runGate('verify-archived-agent-notes.mjs', f.root, '--write')
    writeFileSync(join(f.root, rel), archived.replace('D.', 'D changed.'))
    let r = runGate('verify-archived-agent-notes.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /differs from its sealed hash/)
    r = runGate('verify-archived-agent-notes.mjs', f.root, '--write'); assert.equal(r.status, 1); assert.match(r.out, /refused/)
  } finally { f.dispose() }
})

test('a sealed note that was deleted fails', () => {
  const f = fixture({ [rel]: archived })
  try {
    runGate('verify-archived-agent-notes.mjs', f.root, '--write')
    writeFileSync(join(f.root, '.agents/notes/archived/manifest.json'), JSON.stringify({ [rel]: 'deadbeef', '.agents/notes/archived/process/2026-01-03-gone.md': 'cafe' }))
    const r = runGate('verify-archived-agent-notes.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /gone\.md: sealed in manifest\.json but the file is gone/)
  } finally { f.dispose() }
})
