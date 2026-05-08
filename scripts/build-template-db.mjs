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

const prismaCli = process.platform === "win32" ? "npx.cmd" : "npx";

const run = (args) => {
  console.log(`[template-db] exec: ${prismaCli} prisma ${args.join(" ")}`);
  const res = spawnSync(prismaCli, ["prisma", ...args], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
    cwd: root,
    windowsHide: true,
  });

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
};

try {
  console.log(`[template-db] root=${root}`);
  console.log(`[template-db] schemaPath=${schemaPath}`);
  console.log(`[template-db] outPath=${outPath}`);
  console.log(`[template-db] DATABASE_URL=${dbUrl}`);

  // Create/migrate the template DB
  run(["migrate", "deploy", "--schema", schemaPath]);
} catch (err) {
  console.error("[template-db] unhandled error:");
  console.error(err);
  process.exit(1);
}

// Optional: seed template DB if you want default Journaux, etc.
// run(["db", "seed"]);

console.log(`[template-db] generated ${outPath}`);

