/**
 * Core commands: `list`, `add`, `done`, `help`. Plugins add more through `ctx.commands`.
 * @module commands
 */
import { PlugletError } from './errors.ts'
import type { Command } from './plugins.ts'
import type { Disposer, Registry } from './registry.ts'
import type { TaskStore } from './store.ts'

/** A task id as typed on the command line: one positive decimal integer. */
const TASK_ID = /^[1-9]\d*$/

/**
 * Parse the arguments of `done <id>`.
 * @param args - Positional arguments after the command name.
 * @returns The task id.
 * @throws PlugletError('usage') unless exactly one positive integer is given.
 */
function parseTaskId(args: readonly string[]): number {
  const [id, ...extra] = args
  if (id === undefined || extra.length > 0 || !TASK_ID.test(id)) {
    throw new PlugletError('usage', 'usage: done <id> (one positive integer task id)')
  }
  return Number(id)
}

/**
 * Register the core commands.
 * @param commands - The command registry.
 * @param store - The task store commands operate on.
 * @returns A disposer that removes the core commands.
 */
export function registerCoreCommands(commands: Registry<Command>, store: TaskStore): Disposer {
  const disposers = [
    commands.register('list', {
      description: 'Print every task as "<id> [x] <title>".',
      run: () => store.list().map(t => `${t.id} [${t.done ? 'x' : ' '}] ${t.title}`),
    }),
    commands.register('add', {
      description: 'Add a task: add <title words...>.',
      run: (args) => {
        const task = store.add(args.join(' '))
        return [`added ${task.id}: ${task.title}`]
      },
    }),
    commands.register('done', {
      description: 'Mark a task done: done <id>. Already-done tasks are reported, not failed.',
      run: (args) => {
        const { task, changed } = store.complete(parseTaskId(args))
        return [`${changed ? 'done' : 'already done'} ${task.id}: ${task.title}`]
      },
    }),
    commands.register('help', {
      description: 'List commands.',
      run: () => commands.names().map(name => `${name}  ${commands.get(name)!.description}`),
    }),
  ]
  return () => { for (const d of disposers.reverse()) d() }
}

/**
 * Resolve a command by name.
 * @param commands - The command registry.
 * @param name - Command name from argv.
 * @returns The command.
 * @throws PlugletError('unknown-command') naming the available commands.
 */
export function resolveCommand(commands: Registry<Command>, name: string): Command {
  const command = commands.get(name)
  if (command === undefined) {
    throw new PlugletError('unknown-command', `unknown command "${name}"; available: ${commands.names().join(', ')}`)
  }
  return command
}
