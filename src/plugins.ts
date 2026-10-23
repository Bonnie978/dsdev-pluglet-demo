/**
 * Plugin loading. A plugin module either named-exports `name` and `apply(ctx)` or
 * default-exports one object carrying both; `apply` registers commands through the
 * context and returns nothing. Any other default export (a function, a primitive) is
 * `plugin-invalid` at load, never silently adapted. Registrations are effects:
 * `loadPlugins()` returns one disposer that unwinds every plugin's contributions.
 * @module plugins
 */
import { pathToFileURL } from 'node:url'
import { PlugletError } from './errors.ts'
import type { Disposer, Registry } from './registry.ts'
import type { TaskStore } from './store.ts'

/** A model of one CLI command contributed by a plugin or the core. */
export interface Command {
  /** One-line help text shown by `pluglet help`. */
  readonly description: string
  /**
   * @param args - Positional arguments after the command name.
   * @returns Lines to print; the CLI joins them with newlines.
   */
  run(args: readonly string[]): string[]
}

/** What a plugin's `apply` receives. */
export interface PluginContext {
  readonly commands: Registry<Command>
  readonly store: TaskStore
  /** Register a cleanup that runs when the plugin tree is disposed. */
  effect(dispose: Disposer): void
}

/** The named exports a plugin module provides. */
export interface PluginModule {
  readonly name: string
  apply(ctx: PluginContext): void
}

/**
 * Normalize an imported module namespace to the plugin exports.
 * @param exports - The namespace returned by `import()`.
 * @param path - Module path, for diagnostics.
 * @returns The plugin module.
 * @throws PlugletError('plugin-invalid') when the default export is not an object, or when
 *   `name` or `apply` is missing. The object check comes first: a default-exported function
 *   owns `.name` and inherits `Function.prototype.apply`, so probing those properties alone
 *   would accept the function as a plugin (docs/postmortem/0001).
 */
export function unwrapPlugin(exports: unknown, path: string): PluginModule {
  const ns = exports as { default?: unknown }
  const unwrapped: unknown = ns.default ?? ns
  if (typeof unwrapped !== 'object') {
    throw new PlugletError('plugin-invalid', `plugin ${path}: default export is a ${typeof unwrapped}, not a plugin object; export "name" and "apply(ctx)" as named exports, or default-export an object { name, apply }`)
  }
  const candidate = unwrapped as Partial<PluginModule>
  if (typeof candidate.name !== 'string' || candidate.name === '') {
    throw new PlugletError('plugin-invalid', `plugin ${path} must export a non-empty string "name"`)
  }
  if (typeof candidate.apply !== 'function') {
    throw new PlugletError('plugin-invalid', `plugin ${path} must export an "apply(ctx)" function`)
  }
  return { name: candidate.name, apply: candidate.apply }
}

/**
 * Import and apply every plugin in order. A failure in plugin N disposes plugins 1..N-1
 * before rethrowing, so a half-applied tree never survives.
 * @param paths - Absolute module paths from the validated config.
 * @param ctx - Context without `effect`; this function supplies it.
 * @returns A disposer that unwinds all plugin contributions in reverse order.
 */
export async function loadPlugins(paths: readonly string[], ctx: Omit<PluginContext, 'effect'>): Promise<Disposer> {
  const disposers: Disposer[] = []
  const disposeAll: Disposer = () => {
    for (const d of disposers.splice(0).reverse()) d()
  }
  for (const path of paths) {
    let exports: unknown
    try {
      exports = await import(pathToFileURL(path).href)
    } catch (error) {
      disposeAll()
      throw new PlugletError('plugin-invalid', `plugin ${path} failed to import`, { cause: error })
    }
    const plugin = unwrapPlugin(exports, path)
    try {
      plugin.apply({ ...ctx, effect: d => disposers.push(d) })
    } catch (error) {
      disposeAll()
      throw error
    }
  }
  return disposeAll
}
