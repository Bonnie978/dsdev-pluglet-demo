/**
 * Workspace package discovery shared by gates.config, change-scope and verify-workspace.
 * Zero dependencies. Reads the `packages:` globs from `pnpm-workspace.yaml` (only the
 * `dir/*` and literal-directory forms this repository uses; any other glob shape throws so a
 * new pattern is never silently ignored) and every matched directory's `package.json`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Parse the `packages:` list of a pnpm-workspace.yaml source.
 * @param {string} source - File contents.
 * @returns {string[]} The glob entries in file order.
 */
export function workspaceGlobs(source) {
  const out = []
  let inPackages = false
  for (const line of source.split('\n')) {
    if (/^packages:\s*$/.test(line)) { inPackages = true; continue }
    if (inPackages && /^\S/.test(line)) inPackages = false
    const m = inPackages && /^\s+-\s+['"]?([^'"#\s]+)['"]?\s*$/.exec(line)
    if (m) out.push(m[1])
  }
  return out
}

/** Manifest fields whose entries are dependency edges between workspace packages. */
export const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']

/**
 * Discover workspace packages under `root`.
 * @param {string} root - Repository root.
 * @returns {{ name: string, short: string, dir: string, manifest: Record<string, any>, workspaceDeps: string[] }[]}
 *   Packages sorted by directory; `short` is the directory basename used in gate ids,
 *   `workspaceDeps` the names declared with the `workspace:` protocol in any of
 *   `DEPENDENCY_FIELDS`.
 */
export function workspacePackages(root) {
  const file = join(root, 'pnpm-workspace.yaml')
  if (!existsSync(file)) return []
  const dirs = []
  for (const glob of workspaceGlobs(readFileSync(file, 'utf8'))) {
    if (/^[\w.-]+(\/[\w.-]+)*\/\*$/.test(glob)) {
      const parent = glob.slice(0, -2)
      if (!existsSync(join(root, parent))) continue
      for (const entry of readdirSync(join(root, parent)).sort()) {
        if (statSync(join(root, parent, entry)).isDirectory()) dirs.push(`${parent}/${entry}`)
      }
    } else if (/^[\w.-]+(\/[\w.-]+)*$/.test(glob)) dirs.push(glob)
    else throw new Error(`workspace: unsupported pnpm-workspace.yaml glob ${JSON.stringify(glob)}; extend scripts/lib/workspace.mjs`)
  }
  return dirs.filter(dir => existsSync(join(root, dir, 'package.json'))).sort().map((dir) => {
    const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
    const declared = DEPENDENCY_FIELDS.flatMap(field => Object.entries(manifest[field] ?? {}))
    return {
      name: manifest.name,
      short: dir.split('/').pop(),
      dir,
      manifest,
      workspaceDeps: [...new Set(declared.filter(([, range]) => String(range).startsWith('workspace:')).map(([name]) => name))].sort(),
    }
  })
}

/** Test tiers a package registers as package.json scripts; each one becomes a `<tier>:<short>` gate. */
export const TIERS = ['coverage', 'e2e']

/**
 * Names of packages that depend on any of `names`, transitively, excluding `names` themselves.
 * @param {ReturnType<typeof workspacePackages>} packages - Workspace packages.
 * @param {string[]} names - Changed package names.
 * @returns {string[]} Sorted dependent package names.
 */
export function transitiveDependents(packages, names) {
  const seen = new Set(names)
  const out = new Set()
  let grew = true
  while (grew) {
    grew = false
    for (const p of packages) {
      if (seen.has(p.name)) continue
      if (p.workspaceDeps.some(d => seen.has(d))) { seen.add(p.name); out.add(p.name); grew = true }
    }
  }
  return [...out].sort()
}
