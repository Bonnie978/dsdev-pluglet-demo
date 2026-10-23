/**
 * Enforce the Agent Note tree and in-file format from `.agents/notes/README.md`:
 * closed lifecycle/class folders, dated filenames, the three-line header, the
 * `## Problem` opener, lifecycle-specific required and banned sections, the mandatory
 * `## Alternatives considered`, and the `Archived:` line in the frozen tree.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { repoRoot } from './lib/repo-files.mjs'

const root = repoRoot(import.meta.url)
const notesRoot = resolve(root, '.agents/notes')
const LIFECYCLES = ['proposed', 'implemented', 'rejected', 'archived']
const CLASSES = new Set(['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'])
const FILENAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const STATUS = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  rejected: /^Status: rejected — .+$/,
  archived: /^Status: implemented$/,
}
const REQUIRED = {
  proposed: ['## Proposal', '## Acceptance criteria', '## Risks'],
  implemented: ['## Decision', '## Consequences'],
  rejected: ['## Proposal'],
  archived: [],
}
const BANNED_IMPLEMENTED = /^## (?:Proposal\b|Plan\b|Migration plan\b|Acceptance criteria\b)/i

const errors = []
let count = 0

if (!existsSync(notesRoot)) {
  console.log('verify-agent-note-format: no .agents/notes tree; nothing to check.')
  process.exit(0)
}

for (const entry of readdirSync(notesRoot)) {
  const abs = join(notesRoot, entry)
  if (!statSync(abs).isDirectory()) continue
  if (!LIFECYCLES.includes(entry)) { errors.push(`tree: .agents/notes/${entry}/ is not a lifecycle folder (${LIFECYCLES.join(', ')})`); continue }
  for (const cls of readdirSync(abs)) {
    const clsAbs = join(abs, cls)
    if (!statSync(clsAbs).isDirectory()) continue
    if (!CLASSES.has(cls)) { errors.push(`tree: .agents/notes/${entry}/${cls}/ is not a class folder (${[...CLASSES].join(', ')})`); continue }
    for (const file of readdirSync(clsAbs)) {
      if (!file.endsWith('.md') || /\.zh\.md$/.test(file)) continue
      const rel = `.agents/notes/${entry}/${cls}/${file}`
      count++
      const fail = msg => errors.push(`format: ${rel} — ${msg}`)
      if (!FILENAME.test(file)) fail('filename must be yyyy-mm-dd-topic-title.md')
      const lines = readFileSync(join(clsAbs, file), 'utf8').split('\n')
      let inFence = false
      const prose = lines.filter(l => { if (l.startsWith('```')) { inFence = !inFence; return false } return !inFence })
      if (!/^# Agent Note: \S/.test(lines[0] ?? '')) fail('line 1 must be `# Agent Note: <title>`')
      if (lines[1] !== '') fail('line 2 must be blank')
      if (!STATUS[entry].test(lines[2] ?? '')) fail(`line 3 must match ${String(STATUS[entry])}`)
      if (entry === 'archived') {
        if (!/^Archived: \d{4}-\d{2}-\d{2}$/.test(lines[3] ?? '')) fail('line 4 must be `Archived: YYYY-MM-DD` in the frozen tree')
      } else if (lines[3] !== '') fail('line 4 must be blank')
      const statusLines = prose.filter(l => l.startsWith('Status:'))
      if (statusLines.length !== 1) fail('exactly one `Status:` line is allowed')
      const h2s = prose.filter(l => l.startsWith('## ')).map(l => l.trimEnd())
      if (h2s[0] !== '## Problem') fail(`first section must be \`## Problem\` (got ${JSON.stringify(h2s[0] ?? '<none>')})`)
      for (const req of REQUIRED[entry]) if (!h2s.includes(req)) fail(`missing required \`${req}\` section`)
      if (entry === 'implemented') for (const h of h2s.filter(h => BANNED_IMPLEMENTED.test(h))) fail(`\`${h}\` is proposal-era spec-speak; an implemented note states what is`)
      if (!h2s.includes('## Alternatives considered')) fail('missing `## Alternatives considered` (every Agent Note records what the decision beat)')
    }
  }
}

if (errors.length === 0) {
  console.log(`verify-agent-note-format: ${count} Agent Note(s) checked, all conform to .agents/notes/README.md.`)
  process.exit(0)
}
console.error('verify-agent-note-format: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
