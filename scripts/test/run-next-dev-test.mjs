import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const root = process.cwd()

// Ensure isolated storage dirs exist
fs.mkdirSync(path.join(root, '.tmp'), { recursive: true })
if (process.env.DOCUMENTS_DIR) {
  fs.mkdirSync(process.env.DOCUMENTS_DIR, { recursive: true })
}

// Reset test DB before starting the server
const reset = spawn(process.platform === 'win32' ? 'node.exe' : 'node', [path.join(root, 'scripts/test/reset-test-db.mjs')], {
  stdio: 'inherit',
  env: process.env,
})

reset.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1)

  const tsxBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx')
  const seed = spawn(tsxBin, [path.join(root, 'prisma/seed.ts')], {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
  })
  seed.on('exit', (seedCode) => {
    if (seedCode !== 0) process.exit(seedCode ?? 1)
    startNextDev()
  })
})

function startNextDev() {
  const nextBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next')
  const port = process.env.PORT || '3002'

  // Force hostname to avoid networkInterfaces() issues in sandboxed environments.
  const child = spawn(nextBin, ['dev', '-H', '127.0.0.1', '-p', port], {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
  })

  child.on('exit', (c) => process.exit(c ?? 1))
}

