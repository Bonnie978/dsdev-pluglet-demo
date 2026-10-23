/**
 * Enforce the postmortem convention from `docs/postmortem/README.md`: every
 * `NNNN-slug.md` is listed in the README table, opens with `## Executive summary`,
 * and carries the required sections (Root cause, Why every test missed it, Guardrails added).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { repoRoot } from './lib/repo-files.mjs'

const root = repoRoot(import.meta.url)
const dir = resolve(root, 'docs/postmortem')
if (!existsSync(dir)) { console.log('verify-postmortems: no docs/postmortem; nothing to check.'); process.exit(0) }

const readme = readFileSync(resolve(dir, 'README.md'), 'utf8')
const REQUIRED = ['## Executive summary', '## Root cause', '## Why every test missed it', '## Guardrails added']
const errors = []
let count = 0
for (const file of readdirSync(dir).filter(f => /^\d{4}-[a-z0-9-]+\.md$/.test(f))) {
  count++
  const rel = `docs/postmortem/${file}`
  const text = readFileSync(resolve(dir, file), 'utf8')
  if (!readme.includes(`](${file})`)) errors.push(`${rel}: not listed in docs/postmortem/README.md table`)
  const h2s = text.split('\n').filter(l => l.startsWith('## ')).map(l => l.trim())
  if (h2s[0] !== '## Executive summary') errors.push(`${rel}: first section must be \`## Executive summary\``)
  for (const req of REQUIRED) if (!h2s.some(h => h.startsWith(req))) errors.push(`${rel}: missing \`${req}\` section`)
}

if (errors.length === 0) { console.log(`verify-postmortems: ${count} postmortem(s) conform.`); process.exit(0) }
console.error('verify-postmortems: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
