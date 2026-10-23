/**
 * Seal the frozen Agent Note archive. `.agents/notes/archived/manifest.json` records the SHA-256
 * of every archived note; the default (read-only) mode fails when an archived file is missing
 * from the manifest, differs from its recorded hash, or a manifest entry has no file. `--write`
 * is append-only: it first proves every existing entry still matches, then adds entries for new
 * files; it never updates or removes an existing hash, because sealed notes are never edited.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveRoot, walk } from './lib/repo-files.mjs'

const root = resolveRoot(import.meta.url)
const archive = resolve(root, '.agents/notes/archived')
const manifestPath = resolve(archive, 'manifest.json')
const write = process.argv.includes('--write')

if (!existsSync(archive)) { console.log('verify-archived-agent-notes: no archive; nothing to check.'); process.exit(0) }

const files = walk(root, rel => rel.startsWith('.agents/notes/archived/') && rel.endsWith('.md') && !rel.endsWith('/AGENTS.md'), { includeArchived: true })
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
const hash = rel => createHash('sha256').update(readFileSync(resolve(root, rel))).digest('hex')

const errors = []
for (const [rel, recorded] of Object.entries(manifest)) {
  if (!existsSync(resolve(root, rel))) { errors.push(`${rel}: sealed in manifest.json but the file is gone (archived notes are never deleted)`); continue }
  if (hash(rel) !== recorded) errors.push(`${rel}: content differs from its sealed hash (archived notes are never edited; .agents/notes/archived/AGENTS.md)`)
}
const unsealed = files.filter(rel => !(rel in manifest))

if (write) {
  if (errors.length > 0) {
    console.error('verify-archived-agent-notes --write refused: existing seals must hold before new ones are added:')
    for (const e of errors) console.error(`  ${e}`)
    process.exit(1)
  }
  for (const rel of unsealed) manifest[rel] = hash(rel)
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`verify-archived-agent-notes: sealed ${unsealed.length} new note(s); ${Object.keys(sorted).length} total.`)
  process.exit(0)
}

for (const rel of unsealed) errors.push(`${rel}: archived but not sealed; run \`node scripts/verify-archived-agent-notes.mjs --write\` in the archiving change`)
if (errors.length === 0) { console.log(`verify-archived-agent-notes: ${files.length} archived note(s) match their seals.`); process.exit(0) }
console.error('verify-archived-agent-notes: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
