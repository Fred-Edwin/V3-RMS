# Handover: Corporate Account date-range view + PDF statement export

## Context

Wendo RMS accountants use `/app/accountant/credit` → Corporate Accounts tab to
track and reconcile corporate client accounts (companies with a running
credit balance — e.g. CITAM, NCBA Nyahururu — that charge orders across
branches and settle periodically). The tab was recently redesigned into a
master-detail layout: a left list of companies, a right detail panel
(`CorporateAccountDetail` in `frontend/app/app/accountant/credit/page.tsx`)
showing a ledger-style stat strip (Outstanding balance / Credit Limit /
Orders on File), an Orders tab (expandable rows with item detail), a
Settlements tab, and a "Record Settlement" action.

Two things are missing that accountants need:

1. **A date-range picker on the detail panel.** Right now Orders and
   Settlements always show the full lifetime history for the account
   (`getOrderHistory(id, token, 1, 100)` / `getSettlementHistory(id, token, 1,
   100)` — no date params exist anywhere in this chain, backend or frontend).
   Accountants need to scope what they're looking at to a billing period.

2. **A real "Statement" export they can send to the corporate client.** A
   previous pass added a client-side CSV dump (all-time orders + settlements,
   no formatting) and it was deliberately removed — it wasn't something you'd
   put in front of a company's accounts-payable desk. What's needed instead
   is a proper PDF statement, scoped to the picked date range, following the
   same document conventions as other reports in this app.

**Explicitly out of scope for this work:** `billingCycleDay` (a field on
`CorporateAccount`, currently just stored/displayed as "Day N" — see
`frontend/app/app/admin/corporate-accounts/page.tsx`) should **not** be used
to compute or default anything here. The date range is purely user-picked —
no default-to-billing-cycle logic, no "due to bill" worklist. That's
deliberately deferred to a future pass.

## What already exists — reuse these

**PDF infrastructure is real and working** — do not build a new PDF
pipeline. `backend/src/utils/report-formatters.ts` has a full `pdfkit`-based
system already used for other reports (daily summary, staff performance,
branch overview, and — most relevantly — the accountant's own Reconciliation
report):

- `toPdf<T extends ReportType>(type, data)` — the dispatcher (bottom of the
  file, ~line 1111). Add a new branch here.
- `ReportDataByType` — a type map keyed by `ReportType` (~line 1102). Add a
  new entry.
- Drawing primitives you'll reuse directly: `drawBrandedHeader`,
  `drawPageBorder`, `drawSectionLabel`, `drawKpiRow`, `drawTable`,
  `drawFooter`, `formatKes`, `rev` (all defined earlier in the same file).
- **Closest precedent to copy: `drawReconciliationPdf`** (~line 1010). It's
  PDF-only (no CSV — `toCsv` explicitly skips `accountant_reconciliation`,
  see ~line 267), draws a branded header with a date-scoped subtitle, a KPI
  summary strip, and one or two `drawTable` sections. Your new
  `drawCorporateStatementPdf` should follow this exact shape.

**Export pipeline to extend, not replace:**
- `backend/src/validators/report-schemas.ts` — `ExportQuerySchema` (~line
  34) has `reportType: z.enum([...])`. Add `'corporate_account_statement'`
  to that enum.
- `backend/src/types/report.types.ts` — `ReportType` union (~line 452). Add
  the same new value there.
- `backend/src/services/report-service.ts` — `exportReport` (~line 266) is a
  big if/else keyed on `query.reportType` that builds the report data, then
  calls `toCsv`/`toPdf`. Add a new branch. **Important scoping difference:**
  every existing branch scopes by `organizationId` (a branch). Corporate
  accounts are **system-level, not branch-scoped** (see
  `docs/DATA_MODEL.md` §4.24 — "No `organizationId` — corporate accounts are
  accessible from any branch"). A statement is for one *company* across all
  its branches' orders, not one branch. So this new branch needs a
  `corporateAccountId` param instead of (or in addition to)
  `organizationId` — **do not reuse `organizationId` for this.**
- `frontend/services/reportService.ts` — `exportReport` (~line 133) builds
  the query string and does a raw `fetch` + blob download (it's not a JSON
  API call — check how it handles the PDF response). `frontend/types/report.ts`
  — `ExportReportQuery` (~line 424) is the matching frontend type; both need
  the new `reportType` value and a `corporateAccountId` field.

**Order/settlement history to extend with date filters:**
- `backend/src/repositories/corporate-account-repository.ts` —
  `findOrdersByAccountId` (~line 116) and `findSettlementsByAccountId`
  (~line 141). Both currently take `(id, page, perPage)` with a Prisma
  `where: { corporateAccountId: id }`. Add optional `startDate`/`endDate`
  and extend the `where` with `createdAt: { gte, lte }` when present — same
  pattern already used in `other-income-repository.ts`'s `findEntries` (see
  `if (filters.startDate ?? filters.endDate) { where.entryDate = {}; ... }`)
  or `report-repository.ts` for date-range filtering conventions already in
  this codebase.
- `backend/src/services/corporate-account-service.ts` —
  `getOrderHistory`/`getSettlementHistory` (~line 101, ~line 117). Thread the
  new date params through.
- `backend/src/controllers/corporate-account-controller.ts` —
  `getOrderHistory`/`getSettlementHistory` controllers (~line 67, ~line 84).
  Accept `startDate`/`endDate` as optional query params (reuse or extend the
  local `paginationSchema`, or add a small date schema — see
  `isoDateSchema` in `backend/src/validators/order-schemas.ts` for the
  existing date-string validator used elsewhere in this codebase).
- No new routes needed — `GET /corporate-accounts/:id/orders` and
  `GET /corporate-accounts/:id/settlements` already exist in
  `backend/src/routes/corporate-account-routes.ts` and are already
  `requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT')`-gated. Just extend
  their query params.

**Frontend service layer:**
- `frontend/services/corporateAccountService.ts` — `getOrderHistory` and
  `getSettlementHistory` (both near the bottom of the file). Add optional
  `startDate`/`endDate` params, threaded into the query string the same way
  `page`/`perPage` already are.

## What to build

### 1. Date-range picker on the detail panel

In `CorporateAccountDetail` (`frontend/app/app/accountant/credit/page.tsx`,
the component rendering the right-hand panel with the ledger strip + Orders/
Settlements tabs), add a From/To date picker. Reference implementation for
the exact UI pattern: the Reconciliation page's stale-orders date filter in
`frontend/app/app/accountant/reconciliation/page.tsx` (`staleStartDate`/
`staleEndDate` state + two `<input type="date">` fields + an Apply/Refresh
button — search for `staleStartDate` in that file).

- No default range — leave it empty/unset until the user picks one (per the
  "no billing-cycle defaulting" constraint above). Decide with the user
  whether an empty range means "show nothing until a range is picked" or
  "show all-time until a range is picked" if this isn't obvious from context
  — this wasn't pinned down and is worth a quick check before assuming.
- Wire the picker to `loadOrders`/`loadSettlements` (both already exist in
  `CorporateAccountDetail` as `useCallback`s) so they refetch scoped to the
  selected range.
- The "Orders on File" tile in the ledger strip currently shows a lifetime
  count; once filtering exists it will reflect the selected range — reword
  the label accordingly (e.g. "Orders in Range") so it doesn't read as a
  lifetime total anymore.

### 2. PDF statement generation

- New `ReportType`: `corporate_account_statement`.
- New type in `backend/src/types/report.types.ts`, e.g.
  `CorporateAccountStatementReport`, containing: company details (name,
  contact name/phone/email), the date range covered, the list of orders in
  range (order #, date, employee ref, branch/org name since orders can span
  branches, amount), the list of settlements in range (date, amount, method,
  recorded by, note), and period totals (total charged, total settled).
  **No opening/closing balance carried forward from before the range** —
  that would require the billing-cycle/ledger-snapshot work that's out of
  scope here. Keep it to "here's what happened in this window."
- New `drawCorporateStatementPdf(doc, data)` in `report-formatters.ts`,
  modeled directly on `drawReconciliationPdf`: branded header (company name +
  date range as the subtitle), a KPI strip (total charged / total settled /
  net), an Orders table, a Settlements table.
- Wire into `exportReport` in `report-service.ts` — build the report data by
  calling the (now date-filtered) `corporateAccountRepository.findOrdersByAccountId`
  and `findSettlementsByAccountId` methods directly (or via
  `corporateAccountService`), scoped by `corporateAccountId` + the date
  range from the query. Role-gate the same way `accountant_reconciliation`
  is gated (`DIRECTOR`/`ACCOUNTANT` — check `corporate-account-service.ts`'s
  existing `getOrderHistory`/`getSettlementHistory` role checks for the
  exact set to match).
- PDF-only, no CSV (follow the `accountant_reconciliation` precedent in
  `toCsv` — it explicitly returns an empty/skipped buffer for that type;
  do the same for `corporate_account_statement`).

### 3. Statement button on the frontend

- Re-add a "Statement" button in `CorporateAccountDetail`'s header (it was
  removed in a prior pass along with the old CSV-dump version — the header
  currently only has "Record Settlement"; see the `flex shrink-0 gap-2` div
  in the header's JSX).
- On click, call `reportService.exportReport` with
  `reportType: 'corporate_account_statement'`, the selected date range from
  the new picker, `format: 'pdf'`, and `corporateAccountId: account.id`.
- Disable the button until a date range is selected (a statement needs a
  defined period — don't allow "statement of all time").

## Verification

- Backend: `pnpm build` and `pnpm test` in `backend/` (per
  `docs/CODING_STANDARDS.md` / root `CLAUDE.md` — both must pass, not just
  `tsc`). Check whether `corporate-account-service.test.ts` needs new test
  cases for the date-filtered history methods and the new export path.
- Frontend: `pnpm build` in `frontend/`.
- Manual check: log in as the seeded accountant (`accountant@wendo.co.ke` /
  `password123`), go to `/app/accountant/credit` → Corporate Accounts tab,
  pick a company with order/settlement history (e.g. CITAM or NCBA
  Nyahururu — check current data via `GET /api/v1/corporate-accounts` with
  the accountant's bearer token), set a date range, confirm Orders/
  Settlements re-filter, click Statement, confirm a PDF downloads and its
  contents match the selected range.
- Watch for the stale-dev-server trap that hit this feature before: if
  `backend`'s `tsx watch` process was started in an earlier session and
  seems to be ignoring new routes/files (new endpoints 404 with "Route not
  found" even though the code is correct on disk), kill and restart it
  (`pnpm dev` in `backend/`) rather than assuming the code is wrong.
