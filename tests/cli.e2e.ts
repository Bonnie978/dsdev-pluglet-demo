import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEFAULT_FUNCTION_PLUGIN, makeWorkspace, SHOUT_PLUGIN, type Workspace } from './harness.ts'

// Real entry path: the published bin runs under plain node from built lib/ (docs/testing.md).
// `pnpm run test:e2e` builds first; a stale or missing lib/ is a failure, not a skip.
const BIN = resolve(import.meta.dirname, '../lib/bin.js')

function pluglet(cwd: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', timeout: 20_000 })
  expect(r.signal, 'child was killed by a signal or timeout').toBeNull()
  return r
}

describe('pluglet bin', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('built artifact exists', () => {
    expect(existsSync(BIN), `run pnpm run build first (missing ${BIN})`).toBe(true)
  })

  it('adds a task and the file on disk proves it', () => {
    ws.config({})
    const r = pluglet(ws.root, 'add', 'ship', 'it')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('added 1: ship it\n')
    expect(JSON.parse(readFileSync(join(ws.root, 'tasks.json'), 'utf8'))).toEqual([{ id: 1, title: 'ship it', done: false }])
  })

  it('reads the profile named by --profile', () => {
    const profile = ws.file('other.profile.json', '{}\n')
    const r = pluglet(ws.root, '--profile', profile, 'add', 'via', 'flag')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('added 1: via flag\n')
    expect(JSON.parse(readFileSync(join(ws.root, 'tasks.json'), 'utf8'))).toEqual([{ id: 1, title: 'via flag', done: false }])
  })

  it('reads only pluglet.profile.json as the default profile', () => {
    ws.file('pluglet.json', '{}\n')
    const r = pluglet(ws.root, 'list')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/pluglet\.profile\.json does not exist; pass --profile <file>/)
    expect(existsSync(join(ws.root, 'tasks.json')), 'no run may have touched the store').toBe(false)
  })

  it('rejects an unknown option with exit 2 in any position, before any profile or store is read', () => {
    const other = ws.file('other.json', '{}\n')
    const expectUsage = (...args: string[]) => {
      const r = pluglet(ws.root, ...args)
      expect(r.status, args.join(' ')).toBe(2)
      expect(r.stdout, args.join(' ')).toBe('')
      expect(r.stderr, args.join(' ')).toBe('pluglet: unknown option "--config"; the only option is --profile <file>\n')
    }
    expectUsage('--config', other, 'list')
    ws.config({})
    expectUsage('--config', other, 'list')
    expectUsage('list', '--config', other)
    expectUsage('add', '--config', other, 'buy', 'milk')
    expect(existsSync(join(ws.root, 'tasks.json')), 'no run may have touched the store').toBe(false)
  })

  it('loads a plugin from config through the real loader', () => {
    ws.file('shout.mjs', SHOUT_PLUGIN)
    ws.config({ plugins: ['./shout.mjs'] })
    const r = pluglet(ws.root, 'shout', 'ok')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('OK\n')
  })

  it('rejects a default-exported function plugin with exit 1, naming the file and the fix, with no stack trace', () => {
    const plugin = ws.file('tag.mjs', DEFAULT_FUNCTION_PLUGIN)
    ws.config({ plugins: ['./tag.mjs'] })
    const r = pluglet(ws.root, 'list')
    expect(r.status).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/^pluglet: plugin .*tag\.mjs: default export is a function/)
    expect(r.stderr).toContain(plugin)
    expect(r.stderr).not.toMatch(/TypeError|\n\s+at /)
  })

  it('exits 1 on a handled failure and 2 on usage, writing the reason to stderr', () => {
    ws.config({})
    const unknown = pluglet(ws.root, 'nope')
    expect(unknown.status).toBe(1)
    expect(unknown.stderr).toMatch(/unknown command "nope"/)
    const usage = pluglet(ws.root)
    expect(usage.status).toBe(2)
    expect(usage.stderr).toMatch(/usage:/)
  })
})
