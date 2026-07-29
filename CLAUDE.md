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

Pushing to `main` triggers `.github/workflows/build-apk.yml`. If the `ANDROID_KEYSTORE_BASE64` (+ password/alias secrets) are set, it builds a **signed** release AAB (uploaded as a workflow artifact for Play Console) and a signed release APK (published to GitHub Releases); `versionCode`/`versionName` come from the run number. Without the keystore secret it falls back to an unsigned debug APK. Release signing config lives in `android/app/build.gradle` (reads `ANDROID_KEYSTORE_*` env vars). Keystores are gitignored. See `PLAY_STORE.md` for the full publishing steps; the privacy policy is `docs/index.html` (served via GitHub Pages).

## Architecture

`src/main.jsx` mounts `<FinanzasApp />` (default export of `src/App.jsx`). There is no router and no state-management library. Modules:

- **`src/App.jsx`** — the app shell: owns the single top-level `data` state object, loads/saves it, runs the load-time effects (interest accrual, recurring charges, notification-inbox drain, reminder scheduling), and renders the tab bar switching between five screens: Resumen, Cuentas, Movimientos, Fijos, Categorías.
- **`src/theme.js`** — `THEMES.dark` / `THEMES.light` color tokens, `ThemeContext` / `useTheme()`. Every component reads colors from `useTheme()` rather than Tailwind color classes; Tailwind is only used for layout (flex/grid/spacing), not color.
- **`src/constants.js`** — `FREQS`, `MESES_OPCIONES`, month names, `seedCategories`, and `EMPTY` (the state shape).
- **`src/store.js`** — the storage abstraction (see Persistence).
- **`src/utils/format.js`** — `money`, `uid`, `todayISO`, `isoOf`, `fmtDia`.
- **`src/lib/finance.js`** — all money math as pure functions: `cardLabel`, `movTotal`, `balanceOfCard`, `creditStatement`, `applyInterest`, `applyRecurring`, `nextChargeOf`, `parseCapturedNotification`, `ingestCaptures`, `clampDay`, `dateWithDay`. This is the single source of truth for balances and statements; screens never compute them independently.
- **`src/lib/notifications.js`** — the `NotificationInbox` native-plugin proxy and `scheduleCardReminders`.
- **`src/lib/backup.js`** — `exportData` (native: write file via `@capacitor/filesystem` + open `@capacitor/share` sheet; web: Blob download) and `isValidBackup`. Import/restore is wired in Ajustes (`<input type=file>`) → `App.importData`, which replaces the whole state with `applyRecurring(applyInterest({ ...EMPTY, ...backup }))`.
- **`src/components/ui.jsx`** — UI primitives: `Field`, `TextInput`, `Select`, `Btn`, `Chip`, `Amount`, `Card`, `SectionTitle`, `Empty`. Reuse these instead of writing raw `<input>`/`<button>` markup.
- **`src/components/GraficaMensual.jsx`** — the 6-month income/expense grouped-column SVG chart (with table view).
- **`src/components/GraficaCategorias.jsx`** — current-month breakdown of expenses/income by category as horizontal bars (Gastos/Ingresos toggle).
- **`src/components/Tour.jsx`** — the welcome tour overlay, shown on first launch (`data.tourSeen` flag) and replayable from Ajustes.
- **`src/screens/*.jsx`** — one file per tab (`Resumen`, `Cuentas`, `Movimientos`, `Fijos`, `Categorias`), each taking `{ data, update }` and calling `update(patch)` to merge a partial state patch into `data`. `Movimientos.jsx` also holds `InboxItem` and `MovEditor`; `Fijos.jsx` holds `FijoForm`. `Ajustes.jsx` (opened via the ⚙ header button, not a tab) holds preferences, FAQ, support contact (`SUPPORT_EMAIL` in constants.js), and terms & conditions.

### Data model

A single object (shape defined by `EMPTY`) holds everything:
- `accounts`: bank, cash, or debt accounts (`type`: `banco` / `efectivo` / `deuda`; can be `excluded` from totals)
- `cards`: belong to an account; `type` is `debito`, `credito` (has optional `cutDay`/`payDay` statement days 1–31), `ahorro` (savings, has `rate` % and `lastAccrual`), `efectivo` (auto-created for cash accounts), or `deuda` (auto-created for debt accounts; optional `rate` % + `ratePeriod` `"mensual"`/`"anual"` — interest accrues daily onto the debt via `applyInterest`, and the initial amount is an `adjust` gasto so it never counts as monthly spending). Debit/credit cards may also carry `digitalLast4` — the last 4 digits of an associated digital card, used (alongside `last4`) to match captured notifications to the card. `balanceOfCard` returns "amount owed" for `credito`/`deuda` (see `isDebtType`) and "amount held" otherwise; Resumen's net balance subtracts both debt kinds
- `categories`: each has a `freq` of `mensual` / `anual` / `esporadico` (drives how Resumen groups spending)
- `movements`: the transaction log — `type` (`gasto`/`ingreso`), `title` (required in the UI; older entries may only have `description`, so display falls back `title || description`), `description` (optional), `amount`, `commission`, `months` (>1 means MSI/installments), `categoryId`, `cardId`, `date`, and flags for system/special entries: `interest` (savings yield), `adjust` (balance edits), `transfer` + `transferId` (two-leg transfers between cards), `recurring` + `recurringId` (auto-generated monthly charges)
- `recurring`: fixed charges (subscriptions) — `title` (+ optional `description`), `amount`, `cardId`, `categoryId`, frequency (`unit` `"mes"`/`"semana"` + `every` N; monthly uses `day` 1–31, weekly uses `weekday` 0–6; legacy items with only `day` default to monthly), optional `endDate`, `createdAt`, `lastApplied`. Helpers `recurringFreqLabel` and `monthlyEquivalent` in finance.js. `applyRecurring()` runs on load and when the list changes, generating overdue `gasto` movements (flagged `recurring`) up to today; generated movements count as normal spending in every stat, and deleting a recurring item keeps its past movements. Managed in the "Fijos" tab
- `theme`: `"dark"` or `"light"`

Everything else (card balances, credit debt, savings totals, monthly/annual spend groupings, MSI schedules, credit statements) is derived on the fly from `movements` — there are no stored running balances. Balance edits in the UI don't mutate a balance field; they compute a diff and append a synthetic `adjust` movement so the ledger stays internally consistent.

**Transfers**: a transfer (Movimientos tab, or the "Pagar" button on credit cards in Resumen) creates two movements sharing a `transferId` — a `gasto` leg on the source card and an `ingreso` leg on the destination — both flagged `transfer: true`. They move balances but are excluded (like `adjust`) from every spending/income stat: monthly totals, category groupings, and the monthly chart. Deleting one leg deletes both. In Movimientos, editing a transfer opens `TransferEditor`, which updates BOTH legs together (via `saveTransfer`) so they stay balanced; editing an `adjust` uses `MovEditor` with the category field hidden. Only `interest` movements are read-only.

**Credit statements**: `creditStatement(card, movements)` derives, for a credit card with a `cutDay`, the current statement: `toPay` (charges accrued through the last cut date minus all payments; MSI purchases accrue one installment per elapsed cut), `periodSpend` (spending since the cut), and `dueDate` (next `payDay` after the cut). Resumen renders this per card plus a "Pago del mes" total.

### Persistence

The `store` object (`src/App.jsx`) abstracts storage: it uses `window.storage` if present (Claude/sandboxed environments), otherwise falls back to `localStorage` under the key `finanzas:data`. Data round-trips through `JSON.stringify`/`JSON.parse` on every change (`useEffect` on `data`).

### Notification inbox (auto-captured charges)

Android-only, **opt-in** feature (off by default): the user turns it on with the `notifCaptureEnabled` toggle in Ajustes, which calls the plugin's `setServiceEnabled(true)`. The `NotificationCaptureService` is declared `android:enabled="false"` in the manifest and only enabled (via `PackageManager.setComponentEnabledSetting`) when the user opts in — so while off, the app doesn't even appear in the system's "Notification access" list. All capture UI in Movimientos and the load-time drain are gated on `notifCaptureEnabled`. Custom native code in `android/app/src/main/java/com/yukioyoko/finanzas/`:
- `NotificationCaptureService` (a `NotificationListenerService`, requires the user to grant "Notification access" in system settings) captures any device notification containing a money amount into a local JSON file, recording package name (`app`), human-readable `appLabel`, `title`, `text`, and `time`.
- `NotificationInboxPlugin` (registered in `MainActivity`) bridges to JS as the `NotificationInbox` plugin with `isEnabled()`, `openSettings()`, `setServiceEnabled(enabled)` (toggles the listener component), `listInstalledApps()` (launcher apps via the manifest `<queries>` MAIN/LAUNCHER intent — not `QUERY_ALL_PACKAGES` — so the user can pick banks up front instead of waiting for a notification), and `drain()` (returns captured items and clears the file).

On the JS side (`registerPlugin("NotificationInbox")` in src/App.jsx), a load-time + on-resume effect drains captures through `ingestCaptures` (in finance.js), which: (1) registers every seen app in `data.inboxApps` (`{ pkg: { label, enabled } }`) **disabled by default** — only enabled apps' notifications become inbox items, so the user allowlists their banks (managed in Ajustes → NotificationCapture, a collapsible list); (2) dedups via `data.inboxSeen` — both `pkg|amount|title` AND `card|cardId|amount` signatures within a 10-min window (so the same charge from two different apps for the same card+amount collapses to one), kept 7 days; (3) calls `parseCapturedNotification` (amount + card by last-4 + type by keywords), and when no card matched, `guessCardFromApp` maps the bank app label to an account's `bank`/name and prefills its single debit/credit card; (4) pairs a `gasto` + `ingreso` of the same amount on different accounts within the window into a `kind: "transfer"` inbox item. The Movimientos "Por confirmar" list renders `InboxItem` for normal captures (complete title/category) and `InboxTransferItem` for detected transfers (confirm from/to → creates the two-leg transfer). `data.inbox`, `inboxApps`, and `inboxSeen` persist with the rest of the state.

### Notifications

`scheduleCardReminders(cards)` (src/App.jsx) runs on load and whenever credit cards change: on native Android (guarded by `Capacitor.isNativePlatform()`) it requests notification permission via `@capacitor/local-notifications` and schedules 9:00 AM local reminders for each credit card's next two cut dates and payment due dates, cancelling and rescheduling everything each time. On web it's a no-op. `POST_NOTIFICATIONS` and `SCHEDULE_EXACT_ALARM` are declared in `android/app/src/main/AndroidManifest.xml`.

### Savings interest

`applyInterest()` runs once on load: for each `ahorro` card, it computes elapsed days since `lastAccrual`, applies daily-compounded interest on the current balance, and prepends a synthetic `interest` movement before bumping `lastAccrual` to today. This is how savings yield accrues — there's no server-side cron.
