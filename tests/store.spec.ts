import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PlugletError } from '../src/errors.ts'
import { TaskStore } from '../src/store.ts'
import { makeWorkspace, type Workspace } from './harness.ts'

describe('TaskStore', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('reads an absent file as no tasks and assigns sequential ids', () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    expect(store.list()).toEqual([])
    expect(store.add('one')).toEqual({ id: 1, title: 'one', done: false })
    expect(store.add('two').id).toBe(2)
    // Verify the world: the file holds exactly the published state and no temp file remains.
    expect(JSON.parse(readFileSync(store.path, 'utf8'))).toHaveLength(2)
    expect(existsSync(`${store.path}.tmp`)).toBe(false)
  })

  it('rejects an empty title as a usage failure without touching the file', () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    expect(() => store.add('   ')).toThrow(PlugletError)
    expect(existsSync(store.path)).toBe(false)
  })

  it('fails loud on a corrupt or non-array store file', () => {
    expect(() => new TaskStore(ws.file('bad.json', '{')).list()).toThrow(PlugletError)
    expect(() => new TaskStore(ws.file('obj.json', '{}')).list()).toThrow(PlugletError)
  })
})
