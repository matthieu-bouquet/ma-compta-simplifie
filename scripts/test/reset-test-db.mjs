import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const dbUrl = process.env.DATABASE_URL

if (!dbUrl) {
  console.error('[tests] DATABASE_URL is required')
  process.exit(1)
}

if (!dbUrl.startsWith('file:')) {
  console.error(`[tests] expected SQLite DATABASE_URL starting with file:, got: ${dbUrl}`)
  process.exit(1)
}

const prismaCli = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const schemaPath = path.join(root, 'prisma', 'schema.prisma')

const run = (args) => {
  const res = spawnSync(prismaCli, ['prisma', ...args], {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, DATABASE_URL: dbUrl },
  })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

// Use migrate reset to guarantee a clean schema (dev-only tests).
// This prevents silent drift where the DB file exists but tables don't.
run(['migrate', 'reset', '--force', '--skip-seed', '--schema', schemaPath])
console.log(`[tests] DB reset complete (${dbUrl})`)

