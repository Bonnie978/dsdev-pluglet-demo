import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseArgv } from '../src/cli.ts'
import { registerCoreCommands } from '../src/commands.ts'
import type { Command } from '../src/plugins.ts'
import { Registry } from '../src/registry.ts'
import { TaskStore } from '../src/store.ts'

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

interface Manifest { systemPromptSection: string; tools: { name: string; description: string; parameters: { properties: Record<string, Json> } }[] }
const text = readFileSync(MANIFEST, 'utf8')
const manifest = JSON.parse(text) as Manifest
const mutated = (edit: (m: Manifest) => void) => { const m = structuredClone(manifest); edit(m); return violations(JSON.stringify(m)) }

describe('tools/pluglet.tools.json', () => {
  it('satisfies every manifest rule', () => {
    expect(violations(text)).toEqual([])
  })

  it('exposes exactly the core commands, with the CLI default for `config`', () => {
    const commands = new Registry<Command>('command')
    const dispose = registerCoreCommands(commands, new TaskStore('/unused/tasks.json'))
    const core = commands.names().map(n => `pluglet_${n}`).sort()
    dispose()
    expect(manifest.tools.map(t => t.name).sort()).toEqual(core)
    const configs = manifest.tools.map(t => t.parameters.properties.config)
    for (const config of configs) {
      expect(config, 'every tool takes the config path').toBeDefined()
      expect(config, 'the shared parameter has one definition').toEqual(configs[0])
    }
    expect(configs[0]!.default).toBe(parseArgv(['help']).configPath)
  })
})

describe('manifest validator (rejected cases)', () => {
  it('rejects text that is not JSON or not an object', () => {
    expect(violations('{')).toEqual(['manifest is not valid JSON'])
    expect(violations('[]')).toEqual(['manifest must be a JSON object'])
  })

  it('rejects a tool missing one of name, description or parameters', () => {
    expect(mutated(m => { m.tools[0]!.name = 'Pluglet Add' })).toContain('tools[0]: name must be a snake_case string')
    expect(mutated(m => { m.tools[1]!.description = '' })).toContain('pluglet_list: description missing or empty')
    expect(mutated(m => { (m.tools[2] as Json).parameters = { type: 'string' } })).toContain('pluglet_help: parameters must be a JSON Schema object with type "object" and properties')
  })

  it('rejects a parameter without a description and a required entry naming no parameter', () => {
    expect(mutated(m => { delete m.tools[0]!.parameters.properties.title!.description })).toContain('pluglet_add.parameters.title: missing description')
    expect(mutated(m => { (m.tools[0]!.parameters as Json).required = ['nope'] })).toContain('pluglet_add: required names unknown parameter "nope"')
  })

  it('rejects two tools sharing a sentence', () => {
    const first = manifest.tools[1]!.description.split(/(?<=\.)\s+/)[0]!
    expect(mutated(m => { m.tools[2]!.description = `${first} Also something else.` }))
      .toContainEqual(expect.stringMatching(/^pluglet_help: description repeats a sentence of pluglet_list: /))
  })

  it('rejects a system prompt section that restates a tool or parameter description', () => {
    expect(mutated(m => { m.systemPromptSection += ` ${manifest.tools[0]!.description}` }))
      .toContainEqual(expect.stringMatching(/^systemPromptSection: restates a sentence of pluglet_add: /))
    expect(mutated(m => { m.systemPromptSection = String(manifest.tools[0]!.parameters.properties.title!.description) }))
      .toContainEqual(expect.stringMatching(/^systemPromptSection: restates a parameter description: /))
    expect(mutated(m => { m.systemPromptSection = ' ' })).toContain('systemPromptSection: missing or empty')
  })
})
