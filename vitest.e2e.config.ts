import { defineConfig } from 'vitest/config'

// Real-entry-path tier: spawns the built `lib/bin.js` under plain node (docs/testing.md).
export default defineConfig({
  test: { include: ['tests/**/*.e2e.ts'], testTimeout: 30_000, hookTimeout: 30_000 },
})
