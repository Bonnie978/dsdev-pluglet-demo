/**
 * Gate inventory and aggregate graphs for `scripts/run-gates.mjs`.
 * Each gate: id, label, command, args, needs (gate ids that must pass first),
 * quick (part of the build-free doc-quick aggregate), allowFailure (observational).
 * Per-package test tiers are generated from the workspace: every `test:<tier>` script a package
 * declares (`scripts/lib/workspace.mjs` TIERS) becomes a `<tier>:<dir>` gate in check-all, so a
 * package that forgets to declare a tier fails `verify-workspace` instead of being skipped.
 */
import { repoRoot } from './lib/repo-files.mjs'
import { TIERS, workspacePackages } from './lib/workspace.mjs'

const node = (script, ...args) => ({ command: 'node', args: [`scripts/${script}.mjs`, ...args] })

const tierGates = workspacePackages(repoRoot(import.meta.url)).flatMap(p => TIERS
  .filter(t => p.manifest.scripts?.[`test:${t}`])
  .map(t => ({ id: `${t}:${p.short}`, label: `${p.name} test:${t}`, command: 'pnpm', args: ['--filter', p.name, 'run', '--silent', `test:${t}`], needs: ['typecheck'] })))

export const gates = [
  { id: 'md-wrap', label: 'verify-md-wrap', ...node('verify-md-wrap'), quick: true },
  { id: 'md-links', label: 'verify-md-links', ...node('verify-md-links'), quick: true },
  { id: 'doc-budgets', label: 'verify-doc-budgets', ...node('verify-doc-budgets'), quick: true },
  { id: 'agent-note-format', label: 'verify-agent-note-format', ...node('verify-agent-note-format'), quick: true },
  { id: 'postmortems', label: 'verify-postmortems', ...node('verify-postmortems'), quick: true },
  { id: 'upgrade-guides', label: 'verify-upgrade-guides', ...node('verify-upgrade-guides'), quick: true },
  { id: 'archived-agent-notes', label: 'verify-archived-agent-notes', ...node('verify-archived-agent-notes'), quick: true },
  { id: 'repository-references', label: 'verify-repository-references', ...node('verify-repository-references'), quick: true },
  { id: 'export-jsdoc', label: 'verify-export-jsdoc', ...node('verify-export-jsdoc'), quick: true },
  { id: 'gate-selftest', label: 'gate self-tests (node --test scripts/*.spec.mjs)', command: 'node', args: ['--test', 'scripts/*.spec.mjs'] },
  { id: 'lockfile', label: 'verify-lockfile', ...node('verify-lockfile') },
  { id: 'workspace', label: 'verify-workspace', ...node('verify-workspace') },
  { id: 'typecheck', label: 'typecheck (tsc -b)', command: 'pnpm', args: ['run', '--silent', 'typecheck'] },
  ...tierGates,
]

const quick = gates.filter(g => g.quick).map(g => g.id)

export const aggregates = {
  'doc-quick': quick,
  'doc-sync': [...quick],
  'hygiene': ['lockfile', 'workspace', 'gate-selftest'],
  'check-all': gates.map(g => g.id),
}
