# Contribuer

**Node.js** : version **≥ 22.12** (voir `engines` dans [`package.json`](package.json)) — alignée avec la CI GitHub Actions et les contraintes des outils Electron / `npm ci` (lockfile généré avec npm 10.x).

Ce dépôt suit une intégration **trunk-based** sur la branche `main`. La CI (lint, tests unitaires, tests E2E) s’exécute sur les **pull requests** et sur chaque **push** vers `main` (voir [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Branches et flux de travail

- **`main`** : branche d’intégration unique ; elle doit rester déployable / mergeable en continu.
- **Branches de travail** : créer une branche depuis `main` avec un préfixe explicite, par exemple `feat/…`, `fix/…`, `chore/…`.
- **Tenir la branche à jour** : rebaser sur `main` ou merger `main` dans votre branche avant la revue si nécessaire, surtout en cas de conflits.

## Pull requests

- Une PR doit rester **petite** et centrée sur un objectif clair (facilite la revue et le rollback).
- Attendre que le job **CI** soit vert avant de merger.
- **Merge** : privilégier **Squash and merge** pour garder un historique `main` lisible (sauf convention d’équipe différente, à aligner une fois pour toutes).

## Releases desktop (Electron)

Les binaires desktop sont construits et publiés par GitHub Actions lorsqu’un **tag** au format **`v*.*.*`** est poussé (ex. `v1.2.3`), voir [`.github/workflows/desktop-release.yml`](.github/workflows/desktop-release.yml).

Règles importantes :

1. Le commit pointé par le tag doit **déjà figurer dans l’historique de `main`** (le workflow vérifie que le tag est un ancêtre de `origin/main`).
2. Créer le tag **après** merge sur `main`, sur le commit que vous voulez livrer :

   ```bash
   git checkout main
   git pull origin main
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

3. Les artefacts (macOS `.dmg`, Windows installateur, Linux `.AppImage`) sont attachés à la **GitHub Release** correspondant au tag.

Les détails techniques du build Electron sont documentés dans [`desktop/ELECTRON_BUILD.md`](desktop/ELECTRON_BUILD.md).

## Paramétrage GitHub (mainteneurs)

- Protéger **`main`** : exiger une PR et les **status checks** requis (nom du check affiché sur la PR, typiquement **CI** une fois la workflow en place).
- **Actions** : pour les workflows qui publient une release avec `GITHUB_TOKEN`, le dépôt doit autoriser les workflows en **lecture/écriture** sur le contenu du dépôt (*Settings → Actions → General → Workflow permissions*), ou utiliser un mécanisme d’authentification adapté à votre politique org.

Automatisation partielle en local : CLI `gh` (`gh auth login`) et `gh api` pour branch protection / rulesets ; les noms exacts des checks dépendent du premier run réussi de la CI.

### Permissions Actions (release)

Pour que `softprops/action-gh-release` puisse créer une release avec le token du workflow, la permission par défaut du dépôt doit être **Read and write** (réglage *Workflow permissions*). Vérification / mise à jour en CLI (authentification `gh` requise) :

```bash
gh api repos/<owner>/<repo>/actions/permissions/workflow
# Passer en lecture/écriture pour le contenu du dépôt :
gh api --method PUT repos/<owner>/<repo>/actions/permissions/workflow \
  -f default_workflow_permissions=write
```

## ESLint (CI)

`npm run lint` se termine avec succès tant qu’il n’y a **pas d’erreurs** ; certaines règles bruyantes sont en **warning** dans [`eslint.config.mjs`](eslint.config.mjs) pour ne pas bloquer la CI sur une dette historique. Objectif : réduire les warnings progressivement (ou activer `--max-warnings 0` une fois le dépôt nettoyé).
