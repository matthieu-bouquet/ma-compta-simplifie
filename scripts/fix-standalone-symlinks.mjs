import fs from "node:fs";
import path from "node:path";

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(s);
      const stat = fs.statSync(real);
      if (stat.isDirectory()) copyDir(real, d);
      else fs.copyFileSync(real, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
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

function bundlePrismaDependencyClosure(root, standaloneNm) {
  /** @type {Set<string>} */
  const copiedPrismaScopes = new Set();

  /** @type {string[]} */
  const queue = [];
  /** @type {Set<string>} */
  const seen = new Set();

  // Seed with the Prisma CLI package itself.
  queue.push("prisma");

  while (queue.length > 0) {
    const name = queue.shift();
    if (!name) continue;

    const pkgDir = resolvePackageDir(root, name);
    const pkgJsonPath = path.join(pkgDir, "package.json");
    const pkgJson = readJsonIfExists(pkgJsonPath);
    if (!pkgJson) continue;

    // Copy only what's needed for Prisma tooling/runtime used by Electron migrations.
    // Strategy: traverse dependencies starting from `prisma`, then copy every scoped package (@*) reached.
    // Non-scoped deps are expected to already be traced into Next standalone output (e.g. semver, fs-extra…).
    enqueueDeps(pkgJson, queue, seen);

    // Copy scoped packages (@prisma/* and any other scopes Prisma pulls in).
    if (name.startsWith("@")) {
      const parts = name.split("/");
      if (parts.length < 2) continue;
      const scope = parts[0]; // "@prisma"
      const pkg = parts[1];

      const destScopeDir = path.join(standaloneNm, scope);
      const destPkgDir = path.join(destScopeDir, pkg);

      fs.mkdirSync(destScopeDir, { recursive: true });
      rmIfExists(destPkgDir);
      copyDir(path.join(pkgDir), destPkgDir);

      copiedPrismaScopes.add(name);
    }
  }

  return copiedPrismaScopes;
}

function bundlePrismaCliIntoStandalone(root) {
  const standaloneNm = path.join(root, ".next", "standalone", "node_modules");
  if (!fs.existsSync(standaloneNm)) return;

  const prismaProjectDest = path.join(root, ".next", "standalone", "prisma");
  const prismaProjectSrc = path.join(root, "prisma");
  if (fs.existsSync(prismaProjectSrc)) {
    rmIfExists(prismaProjectDest);
    copyDir(prismaProjectSrc, prismaProjectDest);
    console.log(`[fix-standalone] bundled prisma project -> ${prismaProjectDest}`);
  }

  const copiedScopes = bundlePrismaDependencyClosure(root, standaloneNm);
  console.log(
    `[fix-standalone] bundled scoped prisma toolchain packages: ${Array.from(copiedScopes).sort().join(", ")}`
  );

  const copies = [["prisma", path.join(root, "node_modules", "prisma")]];

  // Prisma CLI + engines are not traced into Next standalone output by default.
  // Electron prod runs `prisma migrate deploy` offline; bundling avoids relying on `npx`.
  for (const [destName, srcPath] of copies) {
    if (!fs.existsSync(srcPath)) continue;
    const destPath = path.join(standaloneNm, destName);
    rmIfExists(destPath);
    copyDir(srcPath, destPath);
    console.log(`[fix-standalone] bundled ${destName} -> ${destPath}`);
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
    console.log(`[fix-standalone] bundled prisma bin -> ${prismaBinDest}`)
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
        console.log(`[fix-standalone] replaced symlink: ${full}`);
      }
    } catch {
      // ignore
    }
  }
}

bundlePrismaCliIntoStandalone(root)

