import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { makeWorkspace, SHOUT_PLUGIN, type Workspace } from './harness.ts'

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

  it('done marks a task on disk and list shows [x]; repeat and unknown id behave as documented', () => {
    ws.config({})
    expect(pluglet(ws.root, 'add', 'ship', 'it').status).toBe(0)
    const done = pluglet(ws.root, 'done', '1')
    expect(done.status).toBe(0)
    expect(done.stdout).toBe('done 1: ship it\n')
    expect(JSON.parse(readFileSync(join(ws.root, 'tasks.json'), 'utf8'))).toEqual([{ id: 1, title: 'ship it', done: true }])
    expect(pluglet(ws.root, 'list').stdout).toBe('1 [x] ship it\n')
    const before = readFileSync(join(ws.root, 'tasks.json'))
    const again = pluglet(ws.root, 'done', '1')
    expect(again.status).toBe(0)
    expect(again.stdout).toBe('already done 1: ship it\n')
    expect(readFileSync(join(ws.root, 'tasks.json')).equals(before)).toBe(true)
    const unknown = pluglet(ws.root, 'done', '42')
    expect(unknown.status).toBe(1)
    expect(unknown.stdout).toBe('')
    expect(unknown.stderr).toMatch(/no task with id 42/)
    const usage = pluglet(ws.root, 'done', 'abc')
    expect(usage.status).toBe(2)
    expect(usage.stderr).toMatch(/usage: done <id>/)
  })

  it('loads a plugin from config through the real loader', () => {
    ws.file('shout.mjs', SHOUT_PLUGIN)
    ws.config({ plugins: ['./shout.mjs'] })
    const r = pluglet(ws.root, 'shout', 'ok')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('OK\n')
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
