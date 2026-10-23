import { describe, expect, it } from 'vitest'
import { PlugletError } from '../src/errors.ts'
import { Registry } from '../src/registry.ts'

describe('Registry', () => {
  it('registers, looks up, and lists in order', () => {
    const r = new Registry<number>('thing')
    r.register('a', 1)
    r.register('b', 2)
    expect(r.get('a')).toBe(1)
    expect(r.get('missing')).toBeUndefined()
    expect(r.names()).toEqual(['a', 'b'])
  })

  it('rejects a duplicate name with a typed failure and keeps the first entry', () => {
    const r = new Registry<number>('thing')
    r.register('a', 1)
    let caught: unknown
    try { r.register('a', 2) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(PlugletError)
    expect((caught as PlugletError).kind).toBe('duplicate-registration')
    expect(r.get('a')).toBe(1)
  })

  // Registrations are effects: the disposer removes exactly its own entry (HMR safety).
  it('disposer removes its registration, is idempotent, and never removes a successor', () => {
    const r = new Registry<number>('thing')
    const dispose = r.register('a', 1)
    dispose()
    expect(r.get('a')).toBeUndefined()
    r.register('a', 2)
    dispose() // stale disposer must not remove the new owner
    expect(r.get('a')).toBe(2)
  })
})
