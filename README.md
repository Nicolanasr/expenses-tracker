# Expenseo

Modern expense tracker with offline/PWA support, multi-account/payee tagging, budgets, transfers, recurring transactions, offline write queue, notifications, and audit logging.

## Features
- PWA shell with offline cache (read + queued writes)
- Accounts & payees; transfers create linked transactions
- Transactions with categories, payment method, notes, payee, account
- Budgets with alerts at 50/75/90/100%
- Recurring schedules (auto-log via cron/ping)
- Notifications (bell + optional email via Resend)
- Soft-delete + audit log (Activity page)
- CSV export

## Prerequisites
- Node 18+
- Supabase project (URL, anon key, service role key)
- (Optional) Resend for email notifications
- (Optional) Supabase Edge Function for recurring auto-run + GitHub Actions ping

## Setup
1) Install deps:
```bash
npm install
```
2) Environment (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...            # optional, for email
RESEND_FROM_EMAIL="Expenseo <no-reply@yourdomain.com>"
```
3) Database:
   - Apply `supabase/schema.sql` to your Supabase DB (SQL editor).
   - Ensure RLS is on; tables and policies are defined in the script.
4) Dev:
```bash
npm run dev
```

## Recurring auto-run (no local CLI)
We ship:
- `supabase/functions/recurring-run`: Edge Function to auto-log due recurring items.
- GitHub Actions:
  - `.github/workflows/deploy-recurring.yml` (manual deploy)
  - `.github/workflows/ping-recurring.yml` (pings function every 6h)

Secrets to add in GitHub Actions:
- `SUPABASE_ACCESS_TOKEN` (Supabase personal access token)
- `SUPABASE_PROJECT_REF` (project ref, e.g., abc123)
- `SUPABASE_SERVICE_ROLE_KEY`

Then run the deploy workflow once; the ping workflow will run on schedule.

## Notifications
- Bell dropdown calls `/api/notifications`.
- Email via Resend if `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set.
- Budget and recurring alerts insert into `notifications`; offline/other alerts can be added similarly.

## Soft-delete & Activity
- `deleted_at` on core tables; lists filter these out.
- Deletes set `deleted_at` and log to `audit_log`.
- Activity page (`/activity`) shows the last 50 audit entries with snapshots.

## How to Use (tester-friendly guide)
1) **Sign in / sign up**: Use the email/password flow. Stay signed in so offline mode works.
2) **Add a transaction** (`+` button):
   - Pick type (income/expense), amount, date, category, account, payment method, payee, notes.
   - Optional: mark as recurring (set first run date, frequency, auto-log).
   - Offline? It queues and will sync when you’re back online.
3) **Transfers** (`Transfers` tab):
   - Move money between accounts (e.g., Main → Savings, Main → Cash). Keeps reports clean (not counted as income/expense).
4) **Budgets** (`Budgets` tab):
   - Set monthly amounts per category; copy last month; delete a category’s budget or all for the month.
   - Watch “Budget health” on Overview; alerts fire at 50/75/90/100%.
5) **Recurring** (`Transactions` tab):
   - Create/edit/delete schedules. Due items auto-log (background job ~6h) or can be run manually. See upcoming/due in the panel.
6) **Filters & Reports** (`Overview` / `Transactions`):
   - Filter by date range, category, payment method, account, search. Saved filters are supported.
   - Income/expense/remaining balance exclude account transfers. Category breakdown and timeline reflect filters.
7) **Notifications**:
   - Bell shows budget/recurring alerts; mark read/all read. Emails sent if Resend is configured.
8) **Accounts & Payees** (`Account` page):
   - Add/edit/delete accounts; set default payment method per account to auto-select on new transactions.
9) **Activity** (`Activity` tab):
   - View last 50 changes with snapshots for audit/QA.
10) **Offline**:
   - Browse cached data; create/update/delete queues offline and replays on reconnect. If offline and already signed in, you shouldn’t be forced to login.

Troubleshooting tips:
- If you see “updated elsewhere,” refresh and retry.
- If offline queued work doesn’t sync, reconnect and wait a few seconds; check notifications for conflicts.
- For PWA issues, a hard refresh can rebuild the cache.

## Offline
- Service worker caches shell/offline page.
- Reads: cached data shown when offline.
- Writes: queued in IndexedDB and replayed on reconnect; toasts indicate queued/synced.

## Testing / QA checklist
- `npm run lint && npm run build`
- Auth online/offline (no redirect loop when already signed in offline)
- Transactions CRUD + undo (soft-delete)
- Transfers don’t count toward income/expense totals
- Budgets: set/copy/delete, alerts at 50/75/90/100
- Recurring: create/edit/delete, manual run, auto-run via cron/ping
- Notifications: bell + email (if configured)
- Offline queue/replay flows
- Activity page shows audit snapshots

## Deploy notes
- Rotate any keys that were in git; set secrets in your host and GitHub Actions.
- Supabase backups recommended; monitor Edge Function logs (`recurring-run`) and ping workflow success.
