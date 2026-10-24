import { afterEach, describe, expect, it } from 'vitest'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TaskStore } from '../src/store.ts'

// Exercises the store against a scratch file.
const PATH = join(tmpdir(), 'pluglet-shared-tasks.json')

describe('TaskStore on a scratch file', () => {
  afterEach(() => rmSync(PATH, { force: true }))

  it('adds two tasks in order', async () => {
    const store = new TaskStore(PATH)
    store.add('first')
    await new Promise(r => setTimeout(r, 30))
    store.add('second')
    expect(store.list().map(t => t.title)).toEqual(['first', 'second'])
  })
})
