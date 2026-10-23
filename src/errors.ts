/**
 * Typed, structured failures shared by every pluglet module. Handlers switch on the
 * `kind` discriminant; the message is display text and never routes behavior.
 * @module errors
 */

/** Discriminants for failures a caller is expected to handle. */
export type PlugletErrorKind =
  | 'config-missing'
  | 'config-invalid'
  | 'plugin-invalid'
  | 'duplicate-registration'
  | 'unknown-command'
  | 'usage'

/**
 * A failure with a stable machine-readable `kind` and a human-readable message.
 * The `cause` is preserved for diagnostics and never inspected for routing.
 */
export class PlugletError extends Error {
  /** Stable discriminant a handler switches on. */
  readonly kind: PlugletErrorKind

  /**
   * @param kind - Stable discriminant.
   * @param message - Display text naming the failing subject and the correction.
   * @param options - Optional underlying cause.
   */
  constructor(kind: PlugletErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PlugletError'
    this.kind = kind
  }
}

/**
 * Exhaustiveness guard for closed unions; reaching it is a defect, not a handled failure.
 * @param value - The value TypeScript believes impossible.
 * @returns Never; always throws.
 */
export function assertNever(value: never): never {
  throw new Error(`unreachable: ${JSON.stringify(value)}`)
}
