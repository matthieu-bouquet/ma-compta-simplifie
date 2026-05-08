import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outPath = path.join(root, "prisma", "template.db");
const schemaPath = path.join(root, "prisma", "schema.prisma");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
if (fs.existsSync(outPath)) fs.rmSync(outPath, { force: true });

const dbUrl = pathToFileURL(outPath).href;

const isWindows = process.platform === "win32";

const run = (args) => {
  const env = { ...process.env, DATABASE_URL: dbUrl };

  // On Windows, `.cmd` files are not directly executable by CreateProcess in all cases.
  // Going through `cmd.exe /c` avoids `spawnSync npx.cmd EINVAL` on GitHub Actions runners.
  if (isWindows) {
    const cmd = ["npx", "prisma", ...args].join(" ");
    console.log(`[template-db] exec: cmd.exe /d /s /c "${cmd}"`);
    const res = spawnSync("cmd.exe", ["/d", "/s", "/c", cmd], {
      stdio: "inherit",
      env,
      cwd: root,
      windowsHide: true,
    });
    return res;
  }

  console.log(`[template-db] exec: npx prisma ${args.join(" ")}`);
  const res = spawnSync("npx", ["prisma", ...args], {
    stdio: "inherit",
    env,
    cwd: root,
  });
  return res;
};

function assertOk(res) {
  if (res.error) {
    console.error("[template-db] spawnSync error:");
    console.error(res.error);
    process.exit(1);
  }

  if (res.signal) {
    console.error(`[template-db] terminated by signal: ${res.signal}`);
    process.exit(1);
  }

  if (res.status !== 0) {
    console.error(`[template-db] prisma exit status: ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

try {
  console.log(`[template-db] root=${root}`);
  console.log(`[template-db] schemaPath=${schemaPath}`);
  console.log(`[template-db] outPath=${outPath}`);
  console.log(`[template-db] DATABASE_URL=${dbUrl}`);

  // Create/migrate the template DB
  assertOk(run(["migrate", "deploy", "--schema", schemaPath]));
} catch (err) {
  console.error("[template-db] unhandled error:");
  console.error(err);
  process.exit(1);
}

// Optional: seed template DB if you want default Journaux, etc.
// run(["db", "seed"]);

console.log(`[template-db] generated ${outPath}`);

