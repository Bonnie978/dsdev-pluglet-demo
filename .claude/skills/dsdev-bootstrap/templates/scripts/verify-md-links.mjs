/**
 * Check that relative Markdown links resolve: the target file exists and, when the link carries
 * a `#fragment` pointing into a Markdown file, that file has a heading whose GitHub-style slug or
 * an explicit `<a id="…">` / `id="…"` equals the fragment. Pure-anchor links (`#x`) are checked
 * against the linking file itself. External URLs and mailto are not checked. Links inside fenced
 * code and inline code spans are ignored. Archived Agent Notes are skipped as sources.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { markdownFiles, markdownLines, readText, resolveRoot } from './lib/repo-files.mjs'

const root = resolveRoot(import.meta.url)
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/** GitHub heading slug: lowercase, drop punctuation except `-` and `_`, spaces to `-`; repeats get `-1`, `-2`. */
function slug(text) {
  return text.trim().toLowerCase()
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const anchorCache = new Map()
function anchorsOf(abs) {
  if (anchorCache.has(abs)) return anchorCache.get(abs)
  const { lines, fenced } = markdownLines(readFileSync(abs, 'utf8'))
  const anchors = new Set()
  const seen = new Map()
  lines.forEach((line, i) => {
    if (fenced[i]) return
    const h = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (h) {
      const base = slug(h[1])
      const n = seen.get(base) ?? 0
      seen.set(base, n + 1)
      anchors.add(n === 0 ? base : `${base}-${n}`)
    }
    for (const m of line.matchAll(/\b(?:id|name)="([^"]+)"/g)) anchors.add(m[1])
  })
  anchorCache.set(abs, anchors)
  return anchors
}

const broken = []
let checked = 0
for (const rel of markdownFiles(root)) {
  const { lines, fenced } = markdownLines(readText(root, rel))
  lines.forEach((line, i) => {
    if (fenced[i]) return
    const prose = line.replace(/`[^`]*`/g, '')
    for (const m of prose.matchAll(LINK)) {
      const target = m[1]
      if (/^(https?:|mailto:|tel:)/i.test(target)) continue
      const [rawPath, rawFragment] = target.split('#')
      const path = decodeURIComponent(rawPath)
      const abs = path === '' ? resolve(root, rel) : resolve(root, dirname(rel), path)
      checked++
      if (!existsSync(abs)) { broken.push(`${rel}:${i + 1}: ${target}`); continue }
      if (rawFragment === undefined || rawFragment === '' || !abs.endsWith('.md') || statSync(abs).isDirectory()) continue
      const fragment = decodeURIComponent(rawFragment).toLowerCase()
      if (!anchorsOf(abs).has(fragment)) broken.push(`${rel}:${i + 1}: ${target} (no heading or id "${fragment}" in ${relative(root, abs)})`)
    }
  })
}

if (broken.length === 0) {
  console.log(`verify-md-links: ${checked} local link(s) and their anchors resolve.`)
  process.exit(0)
}
console.error(`verify-md-links: ${broken.length} broken local link(s):`)
for (const b of broken) console.error(`  ${b}`)
process.exit(1)
