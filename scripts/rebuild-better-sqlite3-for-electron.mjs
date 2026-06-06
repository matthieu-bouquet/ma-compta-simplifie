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

const rebuildCliPath = path.join(root, 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js')
if (!fs.existsSync(rebuildCliPath)) {
  console.error(`${LOG_PREFIX} @electron/rebuild CLI not found at ${rebuildCliPath}`)
  process.exit(1)
}

const electronVersion = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8')).version

console.log(
  `${LOG_PREFIX} rebuilding better-sqlite3 for Electron ${electronVersion} (module-dir: ${standaloneDir})`
)

const res = spawnSync(
  process.execPath,
  [
    rebuildCliPath,
    '-f',
    '-v',
    electronVersion,
    '-m',
    standaloneDir,
    '-w',
    'better-sqlite3',
  ],
  { stdio: 'inherit', cwd: root, env: process.env, windowsHide: true }
)

if (res.error) {
  console.error(`${LOG_PREFIX} spawnSync error:`)
  console.error(res.error)
  process.exit(1)
}

if (res.signal) {
  console.error(`${LOG_PREFIX} terminated by signal: ${res.signal}`)
  process.exit(1)
}

if (res.status !== 0) {
  console.error(`${LOG_PREFIX} exit status: ${res.status}`)
  process.exit(res.status ?? 1)
}

console.log(`${LOG_PREFIX} done`)
