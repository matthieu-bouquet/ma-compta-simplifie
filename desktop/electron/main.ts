import electron from 'electron'
import type { UtilityProcess } from 'electron'

const { app, BrowserWindow, ipcMain } = electron
import path from 'path'
import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process'
import type { EventEmitter } from 'events'
import net from 'net'
import fs from 'fs'

type ElectronLike = typeof import('electron') & {
  utilityProcess?: {
    fork(
      modulePath: string,
      args?: string[],
      opts?: {
        cwd?: string
        env?: NodeJS.ProcessEnv
        stdio?: string | readonly string[]
        execArgv?: string[]
      }
    ): UtilityProcess
  }
}

/** Shown in window / HTML shell titles (matches web app branding). */
const PRODUCT_DISPLAY_NAME = 'Ma Compta Simplifié'

/**
 * Stable userData subfolder (no spaces) for logs/db paths across platforms.
 */
const USER_DATA_SUBFOLDER = 'MaComptaSimplifie'

function configurePathsBeforeReady() {
  try {
    // Normalize userData location so it's easy to find logs/db on disk.
    // Must run before app is ready / before paths are queried elsewhere.
    if (!app.isReady()) {
      app.setPath('userData', path.join(app.getPath('appData'), USER_DATA_SUBFOLDER))
    }
  } catch {
    // ignore
  }
}

configurePathsBeforeReady()

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// If a parent environment sets this, Electron will run as Node (no GUI).
// We only set it for spawned child processes.
delete process.env.ELECTRON_RUN_AS_NODE

ipcMain.handle('desktop:getAppVersion', () => app.getVersion())

let mainWindow: InstanceType<typeof BrowserWindow> | null = null
let nextProcess: ChildProcessWithoutNullStreams | UtilityProcess | null = null
let logFilePath: string | null = null

function forkUtilityOrSpawnElectronNode(opts: {
  cwd: string
  modulePath: string
  args?: string[]
  env: NodeJS.ProcessEnv
}) {
  const electronNs = electron as ElectronLike
  if (electronNs.utilityProcess) {
    return electronNs.utilityProcess.fork(opts.modulePath, opts.args ?? [], {
      cwd: opts.cwd,
      env: opts.env,
      stdio: 'pipe',
    })
  }

  // Fallback (older Electron typings / unexpected environments): behaves like spawning `electron` as node.
  return spawn(process.execPath, [opts.modulePath, ...(opts.args ?? [])], {
    cwd: opts.cwd,
    env: { ...opts.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'pipe',
  }) as unknown as UtilityProcess
}

function attachProcessLogs(prefix: '[next]' | '[migrate]', child: UtilityProcess | ChildProcessWithoutNullStreams) {
  try {
    child.stdout?.on('data', (d) => logLine(`${prefix} ${String(d).trimEnd()}`))
  } catch {
    // ignore
  }
  try {
    child.stderr?.on('data', (d) => errLine(`${prefix} ${String(d).trimEnd()}`))
  } catch {
    // ignore
  }
}

function attachExitLogger(proc: UtilityProcess | ChildProcessWithoutNullStreams, label: string) {
  const emitter = proc as unknown as EventEmitter
  emitter.on('exit', (code: number, signal?: string) => {
    errLine(`[${label}] exited code=${code} signal=${signal ?? ''}`.trim())
  })
}

function initLogging() {
  try {
    const userData = app.getPath('userData')
    if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
    logFilePath = path.join(userData, 'desktop.log')
  } catch {
    logFilePath = null
  }
}

function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`
  try {
     
    console.log(message)
  } catch {
    // ignore
  }
  if (!logFilePath) return
  try {
    fs.appendFileSync(logFilePath, line, 'utf8')
  } catch {
    // ignore
  }
}

function errLine(message: string) {
  const line = `[${new Date().toISOString()}] ERROR ${message}\n`
  try {
     
    console.error(message)
  } catch {
    // ignore
  }
  if (!logFilePath) return
  try {
    fs.appendFileSync(logFilePath, line, 'utf8')
  } catch {
    // ignore
  }
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address()
      srv.close()
      if (typeof address === 'object' && address?.port) resolve(address.port)
      else reject(new Error('Unable to get free port'))
    })
    srv.on('error', reject)
  })
}

async function waitForPort(port: number, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, '127.0.0.1')
      socket.once('connect', () => {
        socket.end()
        resolve(true)
      })
      socket.once('error', () => resolve(false))
    })
    if (ok) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Next server did not start on port ${port}`)
}

function getDatabaseUrl() {
  // In dev, default to the repo sqlite DB so Electron shares data with the web app.
  // In prod, keep using userData for a per-user offline DB.
  if (!app.isPackaged) {
    const repoDbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    return `file:${repoDbPath}`
  }

  const userData = app.getPath('userData')
  const dbPath = path.join(userData, 'app.db')
  return `file:${dbPath}`
}

function ensureDatabaseFolder() {
  const userData = app.getPath('userData')
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
}

function ensureUserDbFromTemplate(cwd: string) {
  const userData = app.getPath('userData')
  const dbPath = path.join(userData, 'app.db')
  if (fs.existsSync(dbPath)) return { created: false }

  const templatePath = path.join(cwd, 'prisma', 'template.db')
  try {
    if (!fs.existsSync(templatePath)) {
      fs.closeSync(fs.openSync(dbPath, 'w'))
      return { created: true }
    }

    fs.copyFileSync(templatePath, dbPath)
    return { created: true }
  } catch (e) {
    throw new Error(
      `Unable to initialize SQLite database at ${dbPath}: ${e instanceof Error ? e.message : String(e)}`
    )
  }
}

function getMigrationMarkerPath() {
  return path.join(app.getPath('userData'), 'db-migrations.json')
}

function shouldRunMigrations(opts: { dbWasCreated: boolean }) {
  if (opts.dbWasCreated) return true
  const markerPath = getMigrationMarkerPath()
  if (!fs.existsSync(markerPath)) return true
  try {
    const raw = fs.readFileSync(markerPath, 'utf8')
    const parsed = JSON.parse(raw) as { appVersion?: string }
    return parsed?.appVersion !== app.getVersion()
  } catch {
    return true
  }
}

function writeMigrationMarker() {
  const markerPath = getMigrationMarkerPath()
  try {
    fs.writeFileSync(
      markerPath,
      JSON.stringify({ appVersion: app.getVersion(), migratedAt: new Date().toISOString() }, null, 2),
      'utf8'
    )
  } catch {
    // ignore
  }
}

async function runPrismaMigrateDeploy(cwd: string, dbUrl: string) {
  // Ensure schema exists even if template.db is missing/empty.
  const isWin = process.platform === 'win32'
  const prismaCliJs = path.join(cwd, 'node_modules', 'prisma', 'build', 'index.js')
  const prismaBin = path.join(cwd, 'node_modules', '.bin', isWin ? 'prisma.cmd' : 'prisma')
  const schemaPath = path.join(cwd, 'prisma', 'schema.prisma')

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Prisma schema missing at ${schemaPath}`)
  }

  // In packaged Electron apps, `/usr/bin/env node` often doesn't exist (exit 127).
  // Run Prisma CLI via Electron's Node runtime instead.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: dbUrl,
  }

  // Run Prisma CLI via Electron's bundled Node (`ELECTRON_RUN_AS_NODE`).
  // Do not use `utilityProcess` here: Prisma CLI can exit without emitting `exit` on the utility process,
  // which would hang startup forever on the splash screen.
  // (May briefly show an extra Dock tile only during migrate; the long-lived Next server uses utilityProcess.)
  if (fs.existsSync(prismaCliJs)) {
    logLine(`[desktop] prisma migrate deploy (electron-as-node: ${prismaCliJs})`)
    const res = spawnSync(process.execPath, [prismaCliJs, 'migrate', 'deploy', '--schema', schemaPath], {
      cwd,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      encoding: 'utf8',
    })
    if (res.stdout) logLine(`[migrate] ${String(res.stdout).trimEnd()}`)
    // Prisma prints normal progress on stderr — log as info, not ERROR.
    if (res.stderr) logLine(`[migrate] ${String(res.stderr).trimEnd()}`)

    if (res.status !== 0) {
      throw new Error(
        `prisma migrate deploy failed (exit=${String(res.status)}). Check desktop.log.\n${String(res.stderr ?? '')}\n${String(res.stdout ?? '')}`
      )
    }

    logLine('[desktop] prisma migrate deploy OK')
    return
  }

  const cmd = fs.existsSync(prismaBin) ? prismaBin : isWin ? 'npx.cmd' : 'npx'
  const args = fs.existsSync(prismaBin)
    ? ['migrate', 'deploy', '--schema', schemaPath]
    : ['prisma', 'migrate', 'deploy', '--schema', schemaPath]

  logLine(`[desktop] prisma migrate deploy (${cmd})`)
  await new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd,
      env,
      stdio: 'pipe',
    })
    p.stdout.on('data', (d) => logLine(`[migrate] ${String(d).trimEnd()}`))
    p.stderr.on('data', (d) => logLine(`[migrate] ${String(d).trimEnd()}`))
    p.once('error', reject)
    p.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`prisma migrate deploy failed (exit=${String(code)}). Check desktop.log.`))
    })
  })
  logLine('[desktop] prisma migrate deploy OK')
}

function writeStartupPathsFile(opts: {
  cwd: string
  dbUrl: string
  documentsDir: string
}) {
  try {
    const userData = app.getPath('userData')
    const payload = {
      productName: PRODUCT_DISPLAY_NAME,
      userData,
      desktopLog: path.join(userData, 'desktop.log'),
      databaseFile: path.join(userData, 'app.db'),
      migrationsMarker: path.join(userData, 'db-migrations.json'),
      documentsDir: opts.documentsDir,
      databaseUrl: opts.dbUrl,
      nextCwd: opts.cwd,
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      execPath: process.execPath,
    }
    fs.mkdirSync(userData, { recursive: true })
    fs.writeFileSync(path.join(userData, 'startup-paths.json'), JSON.stringify(payload, null, 2), 'utf8')
  } catch {
    // ignore
  }
}

async function startNextServer(): Promise<{ url: string }> {
  const isDev = !app.isPackaged
  const cwd = isDev ? process.cwd() : path.join(process.resourcesPath, 'app')
  logLine(`[desktop] mode=${isDev ? 'dev' : 'prod'} resourcesPath=${process.resourcesPath}`)
  logLine(`[desktop] cwd=${cwd}`)

  if (isDev && process.env.ELECTRON_NEXT_URL) {
    const u = new URL(process.env.ELECTRON_NEXT_URL)
    const port = Number(u.port)
    if (port) await waitForPort(port, 20000)
    return { url: u.toString().replace(/\/$/, '') }
  }

  const port = await getFreePort()

  ensureDatabaseFolder()
  const { created: dbWasCreated } = ensureUserDbFromTemplate(cwd)
  const dbUrl = getDatabaseUrl()
  logLine(`[desktop] DATABASE_URL=${dbUrl}`)

  const documentsDir = path.join(app.getPath('userData'), 'documents')
  try {
    fs.mkdirSync(documentsDir, { recursive: true })
  } catch {
    // ignore
  }
  writeStartupPathsFile({ cwd, dbUrl, documentsDir })

  // In production, run migrations only on first launch or after update.
  // Still idempotent: it only applies pending migrations.
  if (!isDev && shouldRunMigrations({ dbWasCreated })) {
    await runPrismaMigrateDeploy(cwd, dbUrl)
    writeMigrationMarker()
  }

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: dbUrl,
    DOCUMENTS_DIR: documentsDir,
    NODE_ENV: (isDev ? 'development' : 'production') as 'development' | 'production',
  } satisfies NodeJS.ProcessEnv

  if (isDev) {
    nextProcess = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '-p', String(port)], {
      cwd,
      env,
      stdio: 'pipe',
    })
  } else {
    const serverEntry = path.join(cwd, 'server.js')
    if (!fs.existsSync(serverEntry)) {
      throw new Error(`Missing Next standalone entry: ${serverEntry}`)
    }
    nextProcess = forkUtilityOrSpawnElectronNode({
      cwd,
      modulePath: serverEntry,
      env,
    })
  }

  attachExitLogger(nextProcess, 'next')

  attachProcessLogs('[next]', nextProcess)

  await waitForPort(port, isDev ? 20000 : 60000)
  return { url: `http://127.0.0.1:${port}` }
}

async function showSplashWindow() {
  if (mainWindow) return
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${PRODUCT_DISPLAY_NAME}</title>
    <style>
      body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; margin: 0; padding: 32px; background: #0b1220; color: #e6eaf2; }
      .card { max-width: 680px; margin: 0 auto; padding: 24px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { margin: 0; line-height: 1.45; color: rgba(230,234,242,0.82); }
      code { display: block; margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.35); border-radius: 10px; overflow: auto; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Démarrage…</h1>
      <p>Chargement de l’application.</p>
    </div>
  </body>
</html>`
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

async function showFatalError(message: string) {
  await showSplashWindow()
  const logHint = logFilePath ? `Logs: ${logFilePath}` : 'Logs: indisponibles'
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Erreur - ${PRODUCT_DISPLAY_NAME}</title>
    <style>
      body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; margin: 0; padding: 32px; background: #1a0b0b; color: #ffecec; }
      .card { max-width: 860px; margin: 0 auto; padding: 24px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { margin: 0; line-height: 1.45; color: rgba(255,236,236,0.82); }
      code { display: block; margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.35); border-radius: 10px; overflow: auto; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Impossible de démarrer</h1>
      <p>Le serveur applicatif ne s’est pas lancé. Vérifie le fichier de logs ci-dessous.</p>
      <code>${escapeHtml(`${message}\n\n${logHint}`)}</code>
    </div>
  </body>
</html>`
  await mainWindow!.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

function escapeHtml(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

async function createWindow(url: string) {
  await showSplashWindow()
  try {
    await mainWindow!.loadURL(url)
  } catch (e) {
    throw new Error(`Failed to load URL ${url}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (nextProcess) nextProcess.kill()
})

app.whenReady().then(async () => {
  initLogging()
  logLine('[desktop] app.whenReady()')
  try {
    await showSplashWindow()
    const { url } = await startNextServer()
    await createWindow(url)
    logLine('[desktop] window ready')
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)
    errLine(msg)
    await showFatalError(msg)
  }
})

