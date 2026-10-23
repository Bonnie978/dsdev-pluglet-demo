/**
 * Gate inventory and aggregate graphs for `scripts/run-gates.mjs`.
 * Each gate: id, label, command, args, needs (gate ids that must pass first),
 * quick (part of the build-free doc-quick aggregate), allowFailure (observational).
 * Language-specific gates (typecheck, export-jsdoc, unit tests) are registered below and named in `hygiene` and `check-all`.
 */
const node = (script, ...args) => ({ command: 'node', args: [`scripts/${script}.mjs`, ...args] })

export const gates = [
  { id: 'md-wrap', label: 'verify-md-wrap', ...node('verify-md-wrap'), quick: true },
  { id: 'md-links', label: 'verify-md-links', ...node('verify-md-links'), quick: true },
  { id: 'doc-budgets', label: 'verify-doc-budgets', ...node('verify-doc-budgets'), quick: true },
  { id: 'agent-note-format', label: 'verify-agent-note-format', ...node('verify-agent-note-format'), quick: true },
  { id: 'postmortems', label: 'verify-postmortems', ...node('verify-postmortems'), quick: true },
  { id: 'upgrade-guides', label: 'verify-upgrade-guides', ...node('verify-upgrade-guides'), quick: true },
  { id: 'typecheck', label: 'typecheck', command: 'pnpm', args: ['run', '--silent', 'typecheck'] },
  { id: 'export-jsdoc', label: 'verify-export-jsdoc', ...node('verify-export-jsdoc'), quick: true },
  { id: 'test', label: 'unit tests', command: 'pnpm', args: ['run', '--silent', 'test'] },
]

const quick = gates.filter(g => g.quick).map(g => g.id)

export const aggregates = {
  'doc-quick': quick,
  'doc-sync': [...quick],
  'hygiene': ['typecheck', 'export-jsdoc'],
  'check-all': gates.map(g => g.id),
}
