/**
 * Argument parsing and the run loop. `runCli()` is the only entry both the bin and the
 * tests use, so a test that drives it exercises the real composition: config → store →
 * core commands → plugins → command. Exit codes: 0 success, 1 handled PlugletError, 2 usage.
 * @module cli
 */
import { registerCoreCommands, resolveCommand } from './commands.ts'
import { loadConfig } from './config.ts'
import { assertNever, PlugletError } from './errors.ts'
import { loadPlugins, type Command } from './plugins.ts'
import { Registry } from './registry.ts'
import { TaskStore } from './store.ts'

/** Parsed argv; defaulting is an explicit `resolve` step, never hidden in `run()`. */
export interface Invocation {
  /** Path of the profile (config) file, as given to `--profile` or the default `pluglet.profile.json`. */
  readonly configPath: string
  readonly command: string
  readonly args: readonly string[]
}

/**
 * Parse `pluglet [--profile <file>] <command> [args...]`. `--profile` is the only option;
 * any other token starting with `--`, in any position, is a usage error, so an unsupported
 * option never reaches a command as an argument.
 * @param argv - Arguments after the program name.
 * @returns The invocation with `--profile` defaulted to `pluglet.profile.json` when absent.
 * @throws PlugletError('usage') when `--profile` lacks a value, when a token other than
 *   `--profile` starts with `--`, or when no command is given.
 */
export function parseArgv(argv: readonly string[]): Invocation {
  let configPath = 'pluglet.profile.json'
  const rest: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--profile') {
      const value = argv[i + 1]
      if (value === undefined) throw new PlugletError('usage', '--profile requires a file path')
      configPath = value
      i++
    } else if (arg.startsWith('--')) {
      throw new PlugletError('usage', `unknown option "${arg}"; the only option is --profile <file>`)
    } else {
      rest.push(arg)
    }
  }
  const [command, ...args] = rest
  if (command === undefined) throw new PlugletError('usage', 'usage: pluglet [--profile <file>] <command> [args...]')
  return { configPath, command, args }
}

/** Result of one run; the bin maps it to stdout/stderr and an exit code. */
export type RunResult =
  | { readonly kind: 'ok'; readonly lines: string[] }
  | { readonly kind: 'error'; readonly error: PlugletError }

/**
 * Run one invocation against the real composition.
 * @param argv - Arguments after the program name.
 * @returns The lines to print, or the handled failure. Defects (non-PlugletError) propagate.
 */
export async function runCli(argv: readonly string[]): Promise<RunResult> {
  try {
    const invocation = parseArgv(argv)
    const config = loadConfig(invocation.configPath)
    const store = new TaskStore(config.storePath)
    const commands = new Registry<Command>('command')
    const disposeCore = registerCoreCommands(commands, store)
    const disposePlugins = await loadPlugins(config.plugins, { commands, store })
    try {
      const command = resolveCommand(commands, invocation.command)
      return { kind: 'ok', lines: command.run(invocation.args) }
    } finally {
      disposePlugins()
      disposeCore()
    }
  } catch (error) {
    if (error instanceof PlugletError) return { kind: 'error', error }
    throw error
  }
}

/**
 * Map a run result to a process exit code.
 * @param result - The run result.
 * @returns 0 for success, 2 for usage errors, 1 for every other handled failure.
 */
export function exitCodeFor(result: RunResult): number {
  if (result.kind === 'ok') return 0
  switch (result.error.kind) {
    case 'usage':
      return 2
    case 'config-missing':
    case 'config-invalid':
    case 'plugin-invalid':
    case 'duplicate-registration':
    case 'unknown-command':
      return 1
    default:
      return assertNever(result.error.kind)
  }
}
