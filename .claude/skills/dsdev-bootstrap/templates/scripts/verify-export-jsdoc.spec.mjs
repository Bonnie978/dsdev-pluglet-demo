import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, runGate } from './lib/gate-test-support.mjs'

test('documented exports in TS and ESM JS pass; void is inferred from the body when unannotated', () => {
  const f = fixture({
    'src/a.ts': '/** Adds.\n * @param a - left\n * @param b - right\n * @returns sum\n */\nexport function add(a: number, b: number): number { return a + b }\n/** Logs. @param m - text */\nexport function log(m: string): void { console.log(m) }\n',
    'src/b.mjs': '/** Side effect only.\n * @param x - thing\n */\nexport function touch(x) {\n  x.seen = true\n}\n',
  })
  try { const r = runGate('verify-export-jsdoc.mjs', f.root); assert.equal(r.status, 0, r.out); assert.match(r.out, /3 export\(s\)/) } finally { f.dispose() }
})

test('missing JSDoc, missing @param and missing @returns are each named', () => {
  const f = fixture({
    'src/a.ts': 'export const X = 1\n/** Doc without params. */\nexport function f(a: string): string { return a }\n',
    'src/b.mjs': '/** Returns something.\n * @param v - value\n */\nexport function g(v) {\n  return v\n}\n',
  })
  try {
    const r = runGate('verify-export-jsdoc.mjs', f.root); assert.equal(r.status, 1)
    assert.match(r.out, /src\/a\.ts:1: exported const X has no JSDoc/); assert.match(r.out, /@param a missing/); assert.match(r.out, /src\/a\.ts:3: @returns missing/); assert.match(r.out, /src\/b\.mjs:4: @returns missing/)
  } finally { f.dispose() }
})

test('generic parameters are not split at inner commas', () => {
  const f = fixture({ 'src/a.ts': '/** X.\n * @param ctx - c\n * @returns r\n */\nexport function h(ctx: Omit<Record<string, number>, \'k\'>): number { return 1 }\n' })
  try { const r = runGate('verify-export-jsdoc.mjs', f.root); assert.equal(r.status, 0, r.out) } finally { f.dispose() }
})

test('object-literal @param types and bracketed optional names count as documented', () => {
  const f = fixture({ 'src/a.mjs': '/**\n * F.\n * @param {{ n: number }} c - counts\n * @param {string} [name] - optional\n * @returns {string} s\n */\nexport function fmt(c, name) {\n  return `${c.n}${name}`\n}\n' })
  try { const r = runGate('verify-export-jsdoc.mjs', f.root); assert.equal(r.status, 0, r.out) } finally { f.dispose() }
})
