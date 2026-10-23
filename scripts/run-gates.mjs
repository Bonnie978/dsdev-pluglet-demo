/**
 * Run a named gate aggregate with bounded in-process scheduling.
 * `scripts/gates.config.mjs` owns the gate inventory and the aggregate graphs; this
 * runner owns dependency ordering, concurrency, fail-fast, and the summary.
 *
 *   node scripts/run-gates.mjs <aggregate>
 *   DSDEV_GATE_CONCURRENCY=4 DSDEV_GATE_FAIL_FAST=1 node scripts/run-gates.mjs check-all
 *
 * A failed gate prints its own output and skips only its dependents, so independent
 * errors are all reported; any blocking failure or skip exits 1. `allowFailure` gates
 * are reported but never fail the aggregate.
 */
import { spawn } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { repoRoot } from './lib/repo-files.mjs'

const root = repoRoot(import.meta.url)
const { gates, aggregates } = await import(resolve(root, 'scripts/gates.config.mjs'))

const mode = process.argv[2]
if (!mode || !aggregates[mode]) {
  console.error(`run-gates: expected one of ${Object.keys(aggregates).join(' | ')}, got ${JSON.stringify(mode)}`)
  process.exit(2)
}

const byId = new Map(gates.map(g => [g.id, g]))
const selected = new Map()
const select = (id) => {
  if (selected.has(id)) return
  const gate = byId.get(id)
  if (!gate) throw new Error(`run-gates: aggregate ${mode} names unknown gate ${JSON.stringify(id)}`)
  for (const dep of gate.needs ?? []) select(dep)
  selected.set(id, gate)
}
for (const id of aggregates[mode]) select(id)

const concurrency = Math.max(1, Number(process.env.DSDEV_GATE_CONCURRENCY) || Math.min(8, availableParallelism()))
const failFast = process.env.DSDEV_GATE_FAIL_FAST === '1'
const startedAt = performance.now()
console.log(`run-gates: ${mode} running ${selected.size} gate(s) with ${concurrency} worker(s)${failFast ? ', fail-fast' : ''}.`)

const state = new Map([...selected.keys()].map(id => [id, 'pending']))
const results = []
let aborted = false

function runGate(gate) {
  return new Promise((done) => {
    const t0 = performance.now()
    const child = spawn(gate.command, gate.args ?? [], { cwd: root, env: { ...process.env, ...(gate.env ?? {}) }, shell: process.platform === 'win32' })
    const chunks = []
    child.stdout.on('data', d => chunks.push(d))
    child.stderr.on('data', d => chunks.push(d))
    child.on('error', error => done({ gate, status: 'failed', durationMs: performance.now() - t0, output: `${error.message}\n`, exitCode: null }))
    child.on('close', (code, signal) => {
      done({ gate, status: code === 0 ? 'passed' : 'failed', durationMs: performance.now() - t0, output: Buffer.concat(chunks).toString('utf8'), exitCode: code, signal })
    })
  })
}

function ready() {
  return [...selected.values()].filter(g => state.get(g.id) === 'pending' && (g.needs ?? []).every(d => state.get(d) === 'passed'))
}

function skipBlocked() {
  for (const g of selected.values()) {
    if (state.get(g.id) !== 'pending') continue
    const blocked = (g.needs ?? []).some(d => state.get(d) === 'failed' || state.get(d) === 'skipped')
    if (blocked || aborted) {
      state.set(g.id, 'skipped')
      results.push({ gate: g, status: 'skipped', durationMs: 0, output: '', exitCode: null })
      console.log(`  skipped ${g.label} (${blocked ? 'dependency failed' : 'fail-fast'})`)
    }
  }
}

const running = new Set()
await new Promise((finish) => {
  const pump = () => {
    skipBlocked()
    for (const g of ready()) {
      if (running.size >= concurrency) break
      state.set(g.id, 'running')
      const p = runGate(g).then((r) => {
        running.delete(p)
        state.set(g.id, r.status)
        results.push(r)
        const secs = (r.durationMs / 1000).toFixed(1)
        if (r.status === 'passed') console.log(`  ok      ${g.label} (${secs}s)`)
        else {
          console.log(`  FAILED  ${g.label} (${secs}s, exit ${r.exitCode ?? r.signal})${g.allowFailure ? ' [allowed]' : ''}`)
          if (r.output.trim() !== '') process.stdout.write(`${r.output.trimEnd().replace(/^/gm, '          ')}\n`)
          if (failFast && !g.allowFailure) aborted = true
        }
        pump()
      })
      running.add(p)
    }
    if (running.size === 0 && ready().length === 0) { skipBlocked(); finish() }
  }
  pump()
})

const passed = results.filter(r => r.status === 'passed').length
const failed = results.filter(r => r.status === 'failed' && !r.gate.allowFailure)
const skipped = results.filter(r => r.status === 'skipped' && !r.gate.allowFailure)
console.log(`run-gates: ${mode} ${passed} passed, ${failed.length} failed, ${skipped.length} skipped in ${((performance.now() - startedAt) / 1000).toFixed(1)}s.`)
process.exit(failed.length + skipped.length > 0 ? 1 : 0)
