import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

test('resolving relative links, anchors, URLs and inline-code examples pass', () => {
  const f = fixture({ 'docs/a.md': '# T\n\n[b](b.md#b) [u](https://x.y) [a](#t) `[ex](nope.md)`\n', 'docs/b.md': '# B\n' })
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

test('anchors resolve against GitHub heading slugs, explicit ids and repeated headings, including CJK', () => {
  const f = fixture({
    'docs/a.md': '# T\n\n[x](b.md#校验先判类别再探测字段) [y](b.md#run-relevant-checks-locally) [z](b.md#dup-1) [w](b.md#explicit) [self](#t)\n',
    'docs/b.md': '# B\n\n## 校验先判类别再探测字段\n\n### Run relevant checks locally\n\n## Dup\n\n## Dup\n\n<a id="explicit"></a>\n',
  })
  try { const r = runGate('verify-md-links.mjs', f.root); assert.equal(r.status, 0, r.out) } finally { f.dispose() }
})

test('a fragment with no matching heading or id fails and names the target file', () => {
  const f = fixture({ 'docs/a.md': '# T\n\n[x](b.md#gone) [self](#nope)\n', 'docs/b.md': '# B\n\n## Here\n' })
  try {
    const r = runGate('verify-md-links.mjs', f.root); assert.equal(r.status, 1)
    assert.match(r.out, /b\.md#gone \(no heading or id "gone" in docs\/b\.md\)/); assert.match(r.out, /#nope/)
  } finally { f.dispose() }
})
