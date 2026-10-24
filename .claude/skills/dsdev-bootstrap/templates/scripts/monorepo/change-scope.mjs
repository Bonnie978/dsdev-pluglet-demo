/**
 * Report the explicit committed and worktree scope of a repository change as JSON, and map it
 * onto workspace packages and the per-package evidence that covers it.
 *
 *   node scripts/change-scope.mjs --base <ref> [--head <ref>]
 *
 * The command never guesses or fetches a base: supply the ref you verified from the
 * live PR or stack state. Committed paths are relative to the merge base of base and
 * head; staged, unstaged and untracked paths describe the current worktree.
 *
 * `packages` lists each affected workspace package with why it is affected and the tier
 * commands it declares: a changed `src/` or `package.json` affects the owning package and every
 * transitive workspace dependent (their observable output can change); a test-only change affects
 * the owner alone; Markdown is documentation, never package behaviour. `suggestedEvidence` is the
 * deduplicated command list for the agent to prune or extend per dsdev-pre-push-checks, not a mandate;
 * `surfaces.unclassified` names paths no rule covers, which the agent must judge by hand.
 */
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { resolveRoot } from './lib/repo-files.mjs'
import { TIERS, transitiveDependents, workspacePackages } from './lib/workspace.mjs'

const FORMAT_VERSION = 2
const root = resolveRoot(import.meta.url)

function git(args, context) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, LANG: 'C', LC_ALL: 'C' } })
  if (r.status !== 0) throw new Error(`${context}: ${r.stderr.trim() || `git exited ${r.status}`}`)
  return r.stdout
}

const lines = s => s.split('\n').map(l => l.trim()).filter(Boolean).sort()
const MANIFESTS = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', '.gitignore'])

let opts
try {
  opts = parseArgs({ options: { base: { type: 'string' }, head: { type: 'string', default: 'HEAD' }, root: { type: 'string' } }, strict: true }).values
  if (!opts.base) throw new Error('missing required --base <ref>')
} catch (error) {
  console.error(`change-scope: ${error.message}`)
  process.exit(2)
}

/** Map every changed path to packages and repository surfaces. */
function classify(allPaths, packages) {
  const surfaces = { docs: [], scripts: [], manifests: [], unclassified: [] }
  const reasons = new Map()
  const affect = (name, why) => { if (!reasons.has(name)) reasons.set(name, new Set()); reasons.get(name).add(why) }
  const behaviourChanged = new Set()
  for (const path of allPaths) {
    const owner = packages.find(p => path.startsWith(`${p.dir}/`))
    if (path.endsWith('.md')) { surfaces.docs.push(path); continue }
    if (owner) {
      const sub = path.slice(owner.dir.length + 1)
      if (sub.startsWith('src/') || sub === 'package.json') { affect(owner.name, `changed ${sub}`); behaviourChanged.add(owner.name) } else affect(owner.name, `changed ${sub}`)
      if (sub === 'package.json' || sub === 'tsconfig.json') surfaces.manifests.push(path)
      continue
    }
    if (path.startsWith('scripts/')) surfaces.scripts.push(path)
    else if (MANIFESTS.has(path)) surfaces.manifests.push(path)
    else if (/^(docs|\.agents|\.claude|\.github)\//.test(path)) surfaces.docs.push(path)
    else surfaces.unclassified.push(path)
  }
  for (const changed of behaviourChanged) {
    for (const dep of transitiveDependents(packages, [changed])) affect(dep, `depends on ${changed}`)
  }
  const affected = packages.filter(p => reasons.has(p.name)).map(p => ({
    name: p.name,
    dir: p.dir,
    why: [...reasons.get(p.name)].sort(),
    evidence: TIERS.filter(t => p.manifest.scripts?.[`test:${t}`]).map(t => `pnpm --filter ${p.name} run test:${t}`),
  }))
  const suggested = [
    ...affected.flatMap(p => p.evidence),
    ...(surfaces.docs.length ? ['pnpm run test:docs'] : []),
    ...(surfaces.scripts.length ? ["node --test 'scripts/*.spec.mjs'"] : []),
    ...(surfaces.manifests.length ? ['pnpm run hygiene', 'pnpm run typecheck'] : []),
  ]
  return { packages: affected, surfaces, suggestedEvidence: [...new Set(suggested)] }
}

try {
  const baseSha = git(['rev-parse', '--verify', `${opts.base}^{commit}`], `cannot resolve base ref ${JSON.stringify(opts.base)}`).trim()
  const headSha = git(['rev-parse', '--verify', `${opts.head}^{commit}`], `cannot resolve head ref ${JSON.stringify(opts.head)}`).trim()
  const mergeBaseSha = git(['merge-base', baseSha, headSha], 'no merge base').trim()
  const paths = {
    committed: lines(git(['diff', '--name-only', mergeBaseSha, headSha], 'committed diff')),
    staged: lines(git(['diff', '--cached', '--name-only'], 'staged diff')),
    unstaged: lines(git(['diff', '--name-only'], 'unstaged diff')),
    untracked: lines(git(['ls-files', '--others', '--exclude-standard'], 'untracked files')),
  }
  const all = [...new Set(Object.values(paths).flat())].sort()
  const report = {
    formatVersion: FORMAT_VERSION,
    repositoryRoot: root,
    input: { base: opts.base, head: opts.head },
    resolved: { baseSha, headSha, mergeBaseSha },
    paths,
    ...classify(all, workspacePackages(root)),
  }
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  console.error(`change-scope: ${error.message}`)
  process.exit(1)
}
