/**
 * Maintained prose refers to history by tag, Issue or PR number, never by commit identifier:
 * a hash means nothing to a reader without the repository and rots on rebase
 * (docs/AGENTS.md § 仓库引用). Rejects 40-hex and `commit <7+ hex>` references in Markdown prose
 * outside fenced code, inline code and the frozen archive. Allowed exception: a line carrying
 * `<!-- commit-ref-ok -->` (for example a postmortem quoting the exact release it diagnosed).
 */
import { markdownFiles, markdownLines, readText, resolveRoot } from './lib/repo-files.mjs'

const root = resolveRoot(import.meta.url)
const FULL = /\b[0-9a-f]{40}\b/g
const SHORT = /\b(?:commit|sha|rev|revision)\s+[0-9a-f]{7,40}\b/gi

const hits = []
for (const rel of markdownFiles(root)) {
  const { lines, fenced } = markdownLines(readText(root, rel))
  lines.forEach((line, i) => {
    if (fenced[i] || line.includes('<!-- commit-ref-ok -->')) return
    const prose = line.replace(/`[^`]*`/g, '')
    for (const m of [...prose.matchAll(FULL), ...prose.matchAll(SHORT)]) hits.push(`${rel}:${i + 1}: ${m[0]}`)
  })
}
if (hits.length === 0) { console.log('verify-repository-references: no commit identifiers in maintained prose.'); process.exit(0) }
console.error(`verify-repository-references: ${hits.length} commit reference(s); cite a tag, Issue or PR instead, or mark the line <!-- commit-ref-ok --> with a reason (docs/AGENTS.md § 仓库引用):`)
for (const h of hits) console.error(`  ${h}`)
process.exit(1)
