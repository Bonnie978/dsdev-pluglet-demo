// Shared fixtures for pluglet tests: private per-test temp roots and plugin files.
// Lives in a plain module (not a spec) so importing it never re-registers a describe.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** A disposable workspace. Register `dispose` in afterEach so failures also clean up. */
export interface Workspace {
  readonly root: string
  file(name: string, content: string): string
  /** Write `body` as the default profile file `pluglet.profile.json` and return its path. */
  config(body: Record<string, unknown>): string
  dispose(): void
}

/** Create a private temp root; never a predictable shared path. */
export function makeWorkspace(): Workspace {
  const root = mkdtempSync(join(tmpdir(), 'pluglet-'))
  return {
    root,
    file(name, content) {
      const path = join(root, name)
      writeFileSync(path, content)
      return path
    },
    config(body) {
      return this.file('pluglet.profile.json', `${JSON.stringify(body)}\n`)
    },
    dispose() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}

/** Source of a well-formed plugin that registers a `shout` command. */
export const SHOUT_PLUGIN = `
export const name = 'shout'
export function apply(ctx) {
  ctx.effect(ctx.commands.register('shout', {
    description: 'Upper-case the arguments.',
    run: (args) => [args.join(' ').toUpperCase()],
  }))
}
`
