import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { runCli } from '../../src/cli.ts'
import { makeWorkspace, type Workspace } from '../harness.ts'

// User-visible output is pinned verbatim. Refresh deliberately with DSDEV_SNAPSHOT=refresh
// and review the diff as a behavior change, never as formatting noise.
const EXPECTED = new URL('./help.expected.txt', import.meta.url)

describe('help output', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  it('matches the recorded expected output', async () => {
    const result = await runCli(['--config', ws.config({}), 'help'])
    if (result.kind !== 'ok') throw new Error(result.error.message)
    const actual = `${result.lines.join('\n')}\n`
    if (process.env.DSDEV_SNAPSHOT === 'refresh') writeFileSync(EXPECTED, actual)
    expect(actual).toBe(readFileSync(EXPECTED, 'utf8'))
  })
})
