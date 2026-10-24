/**
 * Heuristic for TypeScript and ESM JavaScript: every top-level `export` declaration under
 * `src/` is immediately preceded by a JSDoc block, and exported functions document `@param`
 * for each parameter and `@returns` when they return a value (a `: void` annotation, or for
 * unannotated JavaScript the absence of a `return <expr>` statement, marks a void function).
 * `@param` types may nest one level of braces (`{{ a: number }}`) and optional names may be
 * bracketed (`[name]`). Re-exports are exempt. Adapt the `SRC` predicate when sources live elsewhere.
 */
import { readFileSync } from 'node:fs'
import { resolveRoot, walk } from './lib/repo-files.mjs'

const root = resolveRoot(import.meta.url)
const SRC = rel => /(^|\/)src\/.*\.(ts|tsx|mts|js|mjs)$/.test(rel) && !/\.(spec|test)\.(ts|js|mjs)$|\.d\.ts$/.test(rel)
const EXPORT = /^export\s+(?:default\s+)?(?:async\s+)?(function|class|const|let|var|interface|type|enum|abstract class)\s+([A-Za-z_$][\w$]*)?/

/** Split a parameter list on commas that are not nested inside <>, (), {} or []. */
function splitTopLevel(text) {
  const out = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if ('<({['.includes(ch)) depth++
    else if ('>)}]'.includes(ch)) depth--
    if (ch === ',' && depth === 0) { out.push(current); current = '' } else current += ch
  }
  if (current.trim() !== '') out.push(current)
  return out
}

/** Does the function starting at `start` contain a `return <expr>` statement? (unannotated sources) */
function returnsValue(lines, start) {
  let depth = 0
  let opened = false
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; opened = true } else if (ch === '}') depth--
    }
    if (opened && /\breturn\s+[^;\s]/.test(lines[i])) return true
    if (opened && depth === 0) break
  }
  return false
}

const errors = []
let checked = 0
for (const rel of walk(root, SRC)) {
  const lines = readFileSync(`${root}/${rel}`, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = EXPORT.exec(lines[i])
    if (!m) continue
    checked++
    // Find the JSDoc block ending on the previous non-blank line.
    let j = i - 1
    while (j >= 0 && lines[j].trim() === '') j--
    if (j < 0 || !lines[j].trim().endsWith('*/')) { errors.push(`${rel}:${i + 1}: exported ${m[1]} ${m[2] ?? ''} has no JSDoc`); continue }
    let k = j
    while (k >= 0 && !lines[k].includes('/**')) k--
    const doc = lines.slice(Math.max(k, 0), j + 1).join('\n')
    if (m[1] === 'function') {
      const sig = lines.slice(i, i + 5).join(' ')
      const params = splitTopLevel(sig.match(/\(([^)]*)\)/)?.[1] ?? '').map(p => p.trim().replace(/[?:=].*$/, '').replace(/^\.\.\./, '')).filter(p => p && !p.startsWith('{') && !p.startsWith('['))
      for (const p of params) if (!new RegExp(`@param\\s+(?:\\{(?:[^{}]|\\{[^{}]*\\})*\\}\\s+)?\\[?${p}\\b`).test(doc)) errors.push(`${rel}:${i + 1}: @param ${p} missing`)
      const annotated = /\)\s*:\s*[A-Za-z_$<]/.test(sig)
      const isVoid = annotated ? /\)\s*:\s*(void|Promise<void>)\b/.test(sig) : !returnsValue(lines, i)
      if (!isVoid && !/@returns?\b/.test(doc)) errors.push(`${rel}:${i + 1}: @returns missing on non-void function`)
    }
  }
}

if (errors.length === 0) { console.log(`verify-export-jsdoc: ${checked} export(s) documented.`); process.exit(0) }
console.error('verify-export-jsdoc: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
