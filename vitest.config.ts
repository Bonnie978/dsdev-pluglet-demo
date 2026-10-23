import { defineConfig } from 'vitest/config'

// Unit and expected-output tiers resolve `src` directly (source plane); built `lib/`
// is consumed only by the e2e config. Coverage is the CI gate: per-file 100% on src.
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/**/*.e2e.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/bin.ts'],
      thresholds: { perFile: true, lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
})
