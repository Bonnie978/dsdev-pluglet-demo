import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

test('resolving relative links, anchors, URLs and inline-code examples pass', () => {
  const f = fixture({ 'docs/a.md': '# T\n\n[b](b.md#x) [u](https://x.y) [a](#here) `[ex](nope.md)`\n', 'docs/b.md': '# B\n' })
  try { const r = runGate('verify-md-links.mjs', f.root); assert.equal(r.status, 0, r.out) } finally { f.dispose() }
})

test('a link to a missing file fails with file:line', () => {
  const f = fixture({ 'docs/a.md': '# T\n\nsee [gone](./gone.md)\n' })
  try { const r = runGate('verify-md-links.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /docs\/a\.md:3: \.\/gone\.md/) } finally { f.dispose() }
})

test('links inside fenced code are not checked', () => {
  const f = fixture({ 'docs/a.md': '# T\n\n```md\n[x](missing.md)\n```\n' })
  try { assert.equal(runGate('verify-md-links.mjs', f.root).status, 0) } finally { f.dispose() }
})
