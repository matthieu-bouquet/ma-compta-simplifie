# Electron build — décisions et traçabilité

Ce document enregistre les choix d’architecture et de packaging pour l’app desktop (**Ma Compta Simplifié**), afin de ne pas les redécouvrir au fil du temps.

## Portée

- **Entrée Electron** : `desktop/electron/main.ts` (processus principal), `desktop/electron/preload.ts` (exposition `window.app.getVersion()` via IPC → `app.getVersion()` ; fenêtre en `sandbox: true`).
- **Build TS Electron** : `desktop/electron/tsconfig.json` → `desktop/dist-electron/` (référencé par `desktop/package.json` → `"main": "dist-electron/main.js"`).
- **Packaging** : `electron-builder` avec config `desktop/electron-builder.json`, sortie dans `dist-desktop/` (voir `directories.output`).

## Chaîne de build (repo racine)

| Script | Rôle |
|--------|------|
| `npm run desktop:build` | Génère la DB modèle (`scripts/build-template-db.mjs`), build Next **standalone** (`next build`), exécute `scripts/fix-standalone-symlinks.mjs`, compile le main Electron (`tsc -p desktop/electron/tsconfig.json`). |
| `npm run desktop:dist` | `desktop:build` puis `electron-builder --projectDir desktop --config electron-builder.json`. |
| `npm run icons:electron` | Régénère les icônes OS à partir de `public/app-icon.svg` (script `scripts/generate-electron-icons.mjs`). |

Ordre logique : **Next standalone → correctifs symlinks / Prisma dans le bundle → compilation Electron → electron-builder**.

## Next.js en mode standalone

- **Décision** : `output: "standalone"` dans `next.config.ts` pour obtenir un serveur Node autonome (`server.js`) copié dans le `.app` via `extraResources`.
- **CWD en prod** : `path.join(process.resourcesPath, 'app')` — c’est la racine du standalone packagé (voir `main.ts`).

## Contenu packagé (`electron-builder.json`)

- **`extraResources`** : (1) copie du standalone (`.next/standalone` → `Resources/app`) pour `server.js`, `.next`, etc. **electron-builder n’y inclut pas `node_modules`** (filtre interne sur ce type de copie). (2) **Entrée séparée** `{ "from": "../.next/standalone/node_modules", "to": "app/node_modules" }` après `fix-standalone-symlinks` — **obligatoire** pour `next`, Prisma CLI, etc. Sans (2), erreur au lancement : `Cannot find module 'next'` et repli migrate vers `npx` si `node_modules/prisma` est absent.
- **`asar: true`** avec **`asarUnpack`** pour fichiers natifs (`*.node`, `*.dylib`, `*.so`) : requis pour les binaires natifs (dont moteurs Prisma).
- **`productName` / `executableName`** : ASCII (`MaComptaSimplifie`) pour chemins du bundle ; libellé français uniquement via `mac.extendInfo` **`CFBundleDisplayName`** (Finder / Dock). Ne pas surcharger **`CFBundleName`** avec un libellé différent : Electron résout les **`… Helper.app`** avec ce nom ([`electron_main_delegate_mac.mm`](https://github.com/electron/electron/blob/main/shell/app/electron_main_delegate_mac.mm)) ; un écart avec `productName` provoque **`Unable to find helper app`** au lancement.
- **`mac.identity: null`** : pas de re-signature macOS par electron-builder — évite le cas [electron-builder#9396](https://github.com/electron-userland/electron-builder/issues/9396) (ad hoc + `Electron Framework` / Team ID). **`electron`** est pinné sur la **dernière stable** du train majeur courant (`41.5.x` au moment du passage depuis la bêta 42) via `package.json` et `electronVersion` dans `electron-builder.json`. Si un souci spécifique **macOS très récent** réapparaît, consulter les releases Electron / issues ([ex. electron#49522](https://github.com/electron/electron/issues/49522)) et envisager une montée de version mineure ou le prochain train stable. Les builds mac restent **non signés** tant que `identity` est `null` : clic droit → Ouvrir ; pour release, `CSC_LINK` + identité Developer ID.
- **Icônes** : `assets/icon.icns` (macOS), `.ico` / `.png` (Windows / Linux), alignées avec `npm run icons:electron`.

## Script `fix-standalone-symlinks.mjs`

**Problème** : le build standalone utilise des **symlinks** sous `node_modules` ; une copie brute vers `Resources` peut casser ou laisser des modules introuvables hors machine de build.

**Décision** :

- Résoudre les symlinks et **copier le répertoire réel** pour les paquets concernés (dont `@prisma/client`).
- **Bundler une fermeture minimale de dépendances `@prisma/*`** à partir du paquet `prisma` (file d’attente BFS sur `dependencies`), plutôt que tout `node_modules/@prisma` — limite la taille tout en satisfaisant le CLI et les imports runtime.
- Copier le **projet Prisma** (schéma, migrations) et le **CLI** (`prisma`, `.bin/prisma`) dans l’arborescence standalone utilisée pour le package.

Référence : taille dominée surtout par les **engines** Prisma, pas par le nombre de paquets JS.

## Base SQLite et migrations

| Élément | Décision |
|---------|----------|
| **DB utilisateur (prod)** | Fichier sous `app.getPath('userData')` (dossier stabilisé, voir ci‑dessous), fichier `app.db`, `DATABASE_URL=file:…`. |
| **Première installation** | Copie de `prisma/template.db` vers `app.db` si absent (initialisation rapide). |
| **Quand migrer** | Pas à chaque démarrage : fichier marqueur `db-migrations.json` ; migrations si première création DB ou **version app** différente de celle enregistrée (`app.getVersion()`). |
| **Comment migrer** | Appeler le CLI Prisma embarqué : `node_modules/prisma/build/index.js`. En environnement packagé, **`node` système souvent absent** → exécuter avec **`process.execPath`** et **`ELECTRON_RUN_AS_NODE=1`** (voir ci‑dessous). |

### Décision importante : migrations Prisma **sans** `utilityProcess`

- **Tentative** : lancer `prisma migrate deploy` via **`utilityProcess.fork`** pour éviter une tuile Dock supplémentaire.
- **Observation** : en prod, le CLI Prisma peut **terminer sans qu’un événement `exit` fiable ne soit émis** sur le utility process → **`startNextServer()` ne se terminait jamais** → écran **« Démarrage… »** bloqué indéfiniment.
- **Décision retenue** : exécuter les migrations avec **`spawnSync(process.execPath, [prismaCliJs, …], { env: { …, ELECTRON_RUN_AS_NODE: '1' } })`** — synchrone, **comportement de sortie garanti**, logs stdout/stderr capturés.
- **Compromis UX** : une **tuile Dock / icône générique peut apparaître très brièvement** pendant la migration ; acceptable car la phase est courte.

### Journalisation migrate

- Prisma écrit souvent du **flux normal sur stderr** → en log applicatif, traiter stdout **et** stderr comme **info** `[migrate]`, pas comme erreur systématique.

## Décision : serveur Next (longue durée) avec `utilityProcess`

- **Problème** : lancer le serveur avec `spawn(process.execPath, [server.js], { ELECTRON_RUN_AS_NODE: '1' })` peut créer une **deuxième entrée** dans le Dock (icône type « exec ») pendant toute la session.
- **Décision** : démarrer **`server.js`** via **`utilityProcess.fork`** quand disponible — processus utilitaire Chromium / Node **sans** tuile Dock pour ce rôle.
- **Repli** : si `utilityProcess` n’existait pas (environnement inattendu), repli vers `spawn` + `ELECTRON_RUN_AS_NODE` (documenté dans le code).

## Chemins utilisateur et diagnostic

- **`USER_DATA_SUBFOLDER`** (`MaComptaSimplifie`, sans espaces) : **forcer** `app.setPath('userData', …)` avant `ready` pour un dossier prévisible sous `Application Support` / équivalent. Le nom affiché produit est **`PRODUCT_DISPLAY_NAME`** (`Ma Compta Simplifié`) pour les titres / diagnostics JSON (`productName` dans `startup-paths.json`).
- **`startup-paths.json`** dans `userData` : snapshot des chemins utiles au debug (logs, DB, `resourcesPath`, version, etc.).
- **Documents téléversés** : répertoire dédié sous `userData` (variable d’env passée au serveur Next, ex. `DOCUMENTS_DIR`).

## Rappels produit / qualité

- Suppressions côté UI : modale de confirmation (`ConfirmDialog`), pas `window.confirm`.
- Logique métier côté serveur : préférence aux **server actions** ; **route handlers** réservés aux flux binaires / streaming (ZIP, CSV, PDF), `runtime = nodejs`.
- Pas de styles inline dans les composants React (tokens / CSS).

## Fichiers à consulter en cas de régression

| Sujet | Fichier(s) |
|-------|------------|
| Process principal, fork Next, migrate, logs | `desktop/electron/main.ts` |
| Preload | `desktop/electron/preload.ts` |
| Packaging electron-builder | `desktop/electron-builder.json`, `desktop/package.json` |
| Post-traitement standalone + Prisma | `scripts/fix-standalone-symlinks.mjs` |
| DB template avant build | `scripts/build-template-db.mjs`, `prisma/schema.prisma` |
| Icônes | `scripts/generate-electron-icons.mjs`, `desktop/assets/` |

---

*Dernière mise à jour : décisions consolidées au fil des itérations build Electron / Prisma / Dock.*
