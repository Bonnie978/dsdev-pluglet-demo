/**
 * Hygiene gate for the Python package layout (`docs/development.md` § 卫生检查):
 *
 * - every `tests/**` module except `conftest.py` and `__init__.py` matches pytest's default
 *   discovery (`test_*.py` or `*_test.py`); a misnamed test file is silently never collected;
 * - every directory under `src/` that holds a `.py` file has an `__init__.py`, so the package
 *   imports the same way from `pythonpath = ["src"]` and from an installed wheel.
 *
 *   node scripts/verify-py-layout.mjs [--root <dir>]
 *
 * `--root` points the gate at another checkout (the self-test uses temporary fixtures); the
 * default is this repository. `__pycache__` and virtualenvs are skipped. The gate is read-only.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { repoRoot, walk } from './lib/repo-files.mjs'

const rootArg = process.argv.indexOf('--root')
const root = rootArg === -1 ? repoRoot(import.meta.url) : resolve(process.argv[rootArg + 1] ?? '')
if (rootArg !== -1 && !existsSync(root)) { console.error(`verify-py-layout: --root ${root} does not exist`); process.exit(2) }

const RULE = 'docs/development.md § 卫生检查'
const DISCOVERED = /^(test_.*|.*_test)\.py$/
const EXEMPT = new Set(['conftest.py', '__init__.py'])

const errors = []
const pyFiles = walk(root, rel => rel.endsWith('.py'))

const testModules = pyFiles.filter(rel => rel.startsWith('tests/') && !EXEMPT.has(rel.slice(rel.lastIndexOf('/') + 1)))
for (const rel of testModules) {
  if (!DISCOVERED.test(rel.slice(rel.lastIndexOf('/') + 1))) errors.push(`${rel}: pytest never collects this name; rename to test_*.py or *_test.py (${RULE})`)
}

const srcDirs = new Set(pyFiles.filter(rel => rel.startsWith('src/')).map(rel => dirname(rel)))
for (const dir of [...srcDirs].sort()) {
  if (!existsSync(resolve(root, dir, '__init__.py'))) errors.push(`${dir}/: holds Python modules but no __init__.py; the package is not importable as installed (${RULE})`)
}

if (errors.length === 0) {
  console.log(`verify-py-layout: ${testModules.length} test module(s) discoverable, ${srcDirs.size} package dir(s) have __init__.py.`)
  process.exit(0)
}
console.error('verify-py-layout: violations found:')
for (const e of errors) console.error(`  ${e}`)
process.exit(1)
