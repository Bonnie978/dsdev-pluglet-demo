import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { registerCoreCommands, resolveCommand } from '../src/commands.ts'
import type { Command } from '../src/plugins.ts'
import { Registry } from '../src/registry.ts'
import { TaskStore } from '../src/store.ts'
import { makeWorkspace, type Workspace } from './harness.ts'

describe('core commands', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('add then list reflects the store; help lists every command; disposer removes them', () => {
    const commands = new Registry<Command>('command')
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    const dispose = registerCoreCommands(commands, store)
    expect(resolveCommand(commands, 'add').run(['buy', 'milk'])).toEqual(['added 1: buy milk'])
    expect(resolveCommand(commands, 'list').run([])).toEqual(['1 [ ] buy milk'])
    store.publish([{ id: 1, title: 'buy milk', done: true }])
    expect(resolveCommand(commands, 'list').run([])).toEqual(['1 [x] buy milk'])
    expect(resolveCommand(commands, 'help').run([]).map(l => l.split('  ')[0])).toEqual(['list', 'add', 'help'])
    dispose()
    expect(commands.names()).toEqual([])
  })

  it('names the available commands when the command is unknown', () => {
    const commands = new Registry<Command>('command')
    commands.register('only', { description: '', run: () => [] })
    expect(() => resolveCommand(commands, 'nope')).toThrow(/available: only/)
  })
})
