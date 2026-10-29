import { defineConfig } from 'vitest/config'

// Unit tests for the PURE modules — parsers, writers, the formula engine, the
// collaboration authority. Everything that renders is covered by Playwright in
// e2e/; these exist because a round trip through a hand-written OOXML reader and
// writer has hundreds of cases and a browser per case is the wrong price.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/xml.ts', 'src/lib/opc.ts', 'src/lib/p2p/**', 'src/lib/collab/**', 'src/lib/docStore.ts', 'src/tools/messages/**', 'src/tools/word-editor/**', 'src/tools/excel-editor/**', 'src/tools/powerpoint-editor/**', 'src/lib/office/**'],
      exclude: ['**/*.test.ts', '**/*.tsx', '**/*.worker.ts'],
      reporter: ['text-summary', 'html'],
    },
  },
})
