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

const pkg = existsSync(resolve(root, 'package.json')) ? JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) : { scripts: {} }
const hasTypecheck = Boolean(pkg.scripts?.typecheck)
// The lockfile names the package manager; the hook must run the same one the repository uses.
const pm = existsSync(resolve(root, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(resolve(root, 'yarn.lock')) ? 'yarn' : existsSync(resolve(root, 'bun.lock')) || existsSync(resolve(root, 'bun.lockb')) ? 'bun' : 'npm'

const preCommit = `#!/bin/sh
# dsdev narrow pre-commit: whitespace + markdown hard-wrap on staged files. CI owns the rest.
set -e
git diff --cached --check
if git diff --cached --name-only --diff-filter=ACMR | grep -q '\\.md$'; then
  node scripts/verify-md-wrap.mjs
fi
`
const prePush = `#!/bin/sh
# dsdev narrow pre-push: incremental typecheck only.
set -e
${hasTypecheck ? `${pm} run --silent typecheck` : 'exit 0'}
`
writeFileSync(resolve(hooks, 'pre-commit'), preCommit)
writeFileSync(resolve(hooks, 'pre-push'), prePush)
chmodSync(resolve(hooks, 'pre-commit'), 0o755)
chmodSync(resolve(hooks, 'pre-push'), 0o755)
console.log(`install-hooks: wrote pre-commit and pre-push to ${hooks}${hasTypecheck ? '' : ' (no typecheck script; pre-push is a no-op)'}.`)
