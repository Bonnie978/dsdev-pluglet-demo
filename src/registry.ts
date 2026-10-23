/**
 * A named registry whose contributions are effects: `register()` returns the disposer
 * that removes the entry. Duplicate names fail loud instead of overwriting.
 * @module registry
 */
import { PlugletError } from './errors.ts'

/** Removes one registration; idempotent after the first call. */
export type Disposer = () => void

/**
 * Owns a dynamic set of named entries with duplicate rejection and disposal.
 * Shared state hangs on the instance; there is no module-level singleton.
 */
export class Registry<T> {
  private readonly entries = new Map<string, T>()

  /**
   * @param role - Role name used in diagnostics, for example `command`.
   */
  constructor(private readonly role: string) {}

  /**
   * Add an entry. A second registration under the same name throws
   * `PlugletError('duplicate-registration')` and leaves the first entry in place.
   * @param name - Unique entry name.
   * @param value - The contribution.
   * @returns The disposer that removes exactly this registration.
   */
  register(name: string, value: T): Disposer {
    if (this.entries.has(name)) {
      throw new PlugletError('duplicate-registration', `${this.role} "${name}" is already registered; dispose the first registration before replacing it`)
    }
    this.entries.set(name, value)
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (this.entries.get(name) === value) this.entries.delete(name)
    }
  }

  /**
   * @param name - Entry name.
   * @returns The entry, or `undefined` when no entry has that name.
   */
  get(name: string): T | undefined {
    return this.entries.get(name)
  }

  /** @returns Registered names in registration order. */
  names(): string[] {
    return [...this.entries.keys()]
  }
}
