import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const root = process.cwd()
fs.mkdirSync(path.join(root, '.tmp'), { recursive: true })

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
  process.env.DATABASE_URL || `file:${path.join(root, '.tmp', 'unit.db')}`
process.env.DOCUMENTS_DIR = process.env.DOCUMENTS_DIR || path.join(root, '.tmp', 'documents')

const nodeBin = process.platform === 'win32' ? 'node.exe' : 'node'

const reset = spawnSync(nodeBin, [path.join(root, 'scripts/test/reset-test-db.mjs')], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
})
if (reset.status !== 0) process.exit(reset.status ?? 1)

const vitestBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest')
const res = spawnSync(vitestBin, ['run'], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
})
process.exit(res.status ?? 1)

