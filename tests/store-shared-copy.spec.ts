import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { TaskStore } from '../src/store.ts'
import { makeWorkspace, type Workspace } from './harness.ts'

// Exercises the store against a scratch file in a private per-test temp root.
describe('TaskStore on a scratch file', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('adds two tasks in order (copy)', async () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    store.add('first')
    await new Promise(r => setTimeout(r, 30))
    store.add('second')
    expect(store.list().map(t => t.title)).toEqual(['first', 'second'])
  })
})
