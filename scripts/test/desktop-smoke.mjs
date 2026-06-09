#!/usr/bin/env node
/**
 * Post-build smoke checks for the Electron desktop bundle (no GUI).
 * 1) Verifies build artifacts exist.
 * 2) Starts standalone Next server briefly and checks HTTP 200 on /.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const templateDbPath = path.join(root, 'prisma/template.db')

const requiredPaths = [
  'desktop/dist-electron/main.js',
  'desktop/dist-electron/preload.js',
  '.next/standalone/server.js',
  '.next/standalone/package.json',
  'prisma/template.db',
]

const missing = requiredPaths.filter((rel) => !fs.existsSync(path.join(root, rel)))

if (missing.length > 0) {
  console.error('[desktop-smoke] Missing artifacts (run `npm run desktop:build` first):')
  for (const rel of missing) console.error(`  - ${rel}`)
  process.exit(1)
}

const standaloneDir = path.join(root, '.next/standalone')

function assertBetterSqlite3HashedCopiesSynced() {
  const canonicalNode = path.join(standaloneDir, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')
  const nextModulesDir = path.join(standaloneDir, '.next/node_modules')
  if (!fs.existsSync(canonicalNode) || !fs.existsSync(nextModulesDir)) return

  const canonicalBytes = fs.readFileSync(canonicalNode)
  for (const name of fs.readdirSync(nextModulesDir)) {
    if (!name.startsWith('better-sqlite3')) continue
    const hashedNode = path.join(nextModulesDir, name, 'build/Release/better_sqlite3.node')
    if (!fs.existsSync(hashedNode)) {
      throw new Error(`Missing hashed better-sqlite3 binary at ${hashedNode}`)
    }
    const hashedBytes = fs.readFileSync(hashedNode)
    if (!hashedBytes.equals(canonicalBytes)) {
      throw new Error(
        `Hashed better-sqlite3 copy out of sync with node_modules/better-sqlite3: ${hashedNode}`
      )
    }
  }
}

try {
  assertBetterSqlite3HashedCopiesSynced()
} catch (e) {
  console.error('[desktop-smoke]', e instanceof Error ? e.message : e)
  process.exit(1)
}

const port = 3199 + Math.floor(Math.random() * 100)
const host = '127.0.0.1'

function waitForHttpOk(url, timeoutMs = 60_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(undefined)
          return
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Unexpected status ${res.statusCode}`))
          return
        }
        setTimeout(tick, 500)
      })
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timeout waiting for ${url}`))
          return
        }
        setTimeout(tick, 500)
      })
    }
    tick()
  })
}

// After desktop:build, better-sqlite3 in standalone targets Electron's ABI — match production.
const child = spawn(electronPath, ['server.js'], {
  cwd: standaloneDir,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    HOSTNAME: host,
    // desktop:build runs build-template-db.mjs; dev.db is gitignored and absent on CI.
    DATABASE_URL: process.env.DATABASE_URL || `file:${templateDbPath}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr?.on('data', (c) => {
  stderr += c.toString()
})

try {
  await waitForHttpOk(`http://${host}:${port}/`)
  console.log('[desktop-smoke] OK — artifacts present and standalone server responded on /')
} catch (e) {
  console.error('[desktop-smoke] Standalone server check failed:', e instanceof Error ? e.message : e)
  if (stderr) console.error(stderr.slice(-2000))
  process.exit(1)
} finally {
  child.kill('SIGTERM')
}
