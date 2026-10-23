import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

test('accepts one-line paragraphs, lists, tables and fenced code', () => {
  const f = fixture({ 'docs/a.md': '# T\n\nOne paragraph.\n\n- item\n- item two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\nline\nline\n```\n' })
  try { const r = runGate('verify-md-wrap.mjs', f.root); assert.equal(r.status, 0, r.out) } finally { f.dispose() }
})

test('rejects a paragraph spanning two physical lines, naming file and line', () => {
  const f = fixture({ 'docs/a.md': '# T\n\nfirst line of a paragraph\nsecond line of the same\n' })
  try { const r = runGate('verify-md-wrap.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /docs\/a\.md:3/) } finally { f.dispose() }
})

test('checks only the files named as arguments', () => {
  const f = fixture({ 'docs/bad.md': '# T\n\na\nb\n', 'docs/good.md': '# T\n\nok\n' })
  try {
    assert.equal(runGate('verify-md-wrap.mjs', f.root, 'docs/good.md').status, 0)
    assert.equal(runGate('verify-md-wrap.mjs', f.root, 'docs/bad.md').status, 1)
  } finally { f.dispose() }
})

test('skips the frozen archive', () => {
  const f = fixture({ '.agents/notes/archived/process/2026-01-01-x.md': '# T\n\na\nb\n' })
  try { assert.equal(runGate('verify-md-wrap.mjs', f.root).status, 0) } finally { f.dispose() }
})

test('skips build output only at the root; a nested lib/ directory is source and is checked', () => {
  const f = fixture({ 'lib/out.md': '# T\n\na\nb\n', 'src/lib/notes.md': '# T\n\na\nb\n' })
  try { const r = runGate('verify-md-wrap.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /src\/lib\/notes\.md:3/); assert.doesNotMatch(r.out, /lib\/out\.md/) } finally { f.dispose() }
})
