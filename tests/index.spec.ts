import { describe, expect, it } from 'vitest'
import * as api from '../src/index.ts'

// The public API is a contract: every runtime export a plugin author or embedder relies on
// is named here, so an accidental removal fails this test instead of a downstream consumer.
describe('public API', () => {
  it('exports the documented runtime symbols', () => {
    expect(Object.keys(api).sort()).toEqual([
      'PlugletError', 'Registry', 'TaskStore', 'exitCodeFor', 'loadConfig', 'loadPlugins',
      'parseArgv', 'registerCoreCommands', 'resolveCommand', 'runCli', 'unwrapPlugin',
    ])
  })
})
