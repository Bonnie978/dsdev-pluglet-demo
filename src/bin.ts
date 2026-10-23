#!/usr/bin/env node
/**
 * Process entry: runs the CLI and maps the result to stdout, stderr and an exit code.
 * Kept free of logic so the real-entry-path e2e exercises `runCli` through built `lib/`.
 * @module bin
 */
import { exitCodeFor, runCli } from './cli.ts'

const result = await runCli(process.argv.slice(2))
if (result.kind === 'ok') {
  for (const line of result.lines) process.stdout.write(`${line}\n`)
} else {
  process.stderr.write(`pluglet: ${result.error.message}\n`)
}
process.exitCode = exitCodeFor(result)
