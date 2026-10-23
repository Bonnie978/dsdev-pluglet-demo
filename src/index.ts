/**
 * Public API: everything a plugin author or embedder imports.
 * @module index
 */
export { PlugletError, type PlugletErrorKind } from './errors.ts'
export { Registry, type Disposer } from './registry.ts'
export { loadConfig, type Config } from './config.ts'
export { TaskStore, type Task } from './store.ts'
export { loadPlugins, unwrapPlugin, type Command, type PluginContext, type PluginModule } from './plugins.ts'
export { registerCoreCommands, resolveCommand } from './commands.ts'
export { parseArgv, runCli, exitCodeFor, type Invocation, type RunResult } from './cli.ts'
