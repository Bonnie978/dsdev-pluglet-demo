/**
 * Hygiene gate for the pnpm workspace: every package discovered from `pnpm-workspace.yaml`
 * carries the per-package registrations the other gates rely on.
 *
 * - `README.md` exists (the package contract; `docs/AGENTS.md` layer table).
 * - `scripts.test` exists; a package with `exports` declares `test:coverage`; a package with
 *   `bin` declares `test:e2e`. `scripts/gates.config.mjs` turns each tier script into a
 *   `<tier>:<dir>` gate inside `check-all`, so a missing script is a tier CI never runs.
 * - Every declared tier script enables `--experimental-test-coverage` (without it Node ignores the
 *   threshold flags and the tier passes with any coverage) and enforces `--test-coverage-lines=100`
 *   and `--test-coverage-branches=100`.
 * - Workspace packages listed in `dependencies`, `devDependencies` or `optionalDependencies` use
 *   the `workspace:` protocol; every `workspace:` dependency is mirrored in the package
 *   `tsconfig.json` `references`; the root `tsconfig.json` references every package.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { resolveRoot } from './lib/repo-files.mjs'
import { TIERS, workspacePackages } from './lib/workspace.mjs'

const root = resolveRoot(import.meta.url)
/** Fields whose workspace-package entries must use `workspace:`; `peerDependencies` ranges are not checked. */
const PROTOCOL_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies']
const errors = []
const readJson = (rel) => {
  try { return JSON.parse(readFileSync(join(root, rel), 'utf8')) } catch (error) { errors.push(`${rel}: ${error.code === 'ENOENT' ? 'missing' : error.message}`); return null }
}
const refs = (config, fromDir) => (config?.references ?? []).map(r => posix.normalize(posix.join(fromDir, r.path)))

let packages
try { packages = workspacePackages(root) } catch (error) { console.error(`verify-workspace: ${error.message}`); process.exit(1) }
if (packages.length === 0) { console.error('verify-workspace: pnpm-workspace.yaml matched no packages; delete this gate or fix the globs.'); process.exit(1) }

const byName = new Map(packages.map(p => [p.name, p]))
const rootRefs = refs(readJson('tsconfig.json'), '.')
for (const p of packages) {
  const at = p.dir
  const scripts = p.manifest.scripts ?? {}
  if (!p.name) errors.push(`${at}/package.json: missing name`)
  if (!existsSync(join(root, at, 'README.md'))) errors.push(`${at}: missing README.md (package contract)`)
  if (!scripts.test) errors.push(`${at}/package.json: missing scripts.test`)
  if (p.manifest.exports && !scripts['test:coverage']) errors.push(`${at}/package.json: has exports but no scripts["test:coverage"]`)
  if (p.manifest.bin && !scripts['test:e2e']) errors.push(`${at}/package.json: has bin but no scripts["test:e2e"]`)
  const tiers = TIERS.filter(t => scripts[`test:${t}`])
  if (tiers.length === 0) errors.push(`${at}/package.json: declares no test tier (${TIERS.map(t => `test:${t}`).join(' or ')})`)
  for (const t of tiers) {
    for (const flag of ['--experimental-test-coverage', '--test-coverage-lines=100', '--test-coverage-branches=100']) {
      if (!scripts[`test:${t}`].includes(flag)) errors.push(`${at}/package.json: scripts["test:${t}"] lacks ${flag}`)
    }
  }
  for (const [name, range] of PROTOCOL_FIELDS.flatMap(field => Object.entries(p.manifest[field] ?? {}))) {
    if (byName.has(name) && !String(range).startsWith('workspace:')) errors.push(`${at}/package.json: workspace dependency ${name} must use the workspace: protocol, got ${JSON.stringify(range)}`)
  }
  const own = refs(readJson(`${at}/tsconfig.json`), at)
  for (const dep of p.workspaceDeps) {
    const target = byName.get(dep)
    if (!target) { errors.push(`${at}/package.json: workspace dependency ${dep} is not a workspace package`); continue }
    if (!own.includes(target.dir)) errors.push(`${at}/tsconfig.json: references lacks ${target.dir} (workspace dependency ${dep})`)
  }
  if (!rootRefs.includes(at)) errors.push(`tsconfig.json: references lacks ${at}`)
}

if (errors.length === 0) { console.log(`verify-workspace: ${packages.length} package(s) registered (${packages.map(p => p.short).join(', ')}).`); process.exit(0) }
console.error('verify-workspace: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
