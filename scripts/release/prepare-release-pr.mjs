import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
  return (res.stdout ?? "").toString();
}

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return null;
  return val;
}

const version = getArgValue("--version") ?? getArgValue("-v");
if (!version) {
  console.error("Usage: node scripts/release/prepare-release-pr.mjs --version 0.2.1");
  process.exit(2);
}

const branch = `chore/bump-v${version}`;
const root = process.cwd();

// Preconditions: clean tree, on main, up-to-date.
const status = runCapture("git", ["status", "--porcelain=v1"]).trim();
if (status.length > 0) {
  console.error("Working tree is not clean. Commit/stash first.");
  process.exit(1);
}

const currentBranch = runCapture("git", ["branch", "--show-current"]).trim();
if (currentBranch !== "main") {
  console.error(`You must be on main (current: ${currentBranch}).`);
  process.exit(1);
}

run("git", ["pull", "--ff-only", "origin", "main"]);
run("git", ["switch", "-c", branch]);

// Bump version files without tagging.
run("npm", ["version", version, "--no-git-tag-version"]);

// electron-builder uses `--projectDir desktop`, so the Windows/mac/linux artifact version
// comes from `desktop/package.json`. Keep it in sync with the root version.
const desktopPkgPath = path.join(root, "desktop", "package.json");
try {
  const raw = fs.readFileSync(desktopPkgPath, "utf8");
  const json = JSON.parse(raw);
  json.version = version;
  fs.writeFileSync(desktopPkgPath, JSON.stringify(json, null, 2) + "\n");
} catch (err) {
  console.error(`Failed to update ${desktopPkgPath}`);
  throw err;
}

run("git", ["add", "package.json", "package-lock.json", "desktop/package.json"]);
run("git", ["commit", "-m", `chore(release): v${version}`]);
run("git", ["push", "-u", "origin", "HEAD"]);

// Open PR (requires GitHub CLI).
run("gh", [
  "pr",
  "create",
  "--base",
  "main",
  "--title",
  `chore(release): v${version}`,
  "--body",
  `Bump version to v${version} so desktop installers use the correct version in filenames.\n`,
]);

