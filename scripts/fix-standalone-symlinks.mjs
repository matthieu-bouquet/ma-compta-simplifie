import fs from "node:fs";
import path from "node:path";

const LOG_PREFIX = "[fix-standalone]";

function cpDir(src, dest) {
  // Node 22: fs.cpSync is faster and more robust cross-platform.
  fs.cpSync(src, dest, { recursive: true, force: true, dereference: false });
}

function copyDir(src, dest) {
  cpDir(src, dest);
}

function replaceSymlinkWithCopy(linkPath) {
  const targetReal = fs.realpathSync(linkPath);
  const stat = fs.statSync(targetReal);
  fs.rmSync(linkPath, { force: true, recursive: true });
  if (stat.isDirectory()) copyDir(targetReal, linkPath);
  else fs.copyFileSync(targetReal, linkPath);
}

function rmIfExists(p) {
  try {
    fs.rmSync(p, { force: true, recursive: true });
  } catch {
    // ignore
  }
}

function readJsonIfExists(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function enqueueDeps(pkgJson, queue, seenKeys) {
  const sections = [pkgJson.dependencies, pkgJson.optionalDependencies, pkgJson.peerDependencies];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    for (const name of Object.keys(section)) {
      const key = name;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      queue.push(name);
    }
  }
}

function resolvePackageDir(root, packageName) {
  // Scoped packages live under node_modules/@scope/name
  if (packageName.startsWith("@")) {
    const parts = packageName.split("/");
    if (parts.length < 2) return null;
    return path.join(root, "node_modules", parts[0], parts[1]);
  }
  return path.join(root, "node_modules", packageName);
}

/** Non-scoped packages required at runtime for Prisma 7 + SQLite adapter (native `.node` binary). */
const EXPLICIT_RUNTIME_PACKAGES = new Set(["better-sqlite3", "bindings", "file-uri-to-path"]);

function copyPackageIntoStandalone(root, standaloneNm, packageName) {
  const pkgDir = resolvePackageDir(root, packageName);
  if (!pkgDir || !fs.existsSync(pkgDir)) return false;

  let destPath;
  if (packageName.startsWith("@")) {
    const parts = packageName.split("/");
    if (parts.length < 2) return false;
    destPath = path.join(standaloneNm, parts[0], parts[1]);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
  } else {
    destPath = path.join(standaloneNm, packageName);
  }

  rmIfExists(destPath);
  copyDir(pkgDir, destPath);
  return true;
}

function bundlePrismaDependencyClosure(root, standaloneNm) {
  /** @type {Set<string>} */
  const copiedPackages = new Set();

  /** @type {string[]} */
  const queue = [];
  /** @type {Set<string>} */
  const seen = new Set();

  queue.push("prisma");
  queue.push("@prisma/adapter-better-sqlite3");
  queue.push("better-sqlite3");

  while (queue.length > 0) {
    const name = queue.shift();
    if (!name) continue;

    const pkgDir = resolvePackageDir(root, name);
    const pkgJsonPath = path.join(pkgDir, "package.json");
    const pkgJson = readJsonIfExists(pkgJsonPath);
    if (!pkgJson) continue;

    enqueueDeps(pkgJson, queue, seen);

    const shouldCopy =
      name.startsWith("@") || EXPLICIT_RUNTIME_PACKAGES.has(name) || name === "better-sqlite3";
    if (!shouldCopy) continue;

    if (copyPackageIntoStandalone(root, standaloneNm, name)) {
      copiedPackages.add(name);
    }
  }

  return copiedPackages;
}

function bundlePrismaCliIntoStandalone(root) {
  const standaloneNm = path.join(root, ".next", "standalone", "node_modules");
  if (!fs.existsSync(standaloneNm)) {
    console.log(`${LOG_PREFIX} .next/standalone/node_modules missing, skipping`);
    return;
  }

  const prismaProjectDest = path.join(root, ".next", "standalone", "prisma");
  const prismaProjectSrc = path.join(root, "prisma");
  if (fs.existsSync(prismaProjectSrc)) {
    rmIfExists(prismaProjectDest);
    copyDir(prismaProjectSrc, prismaProjectDest);
    console.log(`${LOG_PREFIX} bundled prisma project -> ${prismaProjectDest}`);
  }

  const copiedPackages = bundlePrismaDependencyClosure(root, standaloneNm);
  console.log(
    `${LOG_PREFIX} bundled Prisma/SQLite packages: ${Array.from(copiedPackages).sort().join(", ")}`
  );

  const prismaConfigSrc = path.join(root, "prisma.config.ts");
  const prismaConfigDest = path.join(root, ".next", "standalone", "prisma.config.ts");
  if (fs.existsSync(prismaConfigSrc)) {
    fs.mkdirSync(path.dirname(prismaConfigDest), { recursive: true });
    fs.copyFileSync(prismaConfigSrc, prismaConfigDest);
    console.log(`${LOG_PREFIX} bundled prisma.config.ts -> ${prismaConfigDest}`);
  }

  const generatedSrc = path.join(root, "src", "generated", "prisma");
  const generatedDest = path.join(root, ".next", "standalone", "src", "generated", "prisma");
  if (fs.existsSync(generatedSrc)) {
    rmIfExists(generatedDest);
    copyDir(generatedSrc, generatedDest);
    console.log(`${LOG_PREFIX} bundled generated client -> ${generatedDest}`);
  }

  const copies = [["prisma", path.join(root, "node_modules", "prisma")]];

  // Prisma CLI + engines are not traced into Next standalone output by default.
  // Electron prod runs `prisma migrate deploy` offline; bundling avoids relying on `npx`.
  for (const [destName, srcPath] of copies) {
    if (!fs.existsSync(srcPath)) continue;
    const destPath = path.join(standaloneNm, destName);
    rmIfExists(destPath);
    copyDir(srcPath, destPath);
    console.log(`${LOG_PREFIX} bundled ${destName} -> ${destPath}`);
  }

  const prismaBinSrc = path.join(root, "node_modules", ".bin", "prisma");
  const prismaBinDest = path.join(standaloneNm, ".bin", "prisma");
  if (fs.existsSync(prismaBinSrc)) {
    fs.mkdirSync(path.dirname(prismaBinDest), { recursive: true })
    rmIfExists(prismaBinDest)
    fs.copyFileSync(prismaBinSrc, prismaBinDest)
    try {
      fs.chmodSync(prismaBinDest, 0o755)
    } catch {
      // ignore
    }
    console.log(`${LOG_PREFIX} bundled prisma bin -> ${prismaBinDest}`)
  }
}

const root = process.cwd();
const prismaDir = path.join(root, ".next", "standalone", ".next", "node_modules", "@prisma");
if (fs.existsSync(prismaDir)) {
  for (const name of fs.readdirSync(prismaDir)) {
    const full = path.join(prismaDir, name);
    try {
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) {
        replaceSymlinkWithCopy(full);
        console.log(`${LOG_PREFIX} replaced symlink: ${full}`);
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} failed while processing: ${full}`);
      console.warn(err);
    }
  }
} else {
  console.log(`${LOG_PREFIX} no @prisma dir inside standalone, skipping symlink rewrite`);
}

bundlePrismaCliIntoStandalone(root)

