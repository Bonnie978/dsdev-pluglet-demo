import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCRIPTS, fixture } from './lib/gate-test-support.mjs'

const git = (root, ...args) => {
  const r = spawnSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}
/** A committed repository carrying its own copy of change-scope, which reports the repository it lives in. */
function repo() {
  const f = fixture({
    'scripts/change-scope.mjs': readFileSync(join(SCRIPTS, 'change-scope.mjs'), 'utf8'),
    'scripts/lib/repo-files.mjs': readFileSync(join(SCRIPTS, 'lib/repo-files.mjs'), 'utf8'),
    'src/old.ts': 'export const old = 1\n',
    'src/keep.ts': 'export const keep = 1\n',
  })
  git(f.root, 'init', '-q', '-b', 'main')
  git(f.root, 'add', '-A')
  git(f.root, 'commit', '-qm', 'init')
  return f
}
const scope = (root, ...args) => {
  const r = spawnSync(process.execPath, [join(root, 'scripts/change-scope.mjs'), ...args], { encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}

test('a committed and a staged rename each report both the source and the destination path', () => {
  const f = repo()
  try {
    git(f.root, 'checkout', '-qb', 'work')
    git(f.root, 'mv', 'src/old.ts', 'src/new.ts')
    git(f.root, 'commit', '-qm', 'rename')
    git(f.root, 'mv', 'src/keep.ts', 'src/kept.ts')
    const r = scope(f.root, '--base', 'main')
    assert.equal(r.status, 0, r.out)
    const { paths } = JSON.parse(r.out)
    assert.deepEqual(paths, { committed: ['src/new.ts', 'src/old.ts'], staged: ['src/keep.ts', 'src/kept.ts'], unstaged: [], untracked: [] })
  } finally { f.dispose() }
})

test('a missing --base exits 2', () => {
  const f = repo()
  try { const r = scope(f.root); assert.equal(r.status, 2); assert.match(r.out, /missing required --base/) } finally { f.dispose() }
})
