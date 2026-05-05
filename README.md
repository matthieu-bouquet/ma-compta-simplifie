# Ma Compta Simplifié

**Double-entry accounting** for French **associations** (and business-oriented use cases): journal entries, ledgers, supporting documents, budgets, FEC export, document bundles, and more. Designed for **local-first** use (SQLite) with an optional **desktop** build (Electron).

This repository (`accouting-app`) contains the web client (Next.js), the data layer (Prisma), and the desktop shell.

## Prerequisites

- **Node.js** ≥ 22.12 (see `engines` in `package.json`)
- **npm** (project scripts)

## Setup

```bash
npm install
```

Create a **`.env`** file at the repository root with at least:

```env
DATABASE_URL="file:./prisma/dev.db"
```

Uploaded files use `DOCUMENTS_DIR` when set; otherwise the default directory is `./data` (see `src/lib/documentsStorage.ts`).

Apply migrations, then optionally load seed data:

```bash
npx prisma migrate deploy
npx prisma db seed
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `postinstall` and `dev` regenerate the Prisma client.

## Quality

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest (SQLite DB + documents under `.tmp/`) |
| `npm run test:e2e` | Playwright (dedicated DB under `.tmp/e2e.db`) |
| `npm run test` | Unit tests, then E2E |

For E2E: install Playwright browsers if needed (`npx playwright install`). In some environments, run E2E **outside a sandbox** so browser binaries are available.

## Production build (web)

```bash
npm run build
npm start
```

## Desktop app (Electron)

Multi-platform build and packaging: see [`desktop/ELECTRON_BUILD.md`](desktop/ELECTRON_BUILD.md). Useful scripts:

- `npm run desktop:dev` — Next + Electron in development
- `npm run desktop:build` — Next standalone build + Electron compile
- `npm run desktop:dist` / `desktop:dist:mac` / `:win` / `:linux` — installable artifacts

## Contributor documentation

- **[`AGENTS.md`](AGENTS.md)** — product rules (France / accounting), UI, Next.js backend, tests, forms.
- **[`AGENTS_CONTEXT.md`](AGENTS_CONTEXT.md)** — functional and technical overview (associations, fiscal years, journals, desktop).

## License

This project is licensed under the **GNU General Public License v3.0 or later** (`GPL-3.0-or-later`, SPDX). See [`LICENSE`](LICENSE), [`NOTICE`](NOTICE), and [`COPYING`](COPYING).

- **Default (open source)** : you may use, modify, and redistribute the software under GPLv3+; forks that convey the software must remain under GPLv3+ and preserve copyright and license notices (see the license text).
- **Commercial / proprietary use** : integrating or distributing this code without GPLv3+ obligations may require a **separate commercial license** from the copyright holder (**Ma Compta Simplifié**). Open a GitHub issue or discussion on the [project repository](https://github.com/matthieu-bouquet/ma-compta-simplifie) to discuss licensing.

The `license` field in [`package.json`](package.json) is `GPL-3.0-or-later`. The package remains `"private": true` (this is not an npm-published package).
