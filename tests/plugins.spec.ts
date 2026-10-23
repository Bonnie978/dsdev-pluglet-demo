import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { PlugletError } from '../src/errors.ts'
import { loadPlugins, unwrapPlugin, type Command } from '../src/plugins.ts'
import { Registry } from '../src/registry.ts'
import { TaskStore } from '../src/store.ts'
import { makeWorkspace, SHOUT_PLUGIN, type Workspace } from './harness.ts'

describe('unwrapPlugin', () => {
  it('accepts a namespace with name and apply', () => {
    const plugin = unwrapPlugin({ name: 'x', apply() {} }, 'x.mjs')
    expect(plugin.name).toBe('x')
  })

  it('accepts a default-exported plugin object', () => {
    expect(unwrapPlugin({ default: { name: 'y', apply() {} } }, 'y.mjs').name).toBe('y')
  })

  it('rejects a missing name or apply with plugin-invalid', () => {
    for (const bad of [{}, { name: '' }, { name: 'z' }, { apply() {} }]) {
      let caught: unknown
      try { unwrapPlugin(bad, 'bad.mjs') } catch (error) { caught = error }
      expect((caught as PlugletError).kind).toBe('plugin-invalid')
    }
  })
})

describe('loadPlugins', () => {
  let ws: Workspace
  const ctx = () => ({ commands: new Registry<Command>('command'), store: new TaskStore(join(ws.root, 'tasks.json')) })
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('applies plugins in order and the returned disposer unwinds their effects', async () => {
    const c = ctx()
    const dispose = await loadPlugins([ws.file('shout.mjs', SHOUT_PLUGIN)], c)
    expect(c.commands.names()).toEqual(['shout'])
    dispose()
    expect(c.commands.names()).toEqual([])
  })

  it('disposes earlier plugins when a later one fails to import', async () => {
    const c = ctx()
    const good = ws.file('shout.mjs', SHOUT_PLUGIN)
    const broken = ws.file('broken.mjs', 'export const name = "b"; export function apply() {}; throw new Error("boom")')
    await expect(loadPlugins([good, broken], c)).rejects.toMatchObject({ kind: 'plugin-invalid' })
    expect(c.commands.names()).toEqual([])
  })

  it('disposes earlier plugins and rethrows when apply throws', async () => {
    const c = ctx()
    const good = ws.file('shout.mjs', SHOUT_PLUGIN)
    const dup = ws.file('dup.mjs', SHOUT_PLUGIN) // registers the same name → duplicate-registration
    await expect(loadPlugins([good, dup], c)).rejects.toMatchObject({ kind: 'duplicate-registration' })
    expect(c.commands.names()).toEqual([])
  })
})
