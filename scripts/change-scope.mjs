/**
 * Report the explicit committed and worktree scope of a repository change as JSON.
 *
 *   node scripts/change-scope.mjs --base <ref> [--head <ref>]
 *
 * The command never guesses or fetches a base: supply the ref you verified from the
 * live PR or stack state. Committed paths are relative to the merge base of base and
 * head; staged, unstaged and untracked paths describe the current worktree.
 */
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { repoRoot } from './lib/repo-files.mjs'

const FORMAT_VERSION = 1
const root = repoRoot(import.meta.url)

function git(args, context) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, LANG: 'C', LC_ALL: 'C' } })
  if (r.status !== 0) throw new Error(`${context}: ${r.stderr.trim() || `git exited ${r.status}`}`)
  return r.stdout
}

const lines = s => s.split('\n').map(l => l.trim()).filter(Boolean).sort()

let opts
try {
  opts = parseArgs({ options: { base: { type: 'string' }, head: { type: 'string', default: 'HEAD' } }, strict: true }).values
  if (!opts.base) throw new Error('missing required --base <ref>')
} catch (error) {
  console.error(`change-scope: ${error.message}`)
  process.exit(2)
}

try {
  const baseSha = git(['rev-parse', '--verify', `${opts.base}^{commit}`], `cannot resolve base ref ${JSON.stringify(opts.base)}`).trim()
  const headSha = git(['rev-parse', '--verify', `${opts.head}^{commit}`], `cannot resolve head ref ${JSON.stringify(opts.head)}`).trim()
  const mergeBaseSha = git(['merge-base', baseSha, headSha], 'no merge base').trim()
  const report = {
    formatVersion: FORMAT_VERSION,
    repositoryRoot: root,
    input: { base: opts.base, head: opts.head },
    resolved: { baseSha, headSha, mergeBaseSha },
    paths: {
      committed: lines(git(['diff', '--name-only', mergeBaseSha, headSha], 'committed diff')),
      staged: lines(git(['diff', '--cached', '--name-only'], 'staged diff')),
      unstaged: lines(git(['diff', '--name-only'], 'unstaged diff')),
      untracked: lines(git(['ls-files', '--others', '--exclude-standard'], 'untracked files')),
    },
  }
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  console.error(`change-scope: ${error.message}`)
  process.exit(1)
}
