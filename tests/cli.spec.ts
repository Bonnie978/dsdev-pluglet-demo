import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exitCodeFor, parseArgv, runCli, type RunResult } from '../src/cli.ts'
import { PlugletError } from '../src/errors.ts'
import { DEFAULT_FUNCTION_PLUGIN, makeWorkspace, SHOUT_PLUGIN, type Workspace } from './harness.ts'

describe('parseArgv', () => {
  it('defaults --profile and splits command from args', () => {
    expect(parseArgv(['add', 'a', 'b'])).toEqual({ configPath: 'pluglet.profile.json', command: 'add', args: ['a', 'b'] })
    expect(parseArgv(['--profile', 'c.json', 'list'])).toEqual({ configPath: 'c.json', command: 'list', args: [] })
    expect(parseArgv(['list', '--profile', 'c.json'])).toMatchObject({ configPath: 'c.json', command: 'list' })
  })

  it('has no alias for the former --config flag: it is an ordinary word, not an option', () => {
    expect(parseArgv(['--config', 'c.json', 'list'])).toEqual({ configPath: 'pluglet.profile.json', command: '--config', args: ['c.json', 'list'] })
  })

  it('reports usage failures', () => {
    expect(() => parseArgv([])).toThrow(/usage: pluglet \[--profile <file>\]/)
    expect(() => parseArgv(['--profile'])).toThrow(/--profile requires a file path/)
  })
})

describe('runCli (real composition through the public entry)', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('runs core and plugin commands and verifies the store on disk', async () => {
    ws.file('shout.mjs', SHOUT_PLUGIN)
    const config = ws.config({ plugins: ['./shout.mjs'] })
    expect(await runCli(['--profile', config, 'add', 'x'])).toEqual({ kind: 'ok', lines: ['added 1: x'] })
    expect(await runCli(['--profile', config, 'shout', 'hi', 'there'])).toEqual({ kind: 'ok', lines: ['HI THERE'] })
    expect(JSON.parse(readFileSync(join(ws.root, 'tasks.json'), 'utf8'))).toEqual([{ id: 1, title: 'x', done: false }])
  })

  it('returns handled failures as results and lets defects propagate', async () => {
    const result = await runCli(['--profile', join(ws.root, 'none.json'), 'list'])
    expect(result).toMatchObject({ kind: 'error', error: { kind: 'config-missing' } })
    if (result.kind !== 'error') throw new Error('expected a handled failure')
    expect(result.error.message).toMatch(/pass --profile <file>/)
    ws.file('defect.mjs', 'export const name = "d"; export function apply() { throw new TypeError("defect") }')
    await expect(runCli(['--profile', ws.config({ plugins: ['./defect.mjs'] }), 'list'])).rejects.toThrow(TypeError)
  })

  it('reports a default-exported function plugin as a handled plugin-invalid failure, not a defect', async () => {
    const plugin = ws.file('tag.mjs', DEFAULT_FUNCTION_PLUGIN)
    const result = await runCli(['--profile', ws.config({ plugins: ['./tag.mjs'] }), 'list'])
    expect(result).toMatchObject({ kind: 'error', error: { kind: 'plugin-invalid' } })
    if (result.kind !== 'error') throw new Error('unreachable')
    expect(result.error.message).toContain(plugin)
  })
})

describe('exitCodeFor', () => {
  const error = (kind: PlugletError['kind']): RunResult => ({ kind: 'error', error: new PlugletError(kind, kind) })
  it('maps ok to 0, usage to 2, other handled failures to 1', () => {
    expect(exitCodeFor({ kind: 'ok', lines: [] })).toBe(0)
    expect(exitCodeFor(error('usage'))).toBe(2)
    for (const kind of ['config-missing', 'config-invalid', 'plugin-invalid', 'duplicate-registration', 'unknown-command'] as const) {
      expect(exitCodeFor(error(kind))).toBe(1)
    }
  })

  it('treats an unknown kind as a defect', () => {
    expect(() => exitCodeFor(error('bogus' as PlugletError['kind']))).toThrow(/unreachable/)
  })
})
