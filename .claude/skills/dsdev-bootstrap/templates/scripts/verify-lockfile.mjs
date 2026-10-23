/**
 * Hygiene gate: the committed lockfile matches package.json. Detects the package manager from
 * the lockfile present and runs its offline, no-write consistency check; a drifted lockfile or a
 * missing one fails. Non-Node repositories delete this gate and register their own hygiene check.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveRoot } from './lib/repo-files.mjs'

const root = resolveRoot(import.meta.url)
const checks = [
  ['pnpm-lock.yaml', 'pnpm', ['install', '--frozen-lockfile', '--lockfile-only', '--offline']],
  ['yarn.lock', 'yarn', ['install', '--immutable', '--immutable-cache', '--mode=skip-build']],
  ['package-lock.json', 'npm', ['ci', '--dry-run', '--ignore-scripts']],
  ['bun.lock', 'bun', ['install', '--frozen-lockfile', '--dry-run']],
]
const found = checks.find(([file]) => existsSync(resolve(root, file)))
if (!found) {
  console.error('verify-lockfile: no lockfile (pnpm-lock.yaml, yarn.lock, package-lock.json, bun.lock) at the repository root; commit one or delete this gate.')
  process.exit(1)
}
const [file, pm, args] = found
const r = spawnSync(pm, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
if (r.status !== 0) {
  console.error(`verify-lockfile: ${file} does not match package.json (${pm} ${args.join(' ')} exited ${r.status}). Run \`${pm} install\` and commit the lockfile.`)
  process.stderr.write((r.stderr || r.stdout).trim().split('\n').slice(-5).join('\n') + '\n')
  process.exit(1)
}
console.log(`verify-lockfile: ${file} is consistent with package.json (${pm}).`)
