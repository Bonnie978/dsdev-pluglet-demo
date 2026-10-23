/**
 * Install the narrow git hooks (`docs/development.md` § Git 钩子): pre-commit checks staged
 * whitespace and Markdown hard-wraps; pre-push runs the typecheck script when one exists.
 * Tests, snapshots, documentation gates, builds and hygiene stay out of hooks — CI owns them.
 * Safe to re-run; skips when not inside a git worktree (e.g. npm pack). Package managers skip
 * postinstall when node_modules is already current, so an existing checkout runs this script directly.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { repoRoot } from './lib/repo-files.mjs'

const root = repoRoot(import.meta.url)
const gitDir = spawnSync('git', ['-C', root, 'rev-parse', '--git-path', 'hooks'], { encoding: 'utf8' })
if (gitDir.status !== 0) { console.log('install-hooks: not a git worktree; skipping.'); process.exit(0) }
const hooks = resolve(root, gitDir.stdout.trim())
mkdirSync(hooks, { recursive: true })

// pre-push runs the repository's typecheck when one is declared: a package.json script for
// Node repositories, else a Makefile `typecheck:` target (falling back to `lint:`). Nothing
// declared → the hook is a visible no-op and says so, instead of silently guarding nothing.
const pkgPath = resolve(root, 'package.json')
const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null
const makefile = existsSync(resolve(root, 'Makefile')) ? readFileSync(resolve(root, 'Makefile'), 'utf8') : ''
const makeTarget = ['typecheck', 'lint'].find(t => new RegExp(`^${t}:`, 'm').test(makefile))
const hasTypecheck = Boolean(pkg?.scripts?.typecheck) || (pkg === null && Boolean(makeTarget))
// The lockfile names the package manager; the hook must run the same one the repository uses.
const pm = existsSync(resolve(root, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(resolve(root, 'yarn.lock')) ? 'yarn' : existsSync(resolve(root, 'bun.lock')) || existsSync(resolve(root, 'bun.lockb')) ? 'bun' : 'npm'

const preCommit = `#!/bin/sh
# dsdev narrow pre-commit: whitespace + markdown hard-wrap on staged files. CI owns the rest.
set -e
git diff --cached --check
staged_md=$(git diff --cached --name-only --diff-filter=ACMR -- '*.md')
if [ -n "$staged_md" ]; then
  # shellcheck disable=SC2086
  node scripts/verify-md-wrap.mjs $staged_md
fi
`
const prePush = `#!/bin/sh
# dsdev narrow pre-push: incremental typecheck only.
set -e
${pkg?.scripts?.typecheck ? `${pm} run --silent typecheck` : makeTarget && pkg === null ? `make -s ${makeTarget}` : 'echo "dsdev pre-push: no typecheck script or Makefile target declared; nothing to run"'}
`
writeFileSync(resolve(hooks, 'pre-commit'), preCommit)
writeFileSync(resolve(hooks, 'pre-push'), prePush)
chmodSync(resolve(hooks, 'pre-commit'), 0o755)
chmodSync(resolve(hooks, 'pre-push'), 0o755)
console.log(`install-hooks: wrote pre-commit and pre-push to ${hooks}${hasTypecheck ? '' : ' (no typecheck script or Makefile target; pre-push only prints a notice)'}.`)
