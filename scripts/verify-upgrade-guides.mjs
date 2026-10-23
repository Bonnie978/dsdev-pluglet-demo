/**
 * Enforce upgrade-guide layout: `docs/upgrade-guide/v<version>/<item>/guide.md` with
 * `kind: upgrade-guide` frontmatter, `## Change` + `## Migration` sections, and at most
 * MAX_WORDS words (600, CJK-aware); an item directory holds only guide files (no index, no attachments).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { countWords, resolveRoot } from './lib/repo-files.mjs'

const root = resolveRoot(import.meta.url)
const base = resolve(root, 'docs/upgrade-guide')
if (!existsSync(base)) { console.log('verify-upgrade-guides: no docs/upgrade-guide; nothing to check.'); process.exit(0) }

/** A guide states one break and its migration; longer text belongs in docs or an Agent Note.
 * DeepSeek Harness caps guides at 500 `wc -w` words; the CJK-aware count here runs higher for
 * Chinese prose, so the ceiling is 600. */
const MAX_WORDS = 600
const errors = []
let count = 0
for (const version of readdirSync(base).filter(v => statSync(join(base, v)).isDirectory())) {
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) { errors.push(`docs/upgrade-guide/${version}: directory must be v<semver>`); continue }
  for (const item of readdirSync(join(base, version)).filter(i => statSync(join(base, version, i)).isDirectory())) {
    const rel = `docs/upgrade-guide/${version}/${item}`
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item)) errors.push(`${rel}: item must be kebab-case`)
    const files = readdirSync(join(base, version, item))
    for (const f of files) if (!/^guide(\.[a-z]{2})?\.md$|^guide\.i18n\.yaml$/.test(f)) errors.push(`${rel}/${f}: only guide.md, guide.<lang>.md and guide.i18n.yaml are allowed`)
    if (!files.includes('guide.md')) { errors.push(`${rel}: missing guide.md`); continue }
    count++
    const text = readFileSync(join(base, version, item, 'guide.md'), 'utf8')
    if (!/^---\n(?:.*\n)*?kind:\s*upgrade-guide\n(?:.*\n)*?---\n/.test(text)) errors.push(`${rel}/guide.md: frontmatter must declare kind: upgrade-guide`)
    for (const req of ['## Change', '## Migration']) if (!text.split('\n').some(l => l.trim() === req)) errors.push(`${rel}/guide.md: missing \`${req}\``)
    const words = countWords(text)
    if (words > MAX_WORDS) errors.push(`${rel}/guide.md: ${words} words exceeds the ${MAX_WORDS}-word guide limit; move background to docs or an Agent Note and keep the reader's actions`)
  }
}

if (errors.length === 0) { console.log(`verify-upgrade-guides: ${count} guide(s) conform.`); process.exit(0) }
console.error('verify-upgrade-guides: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
