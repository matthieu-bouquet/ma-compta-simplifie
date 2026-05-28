# Dependency updates

This project uses a **single root** [`package.json`](../package.json) for npm dependencies. The desktop app reuses those packages; [`desktop/package.json`](../desktop/package.json) has no runtime deps.

Automated updates are handled by [Dependabot](../.github/dependabot.yml) (weekly, max **3** open PRs, grouped by stack). Major bumps that are risky or need a dedicated migration stay ignored until handled manually.

## Constraints

| Package | Policy |
|---------|--------|
| **Electron** | Stay on **41.x** until [better-sqlite3#1474](https://github.com/WiseLibs/better-sqlite3/issues/1474) is resolved. After any Electron bump, align `package.json`, [`desktop/electron-builder.json`](../desktop/electron-builder.json) (`electronVersion`), and run `npm run desktop:build`. |
| **Prisma** | Keep `prisma`, `@prisma/client`, and `@prisma/adapter-better-sqlite3` on the **same** version. |
| **Next** | Keep `next` and `eslint-config-next` on the **same** version. Read `node_modules/next/dist/docs/` before upgrading (non-standard Next APIs in this repo). |
| **React** | Keep `react` and `react-dom` aligned with the Next train when possible. |
| **Majors (manual only)** | TypeScript 6, ESLint 10, `archiver` 8, `concurrently` 10, `cross-env` 10, `@types/node` 25, Electron 42+. |

## One-off batch update (catch-up)

1. `git checkout -b chore/deps-YYYY-MM`
2. `npm outdated` — apply **patch/minor** only unless you intend a major migration.
3. Update order: Prisma → Next + `eslint-config-next` → React → other deps → Electron **patch** (41.x only).
4. `npm install` at repo root; `npm install` in `desktop/` if its lockfile changes.
5. Run the validation checklist below.
6. Open one PR; close redundant Dependabot PRs if any.

## Validation checklist

Run from the repo root after dependency changes:

```bash
npm run lint
npm run test:unit
npm run build
npm run test:e2e
```

If **Electron**, **Prisma**, or **better-sqlite3** changed:

```bash
npm run desktop:build
npm run test:desktop:smoke
```

Before a **desktop release**, also run the relevant `desktop:dist:*` target or the [`desktop-release` workflow](../.github/workflows/desktop-release.yml).

## Ongoing routine

| When | Action |
|------|--------|
| Weekly | Merge at most **1–3** green Dependabot grouped PRs; prioritize security advisories. |
| Monthly | `npm outdated` and a manual PR for anything not covered (e.g. pinned Next/React). |
| Before release | Re-run desktop build/dist if Electron or Prisma moved. |

Dependabot groups and ignored majors are defined in [`.github/dependabot.yml`](../.github/dependabot.yml). Electron-specific packaging notes remain in [`desktop/ELECTRON_BUILD.md`](../desktop/ELECTRON_BUILD.md).
