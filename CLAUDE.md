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

`src/main.jsx` mounts `<FinanzasApp />` (default export of `src/App.jsx`). There is no router and no state-management library. Modules:

- **`src/App.jsx`** — the app shell: owns the single top-level `data` state object, loads/saves it, runs the load-time effects (interest accrual, recurring charges, notification-inbox drain, reminder scheduling), and renders the tab bar switching between five screens: Resumen, Cuentas, Movimientos, Fijos, Categorías.
- **`src/theme.js`** — `THEMES.dark` / `THEMES.light` color tokens, `ThemeContext` / `useTheme()`. Every component reads colors from `useTheme()` rather than Tailwind color classes; Tailwind is only used for layout (flex/grid/spacing), not color.
- **`src/constants.js`** — `FREQS`, `MESES_OPCIONES`, month names, `seedCategories`, and `EMPTY` (the state shape).
- **`src/store.js`** — the storage abstraction (see Persistence).
- **`src/utils/format.js`** — `money`, `uid`, `todayISO`, `isoOf`, `fmtDia`.
- **`src/lib/finance.js`** — all money math as pure functions: `cardLabel`, `movTotal`, `balanceOfCard`, `creditStatement`, `applyInterest`, `applyRecurring`, `nextChargeOf`, `parseCapturedNotification`, `clampDay`, `dateWithDay`. This is the single source of truth for balances and statements; screens never compute them independently.
- **`src/lib/notifications.js`** — the `NotificationInbox` native-plugin proxy and `scheduleCardReminders`.
- **`src/components/ui.jsx`** — UI primitives: `Field`, `TextInput`, `Select`, `Btn`, `Chip`, `Amount`, `Card`, `SectionTitle`, `Empty`. Reuse these instead of writing raw `<input>`/`<button>` markup.
- **`src/components/GraficaMensual.jsx`** — the 6-month income/expense grouped-column SVG chart (with table view).
- **`src/components/Tour.jsx`** — the welcome tour overlay, shown on first launch (`data.tourSeen` flag) and replayable from Ajustes.
- **`src/screens/*.jsx`** — one file per tab (`Resumen`, `Cuentas`, `Movimientos`, `Fijos`, `Categorias`), each taking `{ data, update }` and calling `update(patch)` to merge a partial state patch into `data`. `Movimientos.jsx` also holds `InboxItem` and `MovEditor`; `Fijos.jsx` holds `FijoForm`. `Ajustes.jsx` (opened via the ⚙ header button, not a tab) holds preferences, FAQ, support contact (`SUPPORT_EMAIL` in constants.js), and terms & conditions.

### Data model

A single object (shape defined by `EMPTY`) holds everything:
- `accounts`: bank, cash, or debt accounts (`type`: `banco` / `efectivo` / `deuda`; can be `excluded` from totals)
- `cards`: belong to an account; `type` is `debito`, `credito` (has optional `cutDay`/`payDay` statement days 1–31), `ahorro` (savings, has `rate` % and `lastAccrual`), `efectivo` (auto-created for cash accounts), or `deuda` (auto-created for debt accounts; optional `rate` % + `ratePeriod` `"mensual"`/`"anual"` — interest accrues daily onto the debt via `applyInterest`, and the initial amount is an `adjust` gasto so it never counts as monthly spending). Debit/credit cards may also carry `digitalLast4` — the last 4 digits of an associated digital card, used (alongside `last4`) to match captured notifications to the card. `balanceOfCard` returns "amount owed" for `credito`/`deuda` (see `isDebtType`) and "amount held" otherwise; Resumen's net balance subtracts both debt kinds
- `categories`: each has a `freq` of `mensual` / `anual` / `esporadico` (drives how Resumen groups spending)
- `movements`: the transaction log — `type` (`gasto`/`ingreso`), `title` (required in the UI; older entries may only have `description`, so display falls back `title || description`), `description` (optional), `amount`, `commission`, `months` (>1 means MSI/installments), `categoryId`, `cardId`, `date`, and flags for system/special entries: `interest` (savings yield), `adjust` (balance edits), `transfer` + `transferId` (two-leg transfers between cards), `recurring` + `recurringId` (auto-generated monthly charges)
- `recurring`: monthly fixed charges (subscriptions) — `title` (+ optional `description`), `amount`, `cardId`, `categoryId`, `day` (charge day 1–31), optional `endDate`, `createdAt`, `lastApplied`. `applyRecurring()` runs on load and when the list changes, generating overdue `gasto` movements (flagged `recurring`) up to today; generated movements count as normal spending in every stat, and deleting a recurring item keeps its past movements. Managed in the "Fijos" tab
- `theme`: `"dark"` or `"light"`

Everything else (card balances, credit debt, savings totals, monthly/annual spend groupings, MSI schedules, credit statements) is derived on the fly from `movements` — there are no stored running balances. Balance edits in the UI don't mutate a balance field; they compute a diff and append a synthetic `adjust` movement so the ledger stays internally consistent.

**Transfers**: a transfer (Movimientos tab, or the "Pagar" button on credit cards in Resumen) creates two movements sharing a `transferId` — a `gasto` leg on the source card and an `ingreso` leg on the destination — both flagged `transfer: true`. They move balances but are excluded (like `adjust`) from every spending/income stat: monthly totals, category groupings, and the monthly chart. Deleting one leg deletes both.

**Credit statements**: `creditStatement(card, movements)` derives, for a credit card with a `cutDay`, the current statement: `toPay` (charges accrued through the last cut date minus all payments; MSI purchases accrue one installment per elapsed cut), `periodSpend` (spending since the cut), and `dueDate` (next `payDay` after the cut). Resumen renders this per card plus a "Pago del mes" total.

### Persistence

The `store` object (`src/App.jsx`) abstracts storage: it uses `window.storage` if present (Claude/sandboxed environments), otherwise falls back to `localStorage` under the key `finanzas:data`. Data round-trips through `JSON.stringify`/`JSON.parse` on every change (`useEffect` on `data`).

### Notification inbox (auto-captured charges)

Android-only feature with custom native code in `android/app/src/main/java/com/yukioyoko/finanzas/`:
- `NotificationCaptureService` (a `NotificationListenerService`, requires the user to grant "Notification access" in system settings) captures any device notification containing a money amount into a local JSON file.
- `NotificationInboxPlugin` (registered in `MainActivity`) bridges to JS as the `NotificationInbox` plugin with `isEnabled()`, `openSettings()`, and `drain()` (returns captured items and clears the file).

On the JS side (`registerPlugin("NotificationInbox")` in src/App.jsx), a load-time effect drains captures into `data.inbox`; `parseCapturedNotification` extracts the amount, guesses the card by last-4 digits (left blank when no match) and the type by keywords. The Movimientos tab shows an enable banner when access isn't granted, and a "Por confirmar" list where the user completes description/category (and card if blank) to convert an inbox item into a real movement, or discards it. `data.inbox` persists with the rest of the state.

### Notifications

`scheduleCardReminders(cards)` (src/App.jsx) runs on load and whenever credit cards change: on native Android (guarded by `Capacitor.isNativePlatform()`) it requests notification permission via `@capacitor/local-notifications` and schedules 9:00 AM local reminders for each credit card's next two cut dates and payment due dates, cancelling and rescheduling everything each time. On web it's a no-op. `POST_NOTIFICATIONS` and `SCHEDULE_EXACT_ALARM` are declared in `android/app/src/main/AndroidManifest.xml`.

### Savings interest

`applyInterest()` runs once on load: for each `ahorro` card, it computes elapsed days since `lastAccrual`, applies daily-compounded interest on the current balance, and prepends a synthetic `interest` movement before bumping `lastAccrual` to today. This is how savings yield accrues — there's no server-side cron.
