import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outPath = path.join(root, "prisma", "template.db");
const schemaPath = path.join(root, "prisma", "schema.prisma");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
if (fs.existsSync(outPath)) fs.rmSync(outPath, { force: true });

const dbUrl = `file:${outPath}`;

const prismaCli = process.platform === "win32" ? "npx.cmd" : "npx";

const run = (args) => {
  const res = spawnSync(prismaCli, ["prisma", ...args], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
    cwd: root,
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
};

// Create/migrate the template DB
run(["migrate", "deploy", "--schema", schemaPath]);

// Optional: seed template DB if you want default Journaux, etc.
// run(["db", "seed"]);

console.log(`[template-db] generated ${outPath}`);

