/**
 * Check that relative Markdown links resolve to existing files. External URLs,
 * mailto, and pure-anchor links are not checked; anchors on local targets are stripped.
 * Links inside fenced code are ignored. Archived Agent Notes are skipped as sources.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { markdownFiles, markdownLines, readText, repoRoot } from './lib/repo-files.mjs'

const root = repoRoot(import.meta.url)
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

const broken = []
let checked = 0
for (const rel of markdownFiles(root)) {
  const { lines, fenced } = markdownLines(readText(root, rel))
  lines.forEach((line, i) => {
    if (fenced[i]) return
    for (const m of line.matchAll(LINK)) {
      const target = m[1]
      if (/^(https?:|mailto:|#|tel:)/i.test(target)) continue
      const path = decodeURIComponent(target.split('#')[0])
      if (path === '') continue
      checked++
      const abs = resolve(root, dirname(rel), path)
      if (!existsSync(abs)) broken.push(`${rel}:${i + 1}: ${target}`)
    }
  })
}

if (broken.length === 0) {
  console.log(`verify-md-links: ${checked} local link(s) resolve.`)
  process.exit(0)
}
console.error(`verify-md-links: ${broken.length} broken local link(s):`)
for (const b of broken) console.error(`  ${b}`)
process.exit(1)
