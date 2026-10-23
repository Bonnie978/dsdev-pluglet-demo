import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

test('tags, PR and Issue numbers, code spans and marked lines pass', () => {
  const f = fixture({ 'docs/a.md': '# T\n\nSince v0.2.0 and PR #41 (Fixes #12). `git show 0123456789abcdef0123456789abcdef01234567` is code.\n\nDiagnosed at commit 0123456 <!-- commit-ref-ok --> release build.\n' })
  try { const r = runGate('verify-repository-references.mjs', f.root); assert.equal(r.status, 0, r.out) } finally { f.dispose() }
})

test('a 40-hex identifier or "commit <sha>" in prose fails with file:line', () => {
  const f = fixture({ 'docs/a.md': '# T\n\nSee 0123456789abcdef0123456789abcdef01234567 for details.\n\nFixed in commit 9f8e7d6.\n' })
  try { const r = runGate('verify-repository-references.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /docs\/a\.md:3/); assert.match(r.out, /docs\/a\.md:5: commit 9f8e7d6/) } finally { f.dispose() }
})
