/**
 * Reject Markdown prose paragraphs that span more than one physical line
 * (`docs/AGENTS.md` § 写作规则: one physical line per paragraph; use editor soft-wrap).
 * Fenced code, tables, headings, HTML blocks, link definitions, and indented code are
 * structural and exempt. The frozen Agent Note archive and vendored trees are skipped.
 * With file arguments only those files are checked.
 */
import { markdownFiles, markdownLines, readText, resolveRoot } from './lib/repo-files.mjs'

const root = resolveRoot(import.meta.url)
const STRUCTURAL = /^(\s{0,3}#{1,6}\s|\s{0,3}>|\s*\||\s{0,3}<|\s{0,3}:::|\s{0,3}(-{3,}|={3,}|\*{3,}|_{3,})\s*$|\s{0,3}\[[^\]]+\]:|\s{4,}|\t)/
const LIST_ITEM = /^\s{0,3}([-*+]|\d{1,9}[.)])\s+/

function isProse(line) {
  return line.trim() !== '' && !STRUCTURAL.test(line)
}

// Positional arguments restrict the check to those files (the pre-commit hook passes staged .md files).
const argFiles = process.argv.slice(2).filter((a, i, all) => a !== '--root' && all[i - 1] !== '--root')
const files = argFiles.length > 0 ? argFiles.map(f => f.replace(/^\.\//, '')) : markdownFiles(root)
const violations = []
for (const rel of files) {
  const { lines, fenced } = markdownLines(readText(root, rel))
  let inFrontmatter = lines[0] === '---'
  let prev = null // { index, kind: 'prose' | 'item' }
  for (let i = 0; i < lines.length; i++) {
    if (inFrontmatter) { if (i > 0 && lines[i] === '---') inFrontmatter = false; continue }
    const line = lines[i]
    if (fenced[i] || line.trim() === '' || !isProse(line)) { prev = null; continue }
    const item = LIST_ITEM.test(line)
    if (prev !== null && !item) {
      violations.push({ rel, line: prev.index + 1, text: lines[prev.index].trim().slice(0, 60) })
      prev = null
      continue
    }
    prev = { index: i, kind: item ? 'item' : 'prose' }
  }
}

if (violations.length === 0) {
  console.log('verify-md-wrap: no hard-wrapped paragraphs.')
  process.exit(0)
}
console.error(`verify-md-wrap: ${violations.length} hard-wrapped paragraph(s); join each into one physical line (docs/AGENTS.md § 写作规则):`)
for (const v of violations) console.error(`  ${v.rel}:${v.line}: ${v.text}…`)
process.exit(1)
