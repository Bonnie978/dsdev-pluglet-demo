/**
 * Durable task storage as one JSON file. Writes publish atomically (temp file + rename)
 * so a crash mid-write never leaves a torn file; readers see the previous or the new
 * complete state.
 * @module store
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { PlugletError } from './errors.ts'

/** One task record. Ids are sequential positive integers assigned by the store. */
export interface Task {
  readonly id: number
  readonly title: string
  readonly done: boolean
}

/**
 * Owns the task file. Each public method reads the file, applies one change, and
 * publishes the complete result; there is no in-memory cache to drift.
 */
export class TaskStore {
  /**
   * @param path - Absolute path of the JSON file; created on first write.
   */
  constructor(readonly path: string) {}

  /** @returns Every task in id order; an absent file reads as no tasks. */
  list(): Task[] {
    if (!existsSync(this.path)) return []
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(this.path, 'utf8'))
    } catch (error) {
      throw new PlugletError('config-invalid', `task store ${this.path} is not valid JSON; repair or delete it`, { cause: error })
    }
    if (!Array.isArray(raw)) throw new PlugletError('config-invalid', `task store ${this.path} must contain a JSON array`)
    return raw as Task[]
  }

  /**
   * Append a task with the next sequential id and publish the file.
   * @param title - Non-empty task title.
   * @returns The stored task.
   * @throws PlugletError('usage') for an empty title.
   */
  add(title: string): Task {
    if (title.trim() === '') throw new PlugletError('usage', 'task title must not be empty')
    const tasks = this.list()
    const id = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1
    const task: Task = { id, title, done: false }
    this.publish([...tasks, task])
    return task
  }

  /**
   * Replace the whole task list atomically.
   * @param tasks - The complete new state.
   */
  publish(tasks: readonly Task[]): void {
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, `${JSON.stringify(tasks, null, 2)}\n`)
    renameSync(tmp, this.path)
  }
}
