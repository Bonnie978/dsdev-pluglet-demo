import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { registerCoreCommands, resolveCommand } from '../src/commands.ts'
import { PlugletError } from '../src/errors.ts'
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
    expect(resolveCommand(commands, 'help').run([]).map(l => l.split('  ')[0])).toEqual(['list', 'add', 'done', 'help'])
    dispose()
    expect(commands.names()).toEqual([])
  })

  it('done marks a task so list shows [x]; repeating reports already done; unknown id fails as unknown-task', () => {
    const commands = new Registry<Command>('command')
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    registerCoreCommands(commands, store)
    resolveCommand(commands, 'add').run(['buy', 'milk'])
    resolveCommand(commands, 'add').run(['walk', 'dog'])
    const done = resolveCommand(commands, 'done')
    expect(done.run(['1'])).toEqual(['done 1: buy milk'])
    expect(resolveCommand(commands, 'list').run([])).toEqual(['1 [x] buy milk', '2 [ ] walk dog'])
    expect(done.run(['1'])).toEqual(['already done 1: buy milk'])
    let caught: unknown
    try { done.run(['9']) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(PlugletError)
    expect((caught as PlugletError).kind).toBe('unknown-task')
  })

  it('done rejects a missing, non-integer, or extra id argument as a usage failure', () => {
    const commands = new Registry<Command>('command')
    registerCoreCommands(commands, new TaskStore(join(ws.root, 'tasks.json')))
    const done = resolveCommand(commands, 'done')
    for (const args of [[], ['abc'], ['0'], ['-1'], ['1.5'], ['1', '2']]) {
      let caught: unknown
      try { done.run(args) } catch (error) { caught = error }
      expect(caught, `args ${JSON.stringify(args)}`).toBeInstanceOf(PlugletError)
      expect((caught as PlugletError).kind, `args ${JSON.stringify(args)}`).toBe('usage')
    }
  })

  it('names the available commands when the command is unknown', () => {
    const commands = new Registry<Command>('command')
    commands.register('only', { description: '', run: () => [] })
    expect(() => resolveCommand(commands, 'nope')).toThrow(/available: only/)
  })
})
