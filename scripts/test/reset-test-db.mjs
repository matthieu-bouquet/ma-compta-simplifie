import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
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

function sqliteFilePath(url) {
  const raw = url.slice('file:'.length)
  if (raw.startsWith('./') || raw.startsWith('../')) {
    return path.resolve(root, raw)
  }
  if (raw.startsWith('/')) return raw
  return path.resolve(root, raw)
}

const dbPath = sqliteFilePath(dbUrl)
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

// Fresh SQLite file + migrations (avoids `migrate reset` and Prisma AI guardrails).
for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]) {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { force: true })
  } catch {
    // ignore
  }
}

run(['migrate', 'deploy', '--schema', schemaPath])
console.log(`[tests] DB reset complete (${pathToFileURL(dbPath).href})`)
