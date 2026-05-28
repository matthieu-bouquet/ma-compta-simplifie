import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const LOG_PREFIX = '[electron-rebuild]'
const root = process.cwd()
const standaloneDir = path.join(root, '.next', 'standalone')
const sqliteDir = path.join(standaloneDir, 'node_modules', 'better-sqlite3')

if (!fs.existsSync(sqliteDir)) {
  console.log(`${LOG_PREFIX} better-sqlite3 not found in standalone bundle, skipping`)
  process.exit(0)
}

const electronPkgPath = path.join(root, 'node_modules', 'electron', 'package.json')
if (!fs.existsSync(electronPkgPath)) {
  console.error(`${LOG_PREFIX} electron is not installed`)
  process.exit(1)
}

const electronVersion = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8')).version
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

console.log(
  `${LOG_PREFIX} rebuilding better-sqlite3 for Electron ${electronVersion} (module-dir: ${standaloneDir})`
)

const res = spawnSync(
  npx,
  ['electron-rebuild', '-f', '-v', electronVersion, '-m', standaloneDir, '-w', 'better-sqlite3'],
  { stdio: 'inherit', cwd: root, env: process.env }
)

if (res.status !== 0) {
  process.exit(res.status ?? 1)
}

console.log(`${LOG_PREFIX} done`)
