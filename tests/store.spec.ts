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

  it('reads an absent file as no tasks, assigns sequential ids, and lists tasks in insertion order', () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    expect(store.list()).toEqual([])
    expect(store.add('one')).toEqual({ id: 1, title: 'one', done: false })
    expect(store.add('two').id).toBe(2)
    expect(store.list().map(t => t.title)).toEqual(['one', 'two'])
    // Verify the world: the file holds exactly the published state and no temp file remains.
    expect(JSON.parse(readFileSync(store.path, 'utf8'))).toHaveLength(2)
    expect(existsSync(`${store.path}.tmp`)).toBe(false)
  })

  it('lists a published array in publish order and appends the next id after the highest one', () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    store.publish([{ id: 3, title: 'c', done: false }, { id: 1, title: 'a', done: true }])
    expect(store.list().map(t => t.id)).toEqual([3, 1])
    expect(store.add('d').id).toBe(4)
    expect(store.list().map(t => t.id)).toEqual([3, 1, 4])
  })

  it('rejects an empty title as a usage failure without touching the file', () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    expect(() => store.add('   ')).toThrow(PlugletError)
    expect(existsSync(store.path)).toBe(false)
  })

  it('completes a task once; a repeat is a no-op that leaves the file bytes untouched', () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    store.add('one')
    store.add('two')
    expect(store.complete(2)).toEqual({ task: { id: 2, title: 'two', done: true }, changed: true })
    expect(store.list().map(t => t.done)).toEqual([false, true])
    const before = readFileSync(store.path)
    expect(store.complete(2)).toEqual({ task: { id: 2, title: 'two', done: true }, changed: false })
    expect(readFileSync(store.path).equals(before)).toBe(true)
    expect(existsSync(`${store.path}.tmp`)).toBe(false)
  })

  it('rejects an unknown id as unknown-task without touching the file', () => {
    const store = new TaskStore(join(ws.root, 'tasks.json'))
    store.add('one')
    const before = readFileSync(store.path)
    let caught: unknown
    try { store.complete(7) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(PlugletError)
    expect((caught as PlugletError).kind).toBe('unknown-task')
    expect(readFileSync(store.path).equals(before)).toBe(true)
  })

  it('fails loud on a corrupt or non-array store file', () => {
    expect(() => new TaskStore(ws.file('bad.json', '{')).list()).toThrow(PlugletError)
    expect(() => new TaskStore(ws.file('obj.json', '{}')).list()).toThrow(PlugletError)
  })
})
