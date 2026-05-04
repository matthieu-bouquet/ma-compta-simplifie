import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./tests/setup/env.ts'],
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

