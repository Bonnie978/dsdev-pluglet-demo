import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

const manifest = (m) => ({ 'scripts/doc-budgets.manifest.json': JSON.stringify(m) })

test('a document within its ceiling passes', () => {
  const f = fixture({ ...manifest({ 'AGENTS.md': 10 }), 'AGENTS.md': 'one two three\n' })
  try { assert.equal(runGate('verify-doc-budgets.mjs', f.root).status, 0) } finally { f.dispose() }
})

test('exceeding the ceiling fails and names the file and counts', () => {
  const f = fixture({ ...manifest({ 'AGENTS.md': 2 }), 'AGENTS.md': 'one two three\n' })
  try { const r = runGate('verify-doc-budgets.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /AGENTS\.md: 3 words exceeds the 2-word ceiling/) } finally { f.dispose() }
})

test('CJK characters each count as a word', () => {
  const f = fixture({ ...manifest({ 'AGENTS.md': 4 }), 'AGENTS.md': '中文五个字符\n' })
  try { const r = runGate('verify-doc-budgets.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /6 words/) } finally { f.dispose() }
})

test('a budgeted file that does not exist fails', () => {
  const f = fixture(manifest({ 'docs/missing.md': 100 }))
  try { const r = runGate('verify-doc-budgets.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /does not exist/) } finally { f.dispose() }
})
