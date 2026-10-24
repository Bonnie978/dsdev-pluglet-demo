/**
 * Gate inventory and aggregate graphs for `scripts/run-gates.mjs`.
 * Each gate: id, label, command, args, needs (gate ids that must pass first),
 * quick (part of the build-free doc-quick aggregate), allowFailure (observational).
 * Add language-specific gates (typecheck, lint, tests) below and name them in aggregates.
 */
const node = (script, ...args) => ({ command: 'node', args: [`scripts/${script}.mjs`, ...args] })

export const gates = [
  { id: 'md-wrap', label: 'verify-md-wrap', ...node('verify-md-wrap'), quick: true },
  { id: 'md-links', label: 'verify-md-links', ...node('verify-md-links'), quick: true },
  { id: 'doc-budgets', label: 'verify-doc-budgets', ...node('verify-doc-budgets'), quick: true },
  { id: 'agent-note-format', label: 'verify-agent-note-format', ...node('verify-agent-note-format'), quick: true },
  { id: 'postmortems', label: 'verify-postmortems', ...node('verify-postmortems'), quick: true },
  { id: 'upgrade-guides', label: 'verify-upgrade-guides', ...node('verify-upgrade-guides'), quick: true },
  { id: 'archived-agent-notes', label: 'verify-archived-agent-notes', ...node('verify-archived-agent-notes'), quick: true },
  { id: 'repository-references', label: 'verify-repository-references', ...node('verify-repository-references'), quick: true },
  { id: 'gate-selftest', label: 'gate self-tests (node --test scripts/*.spec.mjs)', command: 'node', args: ['--test', 'scripts/*.spec.mjs'] },
  { id: 'lockfile', label: 'verify-lockfile', ...node('verify-lockfile') },
  // Register this repository's language gates here and name them in check-all; a gate not named in
  // an executed aggregate does not exist. The coverage gate (not the plain unit run) and the
  // real-entry-path e2e belong in check-all, because CI runs check-all: a test tier CI never runs
  // guards nothing (DeepSeek Harness postmortem 0001: green unit tests, broken product).
  //   { id: 'typecheck', label: 'typecheck', command: 'pnpm', args: ['run', '--silent', 'typecheck'] },
  //   { id: 'coverage', label: 'unit tests + per-file coverage', command: 'pnpm', args: ['run', '--silent', 'test:coverage'], needs: ['typecheck'] },
  //   { id: 'e2e', label: 'real entry path e2e', command: 'pnpm', args: ['run', '--silent', 'test:e2e'], needs: ['typecheck'] },
]

const quick = gates.filter(g => g.quick).map(g => g.id)

export const aggregates = {
  'doc-quick': quick,
  'doc-sync': [...quick],
  'hygiene': ['lockfile', 'gate-selftest'],
  'check-all': gates.map(g => g.id),
}
