/**
 * Enforce the postmortem convention from `docs/postmortem/README.md`: every
 * `NNNN-slug.md` is listed in the README table, opens with `## Executive summary`,
 * carries the required sections (Root cause, Why every test missed it, Guardrails added),
 * and its guardrails and the postmortem link each other (README § 护栏互链):
 *
 * - `## Guardrails added` holds at least one relative Markdown link that resolves to a
 *   regular file inside the repository (image links and links in fenced code do not count).
 * - At least one back-link to the postmortem exists in a Markdown guardrail target, the
 *   root `AGENTS.md`, or a `docs/defensive-patterns/*.md` page. Only Markdown links count;
 *   non-Markdown targets (tests, source) are valid guardrails but are not searched.
 *
 *   node scripts/verify-postmortems.mjs [--root <dir>]
 *
 * `--root` points the gate at another checkout (the spec uses temporary fixtures); the
 * default is this repository. The gate is read-only.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { markdownLines, resolveRoot } from './lib/repo-files.mjs'

const rootArg = process.argv.indexOf('--root')
const root = rootArg === -1 ? repoRoot(import.meta.url) : resolve(process.argv[rootArg + 1] ?? '')
if (rootArg !== -1 && !existsSync(root)) { console.error(`verify-postmortems: --root ${root} does not exist`); process.exit(2) }
const dir = resolve(root, 'docs/postmortem')
if (!existsSync(dir)) { console.log('verify-postmortems: no docs/postmortem; nothing to check.'); process.exit(0) }

const RULE = 'docs/postmortem/README.md § 护栏互链'
const LINK = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const relOf = abs => abs.slice(root.length + 1).split(sep).join('/')

/** Relative Markdown links outside fenced code, each resolved against the file's directory. */
function localLinks(fileAbs, lines, fenced) {
  const out = []
  lines.forEach((line, i) => {
    if (fenced[i]) return
    for (const m of line.matchAll(LINK)) {
      const target = m[1]
      if (/^(https?:|mailto:|#|tel:|\/)/i.test(target)) continue
      const path = decodeURIComponent(target.split('#')[0])
      if (path === '') continue
      out.push({ target, line: i + 1, abs: resolve(dirname(fileAbs), path) })
    }
  })
  return out
}

const isRepoFile = abs => abs.startsWith(root + sep) && existsSync(abs) && statSync(abs).isFile()

/** Does the Markdown file at `abs` contain a relative link resolving to `postmortemAbs`? */
function linksTo(abs, postmortemAbs) {
  const { lines, fenced } = markdownLines(readFileSync(abs, 'utf8'))
  return localLinks(abs, lines, fenced).some(l => l.abs === postmortemAbs)
}

/** Files that may carry the back-link without being named as a guardrail: the standing rule homes. */
function ruleHomes() {
  const homes = []
  const agents = resolve(root, 'AGENTS.md')
  if (isRepoFile(agents)) homes.push(agents)
  const patterns = resolve(root, 'docs/defensive-patterns')
  if (existsSync(patterns)) for (const f of readdirSync(patterns)) if (f.endsWith('.md')) homes.push(resolve(patterns, f))
  return homes
}

const readme = readFileSync(resolve(dir, 'README.md'), 'utf8')
const REQUIRED = ['## Executive summary', '## Root cause', '## Why every test missed it', '## Guardrails added']
const errors = []
let count = 0
for (const file of readdirSync(dir).filter(f => /^\d{4}-[a-z0-9-]+\.md$/.test(f))) {
  count++
  const rel = `docs/postmortem/${file}`
  const abs = resolve(dir, file)
  const text = readFileSync(abs, 'utf8')
  if (!readme.includes(`](${file})`)) errors.push(`${rel}: not listed in docs/postmortem/README.md table`)
  const { lines, fenced } = markdownLines(text)
  const headings = lines.map((l, i) => (!fenced[i] && l.startsWith('## ') ? l.trim() : null))
  const h2s = headings.filter(h => h !== null)
  if (h2s[0] !== '## Executive summary') errors.push(`${rel}: first section must be \`## Executive summary\``)
  for (const req of REQUIRED) if (!h2s.some(h => h.startsWith(req))) errors.push(`${rel}: missing \`${req}\` section`)

  const start = headings.findIndex(h => h !== null && h.startsWith('## Guardrails added'))
  if (start === -1) continue
  let end = headings.findIndex((h, i) => i > start && h !== null)
  if (end === -1) end = lines.length
  const section = localLinks(abs, lines.slice(start, end), fenced.slice(start, end)).map(l => ({ ...l, line: l.line + start }))
  const resolved = []
  for (const link of section) {
    if (isRepoFile(link.abs)) resolved.push(link.abs)
    else errors.push(`${rel}:${link.line}: guardrail link ${link.target} does not resolve to a file in the repository (${RULE})`)
  }
  if (section.length === 0) { errors.push(`${rel}: \`## Guardrails added\` has no relative Markdown link to a guardrail; link each test, rule or note it added (${RULE})`); continue }
  if (resolved.length === 0) continue

  const candidates = [...new Set([...resolved.filter(a => a.endsWith('.md')), ...ruleHomes()])]
  if (!candidates.some(c => linksTo(c, abs))) {
    errors.push(`${rel}: no guardrail links back; add a link to ${rel} in one of: ${candidates.map(relOf).join(', ')} (${RULE})`)
  }
}

if (errors.length === 0) { console.log(`verify-postmortems: ${count} postmortem(s) conform; guardrails and postmortems link each other.`); process.exit(0) }
console.error('verify-postmortems: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
