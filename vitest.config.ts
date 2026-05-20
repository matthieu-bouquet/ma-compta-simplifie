import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
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
      thresholds: {
        lines: 55,
        branches: 38,
        functions: 42,
        statements: 54,
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
