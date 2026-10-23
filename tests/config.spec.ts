import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { loadConfig } from '../src/config.ts'
import { PlugletError } from '../src/errors.ts'
import { makeWorkspace, type Workspace } from './harness.ts'

const kindOf = (fn: () => unknown): string => {
  try { fn() } catch (error) { if (error instanceof PlugletError) return error.kind; throw error }
  return 'no-error'
}

describe('loadConfig', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('fails loud on a missing file', () => {
    expect(kindOf(() => loadConfig(join(ws.root, 'nope.json')))).toBe('config-missing')
  })

  it('fails loud on invalid JSON, non-object roots, and unknown keys', () => {
    expect(kindOf(() => loadConfig(ws.file('a.json', '{')))).toBe('config-invalid')
    expect(kindOf(() => loadConfig(ws.file('b.json', '[]')))).toBe('config-invalid')
    expect(kindOf(() => loadConfig(ws.file('c.json', 'null')))).toBe('config-invalid')
    expect(kindOf(() => loadConfig(ws.config({ verbose: true })))).toBe('config-invalid')
  })

  it('validates field types', () => {
    expect(kindOf(() => loadConfig(ws.config({ store: '' })))).toBe('config-invalid')
    expect(kindOf(() => loadConfig(ws.config({ store: 3 })))).toBe('config-invalid')
    expect(kindOf(() => loadConfig(ws.config({ plugins: 'x' })))).toBe('config-invalid')
    expect(kindOf(() => loadConfig(ws.config({ plugins: [''] })))).toBe('config-invalid')
  })

  // Misconfiguration fails loud: a missing plugin referent is rejected at load, not skipped.
  it('rejects a plugin path that does not exist', () => {
    expect(kindOf(() => loadConfig(ws.config({ plugins: ['./missing.mjs'] })))).toBe('config-invalid')
  })

  it('defaults the store and resolves every path relative to the config file', () => {
    const plugin = ws.file('p.mjs', 'export const name = "p"; export function apply() {}')
    const config = loadConfig(ws.config({ plugins: ['./p.mjs'] }))
    expect(config.storePath).toBe(join(ws.root, 'tasks.json'))
    expect(config.plugins).toEqual([plugin])
    expect(loadConfig(ws.config({ store: 'db/t.json' })).storePath).toBe(join(ws.root, 'db/t.json'))
  })
})
