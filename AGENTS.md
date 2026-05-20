<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:accounting-compliance -->
## Domaine comptabilité et conformité (France)

- **Contexte produit**: logiciel de comptabilité pour **entreprises** et **associations** en France.
- **Nouvelle fonctionnalité**: avant implémentation, déterminer si le besoin **impacte la partie comptabilité** (écritures, journaux, exercices, pièces justificatives, TVA, associations, export FEC, etc. — liste indicative).
- **Si impact comptable**:
  - **Conformité**: il est **impératif** de vérifier que ce qui est demandé est **conforme** aux obligations et cadres applicables ; croiser avec la documentation métier du projet ou les références normatives pertinentes lorsque nécessaire.
  - **Règles de l’art**: implémenter de façon rigoureuse et cohérente avec le produit — notamment garde-fous d’écriture (`assertFiscalYearWritable` / équivalent), audit (`src/lib/audit.ts`), transactions Prisma, et tests automatisés pertinents (voir « Backend boundaries » et « Engineering standards »).
<!-- END:accounting-compliance -->

<!-- BEGIN:ui-safety-rules -->
## UI safety rules (destructive actions)

- **Suppression**: toute action de suppression (delete) doit déclencher une **modal de confirmation** (pas de `window.confirm`).
- **Listes**: sur les pages de listes, les boutons d’actions doivent être des **icônes** (avec `title` + `aria-label`).
- **Composant**: utiliser `src/components/ConfirmDialog.tsx` pour les confirmations.
<!-- END:ui-safety-rules -->

<!-- BEGIN:action-feedback-toasts -->
## Action feedback (toasts)

- **Retour utilisateur après action**: pour confirmer le succès, signaler un avertissement ou une erreur suite à une action (création, enregistrement, suppression, import, etc.), utiliser **`appToast`** (`src/lib/appToast.ts`) — pas de bandeau vert/rouge inline dans le formulaire ou la page.
- **API**: `appToast.success(message)` (vert / OK), `appToast.warning(message)` (orange), `appToast.error(message)` (rouge).
- **Infrastructure**: le conteneur global est `src/components/AppToaster.tsx` (monté dans `src/app/layout.tsx`), position **haut droite**.
- **Exceptions**: messages de validation persistants sur un champ, états vides, ou erreurs contextuelles liées à un contrôle précis peuvent rester inline ; le résultat global de l’action soumise passe par le toast.
<!-- END:action-feedback-toasts -->

<!-- BEGIN:engineering-standards -->
## Engineering standards (language, DRY, KISS)

- **Language**: all code identifiers must be in **English** (files, variables, functions, types, Prisma models/fields). User-facing copy may stay French.
- **DRY**: if the same business rule appears in 2+ places (e.g. journal numbering, OD journal retrieval), extract a single helper in `src/lib/*` and reuse it.
- **KISS**: prefer small explicit helpers over generic abstractions. Avoid clever “framework-y” layers unless they remove real duplication.
- **Transactions**: any write spanning multiple tables must use `prisma.$transaction` and pass a `tx` to helpers.
- **Tests (feature)**: every new feature must include the **most relevant automated tests** (unit/integration/E2E as appropriate) to prevent regressions.
- **Tests (bugfix / TDD)**: every bugfix must start by adding a **failing test that reproduces the bug**, then fix the bug until the test passes.
- **Tests (E2E / Playwright)**: run E2E tests **outside sandbox** (non-sandboxed), otherwise Playwright browsers may not be available (you’ll get “Executable doesn’t exist… run `npx playwright install`”).
- **Tests (workflow)**: after **each code change**, run the relevant test suite(s). If in doubt, run `npm run test:e2e` (outside sandbox) before considering the change “done”.
- **Forms (accessibility & E2E)**: every `<label>` must be wired to a real control via `htmlFor` + `id` (or `aria-label`). E2E tests rely on `getByLabel(...)`.
- **Forms (dates)**: use `react-datepicker` (as in `src/app/saisie/SaisieForm.tsx`) for date fields; keep a stable labeled input (via `customInput`) to support `getByLabel(...)` and consistent UX.
- **Popovers (date pickers, tooltips, dropdowns)**: verify overlays are **not clipped** and appear **above cards**. Avoid `overflow: hidden` on ancestors; if needed, render overlays in a **portal to `document.body`** and set an explicit high `z-index` (ex: `.react-datepicker-popper`, tooltips).
- **List pages (header actions)**: primary action buttons on list pages must be **left-aligned under the title** (not right-aligned), to avoid overlap with context switchers and to keep a consistent layout.
<!-- END:engineering-standards -->

<!-- BEGIN:list-and-form-navigation -->
## List & form navigation (create / edit)

- **List “add / create” actions**: any primary control on a **list** screen that starts **creation** (new entity, new line, new budget, upload block header, etc.) must show a **leading `Plus`** icon (e.g. lucide-react `Plus`) next to the label. Use shared spacing [`forms.btnWithLeadingIcon`](src/components/forms/forms.module.css) on the button/link (`btn btn-primary …`).
- **Create / edit pages**: every **creation** route (`**/new/**`) and **modification** route (`**/edit/**`, or dedicated detail-edit flows) must expose an explicit **back** control at the top (link or button) to the parent list or previous hub. Prefer [`src/components/PageBackLink.tsx`](src/components/PageBackLink.tsx) with `ChevronLeft` for consistency, unless the screen is already wrapped by a layout that provides an equivalent back action (e.g. `ParametreLayout` → paramètres).
<!-- END:list-and-form-navigation -->

<!-- BEGIN:backend-boundaries -->
## Backend boundaries (Next.js)

- **Server actions** (`src/actions/*`) are the default for CRUD and business logic.
- **Route handlers** (`src/app/api/**/route.ts`) are reserved for **streaming/binary** responses (ZIP/PDF/CSV/download). They must set `export const runtime = 'nodejs'`.
- **Guards**: any mutation must validate scope/ownership and writability first (e.g. `assertFiscalYearWritable` / equivalent guard), not after.
- **Audit**: any create/delete/close/reverse operation must emit a stable audit event via `src/lib/audit.ts`.
<!-- END:backend-boundaries -->

<!-- BEGIN:styling-rules -->
## Styling rules (frontend maintainability)

- **No inline styles**: do not use `style={{ ... }}` in React components.
- **Centralize styles**: use CSS variables/tokens in `src/app/globals.css` and component-level `*.module.css` where needed.
<!-- END:styling-rules -->

<!-- BEGIN:form-ui-rules -->
## Form UI (layout, controls, selects)

- **Shared primitives**: use classes from [`src/components/forms/forms.module.css`](src/components/forms/forms.module.css) for text inputs (`input`), native selects (`select`), textareas (`textarea`), file inputs (`fileInput`), field spacing (`field`, `label`), alerts (`alertError` / `alertSuccess`), and action rows (`formActions`, `formActionsBar`). Add page-specific layout only in a local `*.module.css` (grids, toolbars, tables).
- **Sections**: multi-block forms should use [`src/components/forms/FormSection.tsx`](src/components/forms/FormSection.tsx) (icon + title + description) inside `forms.sections` / `forms.section` so new screens match Paramètres / entité.
- **Searchable lists**: use [`src/components/forms/AppSearchableSelect.tsx`](src/components/forms/AppSearchableSelect.tsx) (`react-select` with shared styling, `menuPortalTarget={document.body}`) for long or filterable option lists (accounts, entities when many, journals in advanced entry, etc.). Short fixed enums (e.g. legal form) may use `<select className={forms.select}>`.
- **Do not duplicate** section/control styles in feature CSS; extend the shared module if a new variant is needed app-wide.
<!-- END:form-ui-rules -->
