import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Single SQLite file + better-sqlite3: avoid parallel files fighting for DB locks.
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./tests/setup/env.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/actions/**/*.ts',
        'src/app/api/**/*.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      // Floors aligned with measured baseline (~May 2026); small margin vs flaky branch counts.
      thresholds: {
        statements: 73,
        branches: 60,
        functions: 82,
        lines: 78,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    // Prevent Vitest setup files from being typechecked by Next build pipeline.
    // Next's TypeScript checker will still typecheck app code.
    tsconfigRaw: {
      compilerOptions: {
        skipLibCheck: true,
      },
    },
  },
})
