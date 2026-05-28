#!/usr/bin/env node
/**
 * Post-build smoke checks for the Electron desktop bundle (no GUI).
 * Verifies compiled main/preload and Next standalone server entry exist.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const requiredPaths = [
  'desktop/dist-electron/main.js',
  'desktop/dist-electron/preload.js',
  '.next/standalone/server.js',
  '.next/standalone/package.json',
]

const missing = requiredPaths.filter((rel) => !fs.existsSync(path.join(root, rel)))

if (missing.length > 0) {
  console.error('[desktop-smoke] Missing artifacts (run `npm run desktop:build` first):')
  for (const rel of missing) console.error(`  - ${rel}`)
  process.exit(1)
}

console.log('[desktop-smoke] OK — desktop artifacts present')
