# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Mis Finanzas" — a personal finance tracker (Spanish UI) built with React + Vite + Tailwind, packaged as an Android app via Capacitor. All amounts are formatted as MXN.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start dev server at http://localhost:5173
npm run build     # production build to dist/
npm run preview   # preview the production build
```

There is no test suite and no lint script configured in this repo.

### Android build

```bash
npm run build
npx cap sync android
npx cap open android   # requires Android Studio
```

Pushing to `main` triggers `.github/workflows/build-apk.yml`, which builds the web app, syncs Capacitor, compiles a debug APK with Gradle, and publishes it to GitHub Releases.

## Architecture

The entire application lives in a single file: `src/App.jsx` (~1150 lines). `src/main.jsx` just mounts `<FinanzasApp />`. There is no router, no component directory, and no separate state-management library — everything (UI primitives, theming, business logic, and the four screens) is defined in this one file, top to bottom:

1. **Theming** — `THEMES.dark` / `THEMES.light` color tokens, exposed via `ThemeContext` / `useTheme()`. Every component reads colors from `useTheme()` rather than Tailwind color classes, since Tailwind is only used for layout (flex/grid/spacing), not color.
2. **UI primitives** — `Field`, `TextInput`, `Select`, `Btn`, `Chip`, `Amount`, `Card`, `SectionTitle`, `Empty`. Reuse these instead of writing raw `<input>`/`<button>` markup.
3. **App shell** (`FinanzasApp`) — owns the single top-level `data` state object, loads/saves it, and renders a tab bar switching between four screens: Resumen, Cuentas, Movimientos, Categorías.
4. **Data helpers** — pure functions (`cardLabel`, `movTotal`, `balanceOfCard`, `applyInterest`) that derive balances and interest from the raw `movements` array. These are the source of truth for any money math; screens never compute balances independently.
5. **Screen components** — `Resumen`, `Cuentas`, `Movimientos`, `Categorias`, each taking `{ data, update }` and calling `update(patch)` to merge a partial state patch into `data`.

### Data model

A single object (shape defined by `EMPTY`) holds everything:
- `accounts`: bank or cash accounts (can be `excluded` from totals)
- `cards`: belong to an account; `type` is `debito`, `credito` (has optional `cutDay`/`payDay` statement days 1–31), `ahorro` (savings, has `rate` % and `lastAccrual`), or `efectivo` (auto-created for cash accounts)
- `categories`: each has a `freq` of `mensual` / `anual` / `esporadico` (drives how Resumen groups spending)
- `movements`: the append-only transaction log — `type` (`gasto`/`ingreso`), `amount`, `commission`, `months` (>1 means MSI/installments), `categoryId`, `cardId`, `date`, and flags for system/special entries: `interest` (savings yield), `adjust` (balance edits), `transfer` + `transferId` (two-leg transfers between cards)
- `theme`: `"dark"` or `"light"`

Everything else (card balances, credit debt, savings totals, monthly/annual spend groupings, MSI schedules, credit statements) is derived on the fly from `movements` — there are no stored running balances. Balance edits in the UI don't mutate a balance field; they compute a diff and append a synthetic `adjust` movement so the ledger stays internally consistent.

**Transfers**: a transfer (Movimientos tab, or the "Pagar" button on credit cards in Resumen) creates two movements sharing a `transferId` — a `gasto` leg on the source card and an `ingreso` leg on the destination — both flagged `transfer: true`. They move balances but are excluded (like `adjust`) from every spending/income stat: monthly totals, category groupings, and the monthly chart. Deleting one leg deletes both.

**Credit statements**: `creditStatement(card, movements)` derives, for a credit card with a `cutDay`, the current statement: `toPay` (charges accrued through the last cut date minus all payments; MSI purchases accrue one installment per elapsed cut), `periodSpend` (spending since the cut), and `dueDate` (next `payDay` after the cut). Resumen renders this per card plus a "Pago del mes" total.

### Persistence

The `store` object (`src/App.jsx`) abstracts storage: it uses `window.storage` if present (Claude/sandboxed environments), otherwise falls back to `localStorage` under the key `finanzas:data`. Data round-trips through `JSON.stringify`/`JSON.parse` on every change (`useEffect` on `data`).

### Notifications

`scheduleCardReminders(cards)` (src/App.jsx) runs on load and whenever credit cards change: on native Android (guarded by `Capacitor.isNativePlatform()`) it requests notification permission via `@capacitor/local-notifications` and schedules 9:00 AM local reminders for each credit card's next two cut dates and payment due dates, cancelling and rescheduling everything each time. On web it's a no-op. `POST_NOTIFICATIONS` and `SCHEDULE_EXACT_ALARM` are declared in `android/app/src/main/AndroidManifest.xml`.

### Savings interest

`applyInterest()` runs once on load: for each `ahorro` card, it computes elapsed days since `lastAccrual`, applies daily-compounded interest on the current balance, and prepends a synthetic `interest` movement before bumping `lastAccrual` to today. This is how savings yield accrues — there's no server-side cron.
