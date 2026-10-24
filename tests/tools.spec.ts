import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgv, runCli } from '../src/cli.ts'
import { registerCoreCommands } from '../src/commands.ts'
import type { Command } from '../src/plugins.ts'
import { Registry } from '../src/registry.ts'
import { TaskStore } from '../src/store.ts'
import { makeWorkspace, SHOUT_PLUGIN, type Workspace } from './harness.ts'

// The manifest is model-visible text (README § 给 LLM Agent 暴露工具). Its rules are checked by a
// pure validator so the real file and hand-built invalid manifests run through the same code.
const MANIFEST = new URL('../tools/pluglet.tools.json', import.meta.url)
const TOOL_NAME = /^[a-z][a-z0-9_]*$/

type Json = Record<string, unknown>
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Normalized sentences of a description: split on terminal punctuation, lower-cased, whitespace collapsed. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').toLowerCase())
    .filter(s => s !== '')
}

/**
 * Every rule the manifest must satisfy, as human-readable violations (empty when valid).
 * Takes the file text so an unparsable file is a violation, not a test crash.
 */
function violations(text: string): string[] {
  const out: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return ['manifest is not valid JSON']
  }
  if (!isRecord(parsed)) return ['manifest must be a JSON object']
  if (typeof parsed.systemPromptSection !== 'string' || parsed.systemPromptSection.trim() === '') out.push('systemPromptSection: missing or empty')
  if (!Array.isArray(parsed.tools) || parsed.tools.length === 0) return [...out, 'tools: missing or empty array']

  const toolSentences = new Map<string, string>() // sentence -> tool that owns it
  const parameterSentences = new Set<string>()
  const names = new Set<string>()
  parsed.tools.forEach((tool, index) => {
    const at = `tools[${index}]`
    if (!isRecord(tool)) { out.push(`${at}: must be an object`); return }
    const name = typeof tool.name === 'string' ? tool.name : null
    if (name === null || !TOOL_NAME.test(name)) out.push(`${at}: name must be a snake_case string`)
    else if (names.has(name)) out.push(`${at}: duplicate tool name ${name}`)
    else names.add(name)
    const label = name ?? at
    if (typeof tool.description !== 'string' || tool.description.trim() === '') out.push(`${label}: description missing or empty`)
    else {
      for (const s of sentences(tool.description)) {
        const owner = toolSentences.get(s)
        if (owner !== undefined && owner !== label) out.push(`${label}: description repeats a sentence of ${owner}: "${s}"`)
        else toolSentences.set(s, label)
      }
    }
    const schema = tool.parameters
    if (!isRecord(schema) || schema.type !== 'object' || !isRecord(schema.properties)) {
      out.push(`${label}: parameters must be a JSON Schema object with type "object" and properties`)
      return
    }
    for (const [param, def] of Object.entries(schema.properties)) {
      if (!isRecord(def) || typeof def.description !== 'string' || def.description.trim() === '') {
        out.push(`${label}.parameters.${param}: missing description`)
        continue
      }
      for (const s of sentences(def.description)) parameterSentences.add(s)
    }
    if (schema.required !== undefined) {
      if (!Array.isArray(schema.required)) out.push(`${label}: required must be an array`)
      else for (const r of schema.required) if (typeof r !== 'string' || !(r in schema.properties)) out.push(`${label}: required names unknown parameter ${JSON.stringify(r)}`)
    }
  })

  if (typeof parsed.systemPromptSection === 'string') {
    for (const s of sentences(parsed.systemPromptSection)) {
      const owner = toolSentences.get(s)
      if (owner !== undefined) out.push(`systemPromptSection: restates a sentence of ${owner}: "${s}"`)
      else if (parameterSentences.has(s)) out.push(`systemPromptSection: restates a parameter description: "${s}"`)
    }
  }
  return out
}

interface Manifest { systemPromptSection: string; tools: { name: string; description: string; parameters: { properties: Record<string, Json>; required?: string[] } }[] }
const text = readFileSync(MANIFEST, 'utf8')
const manifest = JSON.parse(text) as Manifest
/** The tool named `name` in `m`; a missing tool is a defect of the manifest, reported by name. */
function tool(name: string, m: Manifest = manifest) {
  const found = m.tools.find(t => t.name === name)
  if (found === undefined) throw new Error(`manifest has no tool ${name}`)
  return found
}
const mutated = (edit: (m: Manifest) => void) => { const m = structuredClone(manifest); edit(m); return violations(JSON.stringify(m)) }

describe('tools/pluglet.tools.json', () => {
  it('satisfies every manifest rule', () => {
    expect(violations(text)).toEqual([])
  })

  it('exposes exactly the core commands, with the CLI default for `profile`', () => {
    const commands = new Registry<Command>('command')
    const dispose = registerCoreCommands(commands, new TaskStore('/unused/tasks.json'))
    const core = commands.names().map(n => `pluglet_${n}`)
    dispose()
    expect(manifest.tools.map(t => t.name), 'one tool per core command, in registration order').toEqual(core)
    const profiles = manifest.tools.map(t => t.parameters.properties.profile)
    for (const profile of profiles) {
      expect(profile, 'every tool takes the profile path').toBeDefined()
      expect(profile, 'the shared parameter has one definition').toEqual(profiles[0])
    }
    expect(profiles[0]!.default).toBe(parseArgv(['help']).configPath)
    expect(tool('pluglet_done').parameters.required, 'done needs a task id').toEqual(['id'])
    expect(tool('pluglet_done').parameters.properties.id).toMatchObject({ type: 'integer', minimum: 1 })
  })
})

describe('manifest validator (rejected cases)', () => {
  it('rejects text that is not JSON or not an object', () => {
    expect(violations('{')).toEqual(['manifest is not valid JSON'])
    expect(violations('[]')).toEqual(['manifest must be a JSON object'])
  })

  it('rejects a tool missing one of name, description or parameters', () => {
    expect(mutated(m => { tool('pluglet_add', m).name = 'Pluglet Add' })).toContain('tools[1]: name must be a snake_case string')
    expect(mutated(m => { tool('pluglet_list', m).description = '' })).toContain('pluglet_list: description missing or empty')
    expect(mutated(m => { (tool('pluglet_help', m) as Json).parameters = { type: 'string' } })).toContain('pluglet_help: parameters must be a JSON Schema object with type "object" and properties')
  })

  it('rejects a parameter without a description and a required entry naming no parameter', () => {
    expect(mutated(m => { delete tool('pluglet_add', m).parameters.properties.title!.description })).toContain('pluglet_add.parameters.title: missing description')
    expect(mutated(m => { tool('pluglet_add', m).parameters.required = ['nope'] })).toContain('pluglet_add: required names unknown parameter "nope"')
    expect(mutated(m => { delete tool('pluglet_done', m).parameters.properties.id })).toContain('pluglet_done: required names unknown parameter "id"')
  })

  it('rejects two tools sharing a sentence', () => {
    const first = tool('pluglet_list').description.split(/(?<=\.)\s+/)[0]!
    expect(mutated(m => { tool('pluglet_help', m).description = `${first} Also something else.` }))
      .toContainEqual(expect.stringMatching(/^pluglet_help: description repeats a sentence of pluglet_list: /))
  })

  it('rejects a system prompt section that restates a tool or parameter description', () => {
    expect(mutated(m => { m.systemPromptSection += ` ${tool('pluglet_add').description}` }))
      .toContainEqual(expect.stringMatching(/^systemPromptSection: restates a sentence of pluglet_add: /))
    expect(mutated(m => { m.systemPromptSection = String(tool('pluglet_add').parameters.properties.title!.description) }))
      .toContainEqual(expect.stringMatching(/^systemPromptSection: restates a parameter description: /))
    expect(mutated(m => { m.systemPromptSection = ' ' })).toContain('systemPromptSection: missing or empty')
  })
})

// The descriptions make claims about what a call returns; a real run through `runCli` with the
// README's argv mapping keeps them from drifting when commands.ts changes.
describe('manifest claims against the real CLI', () => {
  let ws: Workspace
  beforeEach(() => { ws = makeWorkspace() })
  afterEach(() => { ws.dispose() })

  /** Run the README mapping for `name` (`pluglet --profile <profile> <command> [args...]`) and return its lines. */
  async function call(name: string, profile: string, ...args: string[]) {
    const result = await runCli(['--profile', profile, name.replace(/^pluglet_/, ''), ...args])
    if (result.kind !== 'ok') throw result.error
    return result.lines
  }

  it('list legend, add result, done idempotence and help lines hold as described', async () => {
    ws.file('shout.mjs', SHOUT_PLUGIN)
    const profile = ws.config({ plugins: ['./shout.mjs'] })
    const store = join(ws.root, 'tasks.json')
    expect(await call('pluglet_list', profile), 'empty output means no tasks').toEqual([])
    const added = await call('pluglet_add', profile, 'buy milk')
    expect(added, 'the result states the assigned id').toEqual([expect.stringMatching(/\b1\b/)])
    expect(JSON.parse(readFileSync(store, 'utf8')), 'a title with spaces is one argv element, stored verbatim').toEqual([{ id: 1, title: 'buy milk', done: false }])
    expect(await call('pluglet_list', profile)).toEqual(['1 [ ] buy milk'])
    expect(await call('pluglet_done', profile, String(1))).toHaveLength(1)
    expect(await call('pluglet_list', profile)).toEqual(['1 [x] buy milk'])
    const before = readFileSync(store)
    const again = await call('pluglet_done', profile, String(1))
    expect(again, 'already done succeeds and says so').toEqual([expect.stringMatching(/^already done 1\b/)])
    expect(readFileSync(store).equals(before), 'the list is unchanged').toBe(true)
    const pattern = new RegExp(String(tool('pluglet_add').parameters.properties.title!.pattern ?? ''))
    for (const title of ['--urgent fix', 'a --b', '-x']) {
      const run = await runCli(['--profile', profile, 'add', title])
      expect(pattern.test(title), `the title schema accepts ${JSON.stringify(title)} exactly when the CLI does`).toBe(run.kind === 'ok')
    }
    const unknown = await runCli(['--profile', profile, 'done', '42'])
    expect(unknown.kind === 'error' && unknown.error.kind, 'an id no task has is an error').toBe('unknown-task')
    const help = await call('pluglet_help', profile)
    expect(help, 'one line per command, core and plugin, with name and description').toEqual([
      ...['list', 'add', 'done', 'help'].map(n => expect.stringMatching(new RegExp(`^${n}  \\S`))),
      'shout  Upper-case the arguments.',
    ])
  })
})
