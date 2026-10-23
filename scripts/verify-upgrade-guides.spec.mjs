import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

const guide = (body = '## Change\n\nOld → new.\n\n## Migration\n\n1. Do X.\n') => `---\nkind: upgrade-guide\ndescription: "x"\n---\n\n# Break\n\n${body}`

test('a well-formed guide passes', () => {
  const f = fixture({ 'docs/upgrade-guide/v0.1.0/flag-rename/guide.md': guide() })
  try { assert.equal(runGate('verify-upgrade-guides.mjs', f.root).status, 0) } finally { f.dispose() }
})

test('wrong frontmatter kind and a missing Migration section fail', () => {
  const f = fixture({ 'docs/upgrade-guide/v0.1.0/flag-rename/guide.md': guide('## Change\n\nx\n').replace('kind: upgrade-guide', 'kind: other') })
  try { const r = runGate('verify-upgrade-guides.mjs', f.root); assert.equal(r.status, 1); assert.match(r.out, /kind: upgrade-guide/); assert.match(r.out, /missing `## Migration`/) } finally { f.dispose() }
})

test('non-semver version dirs, non-kebab items, extra files and over-long guides fail', () => {
  const long = guide(`## Change\n\n${'word '.repeat(620)}\n\n## Migration\n\n1. x\n`)
  const f = fixture({ 'docs/upgrade-guide/v1/x/guide.md': guide(), 'docs/upgrade-guide/v1.0.0/Bad_Name/guide.md': guide(), 'docs/upgrade-guide/v1.0.0/ok/guide.md': long, 'docs/upgrade-guide/v1.0.0/ok/notes.txt': 'x' })
  try {
    const r = runGate('verify-upgrade-guides.mjs', f.root); assert.equal(r.status, 1)
    assert.match(r.out, /v1: directory must be v<semver>/); assert.match(r.out, /item must be kebab-case/); assert.match(r.out, /notes\.txt: only guide\.md/); assert.match(r.out, /exceeds the 600-word guide limit/)
  } finally { f.dispose() }
})
