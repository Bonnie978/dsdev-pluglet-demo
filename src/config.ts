/**
 * Configuration loading. Misconfiguration fails loud at load: a missing file, invalid
 * JSON, an unknown key, or a plugin path that does not exist is a `PlugletError`, never a
 * silently skipped entry.
 * @module config
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PlugletError } from './errors.ts'

/** The validated configuration a run uses. All paths are absolute. */
export interface Config {
  /** Absolute path of the JSON file holding tasks. */
  readonly storePath: string
  /** Absolute paths of plugin modules to load, in order. */
  readonly plugins: readonly string[]
}

/** The fields a config file may contain; everything else is rejected. */
const KNOWN_KEYS = new Set(['store', 'plugins'])

/**
 * Read and validate a config file.
 * @param path - Path to the JSON config file; relative paths resolve from the current directory.
 * @returns The validated configuration with every path made absolute relative to the config file.
 * @throws PlugletError with kind `config-missing` or `config-invalid`.
 */
export function loadConfig(path: string): Config {
  const abs = resolve(path)
  if (!existsSync(abs)) throw new PlugletError('config-missing', `config file ${abs} does not exist; pass --profile <file>`)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (error) {
    throw new PlugletError('config-invalid', `config file ${abs} is not valid JSON`, { cause: error })
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new PlugletError('config-invalid', `config file ${abs} must contain a JSON object`)
  }
  const record = raw as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!KNOWN_KEYS.has(key)) throw new PlugletError('config-invalid', `config file ${abs}: unknown key "${key}" (known: ${[...KNOWN_KEYS].join(', ')})`)
  }
  const base = dirname(abs)
  const store = record.store ?? 'tasks.json'
  if (typeof store !== 'string' || store === '') throw new PlugletError('config-invalid', `config file ${abs}: "store" must be a non-empty string`)
  const plugins = record.plugins ?? []
  if (!Array.isArray(plugins) || !plugins.every(p => typeof p === 'string' && p !== '')) {
    throw new PlugletError('config-invalid', `config file ${abs}: "plugins" must be an array of non-empty strings`)
  }
  const pluginPaths = plugins.map(p => resolve(base, p))
  for (const p of pluginPaths) {
    if (!existsSync(p)) throw new PlugletError('config-invalid', `config file ${abs}: plugin ${p} does not exist`)
  }
  return { storePath: resolve(base, store), plugins: pluginPaths }
}
