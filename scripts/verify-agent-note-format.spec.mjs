import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, note, runGate } from './lib/gate-test-support.mjs'

const at = (lifecycle, cls, body) => ({ [`.agents/notes/${lifecycle}/${cls}/2026-01-02-topic-title.md`]: body })

test('valid proposed, implemented and rejected notes pass', () => {
  const f = fixture({ ...at('proposed', 'feature', note('proposed')), ...at('implemented', 'process', note('implemented')), ...at('rejected', 'simplification', note('rejected')) })
  try { const r = runGate('verify-agent-note-format.mjs', f.root); assert.equal(r.status, 0, r.out); assert.match(r.out, /3 Agent Note/) } finally { f.dispose() }
})

test('status line must match the lifecycle folder', () => {
  const f = fixture(at('implemented', 'process', note('implemented').replace('Status: implemented', 'Status: done')))
  try { const r = runGate('verify-agent-note-format.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /line 3 must match/) } finally { f.dispose() }
})

test('implemented notes reject proposal-era headings and require Alternatives considered', () => {
  const f = fixture(at('implemented', 'process', note('implemented').replace('## Decision', '## Proposal').replace('## Alternatives considered\n\n- **X.** Lost.\n\n', '')))
  try { const r = runGate('verify-agent-note-format.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /spec-speak/); assert.match(r.out, /missing `## Alternatives considered`/) } finally { f.dispose() }
})

test('unknown class folders and undated filenames are rejected', () => {
  const f = fixture({ '.agents/notes/implemented/refactor/2026-01-02-x.md': note('implemented'), '.agents/notes/implemented/process/topic.md': note('implemented') })
  try { const r = runGate('verify-agent-note-format.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /not a class folder/); assert.match(r.out, /filename must be/) } finally { f.dispose() }
})

test('archived notes need the Archived: line under the status', () => {
  const ok = note('implemented', 'Archived: 2026-02-03')
  const f = fixture({ '.agents/notes/archived/process/2026-01-02-a.md': ok, '.agents/notes/archived/process/2026-01-02-b.md': note('implemented') })
  try { const r = runGate('verify-agent-note-format.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /2026-01-02-b\.md — line 4 must be `Archived: YYYY-MM-DD`/); assert.doesNotMatch(r.out, /2026-01-02-a\.md/) } finally { f.dispose() }
})
