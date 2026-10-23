/**
 * Enforce word ceilings (whitespace tokens plus one per CJK character) from `scripts/doc-budgets.manifest.json`.
 * Missing budgeted files and invalid ceilings fail; `--list` reports current usage.
 * Raising a ceiling requires the justification defined in `docs/AGENTS.md`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { repoRoot } from './lib/repo-files.mjs'

const root = repoRoot(import.meta.url)
const manifestPath = resolve(root, 'scripts/doc-budgets.manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const listOnly = process.argv.includes('--list')
// `wc -w` counts whitespace-delimited tokens, which makes CJK prose nearly free; count each
// CJK character as one word so Chinese and English documents spend the budget alike.
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g
const countWords = text => text.split(/\s+/).filter(Boolean).reduce((n, token) => {
  const cjk = token.match(CJK)?.length ?? 0
  const rest = token.replace(CJK, '').trim() === '' ? 0 : 1
  return n + cjk + rest
}, 0)

const failures = []
const rows = []
for (const [path, ceiling] of Object.entries(manifest)) {
  if (!Number.isInteger(ceiling) || ceiling <= 0) { failures.push(`${path}: ceiling must be a positive integer, got ${ceiling}`); continue }
  const abs = resolve(root, path)
  if (!existsSync(abs)) { rows.push(`MISS  ${'—'.padStart(6)} / ${String(ceiling).padEnd(6)} ${path}`); failures.push(`${path}: budgeted file does not exist (renamed or deleted? update scripts/doc-budgets.manifest.json in the same change)`); continue }
  const words = countWords(readFileSync(abs, 'utf8'))
  rows.push(`${words <= ceiling ? 'ok  ' : 'OVER'}  ${String(words).padStart(6)} / ${String(ceiling).padEnd(6)} ${path}`)
  if (words > ceiling) failures.push(`${path}: ${words} words exceeds the ${ceiling}-word ceiling — relocate or condense per docs/AGENTS.md (raising the ceiling requires justification in the PR)`)
}

if (listOnly) { console.log(rows.join('\n')); process.exit(0) }
if (failures.length > 0) {
  console.error('verify-doc-budgets failed:\n')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`verify-doc-budgets: ${Object.keys(manifest).length} budgeted docs within ceiling.`)
