/**
 * Shared repository file discovery for the dsdev gates. Zero dependencies.
 * Skips dependency, build-output and frozen trees; callers add their own filters.
 */
import { readdirSync, realpathSync, statSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

/** Directory names never descended into. */
export const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'lib', 'build', 'coverage', '.generated', '.cache', 'vendor', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox', 'target'])

/** Resolve the repository root from a script location (`scripts/` or `scripts/lib/`). */
export function repoRoot(importMetaUrl) {
  const here = new URL('.', importMetaUrl).pathname
  return here.endsWith(`${sep}lib${sep}`) || here.endsWith('/lib/') ? resolve(here, '../..') : resolve(here, '..')
}

/**
 * The root a gate checks: `--root <dir>` from argv when present (read-only, used by the
 * gates' own tests to drive the real runner over a temporary fixture), else the repository.
 * A missing `--root` directory exits 2 so a typo never passes as "nothing to check".
 */
export function resolveRoot(importMetaUrl, argv = process.argv.slice(2)) {
  const i = argv.indexOf('--root')
  if (i === -1) return repoRoot(importMetaUrl)
  const dir = argv[i + 1]
  if (!dir) { console.error('--root requires a directory'); process.exit(2) }
  const abs = resolve(dir)
  try { if (!statSync(abs).isDirectory()) throw new Error() } catch { console.error(`--root ${dir} is not a directory`); process.exit(2) }
  return abs
}

/** Word count: whitespace tokens plus one per CJK character, so Chinese and English prose spend budgets alike. */
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g
export function countWords(text) {
  return text.split(/\s+/).filter(Boolean).reduce((n, token) => {
    const cjk = token.match(CJK)?.length ?? 0
    return n + cjk + (token.replace(CJK, '').trim() === '' ? 0 : 1)
  }, 0)
}

/** Is this repository-relative path inside the frozen Agent Note archive? */
export function isArchivedAgentNotePath(rel) {
  return rel.startsWith('.agents/notes/archived/')
}

/**
 * Walk the repository and return repository-relative paths matching `predicate`.
 * Symlinks are reported once and never followed (an instruction symlink such as CLAUDE.md is deduped by target).
 */
export function walk(root, predicate, { includeArchived = false } = {}) {
  const out = []
  const seenTargets = new Set()
  const visit = (dir) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      const rel = relative(root, abs).split(sep).join('/')
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (!includeArchived && rel === '.agents/notes/archived') continue
        visit(abs)
        continue
      }
      if (entry.isSymbolicLink()) {
        // Dedupe instruction symlinks (CLAUDE.md -> AGENTS.md) by real path and skip links
        // that leave the repository: their relative references resolve from their real home.
        let real
        try { real = realpathSync(abs) } catch { continue }
        if (!real.startsWith(root + sep) || statSync(real).isDirectory()) continue
        if (seenTargets.has(real)) continue
        seenTargets.add(real)
      } else {
        seenTargets.add(abs)
      }
      if (!includeArchived && isArchivedAgentNotePath(rel)) continue
      if (predicate(rel)) out.push(rel)
    }
  }
  visit(root)
  return out.sort()
}

/** Markdown files in scope for prose gates. */
export function markdownFiles(root, options) {
  return walk(root, rel => rel.endsWith('.md'), options)
}

/** Read a file as UTF-8, failing with the repository-relative path in the message. */
export function readText(root, rel) {
  try { return readFileSync(resolve(root, rel), 'utf8') } catch (error) {
    throw new Error(`${rel}: ${error.message}`)
  }
}

/** Split a Markdown source into lines and mark which are inside fenced code blocks. */
export function markdownLines(source) {
  const lines = source.split('\n')
  const fenced = new Array(lines.length).fill(false)
  let fence = null
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i])
    if (fence === null && m) { fence = m[1][0]; fenced[i] = true; continue }
    if (fence !== null) {
      fenced[i] = true
      if (m && m[1][0] === fence && lines[i].trim().length >= 3 && lines[i].trim().replace(new RegExp(`\\${fence}`, 'g'), '') === '') fence = null
    }
  }
  return { lines, fenced }
}
