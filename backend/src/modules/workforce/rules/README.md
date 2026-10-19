# Workforce `rules`

The rules store: the settings that decide lateness, overtime, attendance, leave, probation, casual work, conduct,
statutory deductions, holidays and the week. Built in slice 0 (the store and two reads); **the write side and everything
the Rules screens need was built in segment 1B (19 Oct 2026, branch `feat/workforce-1b-rules-backend`)**. Specs:
[`1b-rules-spec.md`](../../../../../docs/features/workforce/specs/1b-rules-spec.md), choices in
[`decisions-1b-spec.md`](../../../../../docs/features/workforce/specs/decisions-1b-spec.md) (D1 to D30) and
[`decisions-1b-rules-backend.md`](../../../../../docs/features/workforce/decisions-1b-rules-backend.md) (what this build chose
beyond them). The original contract is [`slice-0-contract.md`](../../../../../docs/features/workforce/slice-0-contract.md) §6.

**Status:** back end complete and tested; the screens are the next front-end session.

## Folders (what the user does)

| Folder | What it holds |
|---|---|
| `resolve/` | What is in force: the resolver (`rules-resolve.ts`), the read repository, who is asking (`rules-context.ts`), the `GET /effective` service |
| `plan/` | The one place a change is decided: `plan-build.ts` (validate, dates, stale, clash, what changes, who may, confirmations, who is told), `plan-input.ts` (what to store), `plan-dates.ts`, `plan-months.ts` (the approved-month seam), `plan-notice.ts` (who is told), `plan-impact.ts` (preview rows) |
| `versions/` | Save (`versions-create.ts`), Preview, Withdraw, the version view, the write repository, validators, controller |
| `confirm/` | Confirm a pay rate, the holiday list or the statutory tables |
| `history/` | Paged version history with status, who is told and "what changed" in words |
| `page/` | One tab for one viewer (`GET /:group`) |
| `access/` | Per-row answers ("can Change, or who can"), the row catalogue, and the generated "Who edits what" table |
| `testing/` | `rules-fake.ts`, the in-memory stand-in the unit tests mount |

Root: `rules-schemas.ts` (Zod per group), `rules-defaults.ts` (examples, never policy), `rules-field-policy.ts` (per field: who
edits, whether a site may own it, what is confirmed, `pay`, `nextMonth`, `derived`), `rules-values.ts` (small pure helpers),
`rules-routes.ts`, `rules-http.ts`. `rules-service.ts` and `index.ts` are the public face: **everything outside this folder
imports `getEffectiveRules`, `getEffectiveRuleGroup`, `isPayConfirmed` from one of those two and never from a sub-folder.**

## The ten groups

Lateness, Overtime, Attendance, Leave, Probation, Casual work, Conduct, Statutory, Holidays, Week and breaks. Money and
multipliers are decimal strings. **Every default in `rules-defaults.ts` is an example, not a legal or policy value.** Statutory
ships empty; holidays are off. Stored values that predate 1B still read: an overtime `{ standard }` is the ordinary-day rate, a
per-position casual rate is dropped, and new leave-type and probation fields take their defaults. Nothing was migrated in SQL.

## Resolution

- `getEffectiveRules(siteId, date)`: per group, the company version with the greatest `effectiveFrom` not after the date (a tie
  goes to the higher version, **a withdrawn version is skipped**), else the code default as version 0; then the site override's
  own rows laid over it; then validated and, for Holidays, `enabled` set from the pay rate. System use only, never over HTTP.
- **A pay field waits for its confirmation (D2).** When the version in force has a scope nobody has confirmed (overtime
  multipliers, the holiday list, the holiday pay rate, statutory tables), that scope's values come from the next older version
  that *was* confirmed. `pendingConfirmations` lists those scopes. If nothing was ever confirmed, the value is kept and the scope
  is in `missingConfirmations`, and `isPayConfirmed` says not ready (payroll refuses; the engine and attendance never stop).
- A site's override stores **only the rows the site made its own** (any subset). An empty override follows the company rule (D21).

## Changing a rule

A change is a new `RuleVersion` row with the full new values, a day, and a required reason. Versions, confirmations and
withdrawals are insert-only; a static test keeps both repositories free of update, delete and upsert.

1. **Plan** (`plan-build.ts`), run first as a read, then again inside the transaction under a lock on the scope's timeline:
   group and site exist (another company's site is a 404); the person holds an edit right for the tab; the stale check
   (`expectedVersion`, D8); the start-day rules; the values are laid over what is in force and validated as a whole group; what
   actually changed is listed (a derived field never counts); every changed field needs its own edit capability, and a holder
   limited to one site may write only that site's own rows; confirmations are carried forward or given by the signer;
   the people to tell are listed.
2. **PIN** (`_shared/pin/signer-pin.ts`): the signer's own PIN, after everything the person could fix.
3. **Write** in one `runAudited` transaction: lock, plan again, the version, its confirmations, the audit entry
   (`rules.version_created`, `RULES_PAY` when a pay field changed, else `RULES_OPERATING`, with before, after, reason and the PIN
   signature, never the PIN) and, after commit, the event.

Start days: today or later in Nairobi; not before the newest live version of the scope (a *scheduled* version can be withdrawn to
free its day); the same day makes a higher number; at most two years ahead; the week start must itself start on the new first
day. **Only Statutory may start on a past day, never earlier than the first day of the earliest month not yet approved (D3).**
The suggested day (`defaultEffectiveFrom`) is the first of next month for pay changes and today for the rest (D10).

**An approved month never changes (D11).** Which months are approved is a Timesheets/Payroll fact that arrives through the small
`ApprovedMonthGuard` in `plan/plan-months.ts`. The Timesheets rework has not merged its month-approval status, so the default
guard is deliberately safe: every month before the current Nairobi month is treated as approved and the current one as open.
Effects today: Statutory cannot start before the 1st of this month; nothing else can start in the past; the preview always says
"Months already approved: Not changed". When the real status ships it calls `setApprovedMonthGuard(...)` once at start-up and
`approvedMonthsAffected` becomes real; no other file changes.

## Endpoints

Base `/api/v1/workforce/rules`. Every route: `authenticate`, `requireCapability(...)` (never a role list), a Zod schema. Success
envelope `{ success: true, data }`. **Wire names:** the platform renames `siteId`, `siteName`, `sites` and `site` to
`organizationId`, `organizationName`, `organizations` and `organization` on the way out (and accepts both on the way in), so the
screens read `organizationId` and `organizationName` wherever this README says site.

| Method and path | Capability | Notes |
|---|---|---|
| `GET /effective?siteId=&date=` | `rules.read` | Slice 0, unchanged. STATUTORY is `{ locked: true }` without `payrun.read` |
| `GET /access-table` | `rules.read` | The ten rows of "Who edits what", generated from the access table, field policy and audience map |
| `GET /:group?siteId=` | `rules.read` | The tab for this viewer (below). `siteId` absent: the company rule; a holder limited to one site always gets their own |
| `GET /:group/versions?siteId=&page=&pageSize=` | `rules.read` | Paged history, newest first (pageSize 10, 25, 50, 100) |
| `POST /:group/versions/preview` | any `rules.edit.*` | No side effects: `canSave`, `errors[]`, `changedFields`, `becomes`, `impact[]`, `told[]`, `needsConfirmation[]`, `confirmsWithYourPin[]`, `toldWithoutFigures`, the earliest and suggested day, `expectedVersion` |
| `POST /:group/versions` | any `rules.edit.*` | Save. Body `{ siteId, effectiveFrom, values, useCompanyRuleFor?, expectedVersion?, reason, pin, idempotencyKey? }` (the `Idempotency-Key` header works too). `201 { version, notice: { told }, confirmed, waiting }`; `200` with the same shape when the key had already made it |
| `POST /versions/:id/confirm` | any `rules.confirm.*` | `{ scope, note?, pin }`. Idempotent per version and scope |
| `POST /versions/:id/withdraw` | any `rules.edit.*` | `{ reason, pin }`. Only the newest version of its scope, only before its day. The row stays as "Withdrawn" |

The route asks only "can this person do anything of this kind"; the service decides field by field and site by site.

### The tab (`GET /:group`)

`group`, `siteId`, `siteName` (the site being looked at; null = the company rule), `values` (in force today, with the site's rows
laid over), `companyValues` (when looking at a site), `version`, `siteVersion`, `effectiveFrom`, `isDefault`,
`expectedVersion` and `expectedSiteVersion` (send the right one back when saving), `scheduled` (the next version not yet started,
with its change in words), `pendingConfirmations[]` (`scope`, `versionId`, `version`, `effectiveFrom`, `inForce`, `whoCan[]`),
`ownFields[]`, `rows`, `sitesWithOwnRule[]`, `sites[]`. `rows` is keyed by row id (the catalogue in `access/access-catalogue.ts`):
`{ fields, kind: EDITABLE | FIXED, canChange, lockedReason: { whoCan: [{ role, siteName? }] } | null, confirmedBy, waitingForConfirmation, ownRule }`.
`whoCan` roles are role codes; `MANAGER` or `STORE_MANAGER` (by the site's type) carries a `siteName`. A Fixed row has no padlock.

## Who may do what

One table: `_shared/workforce-access.ts` (capabilities `rules.read`, `rules.edit.lateness | overtime | attendance | leave_types |
min_cover | probation | casual_work | conduct | statutory | holidays | holiday_pay | week_breaks`, `rules.confirm.pay_rates |
statutory | holiday_list`) and `rules-field-policy.ts` (per field). The Director changes lateness, overtime (the Accountant
confirms the multiplier), attendance, probation, casual work, conduct, the week, the holiday list and minimum cover; HR changes
leave types; the Accountant changes statutory and the holiday pay rate; Branch and Store Managers change the rows a site may own
(lateness, overtime except multipliers, minimum cover) for their own site; the System Admin changes minimum cover only; everyone
else reads. Heads and floor staff have no `rules.read` (403). A holder limited to one site naming another site reads a 404 and
writes a 403 `RULE_FIELD_NOT_EDITABLE`.

## Errors a screen shows

`400` bad shape or date; `RULE_REASON`... (Zod: reason 1 to 500); `RULE_BACKDATED`, `RULE_MONTH_APPROVED`, `RULE_DATE_TOO_FAR`,
`RULE_DATE_NOT_WEEK_START` (400); `RULE_FIELD_UNKNOWN` (400); `RULE_SITE_FIELD_NOT_OVERRIDABLE` (422); `RULE_FIELD_NOT_EDITABLE`,
`RULE_CONFIRM_NOT_ALLOWED` (403); `PIN_INVALID`, `PIN_NOT_SET` (403); `PIN_LOCKED` (429); `RULE_NO_CHANGE`,
`RULE_STALE` (`details.latestVersion`), `RULE_FUTURE_VERSION_EXISTS` (`details.version`, `effectiveFrom`, `withdrawable`),
`RULE_CONFIRM_NOT_REQUIRED`, `RULE_VERSION_STARTED`, `RULE_VERSION_NOT_LATEST`, `RULE_VERSION_WITHDRAWN`,
`RULE_IDEMPOTENCY_KEY_REUSED` (409).

## Who is told, and what is audited

The TOLD column of the "Who edits what" table is `plan-notice.ts`: a site's own rule tells that site's manager instead of all of
them; minimum cover tells the site's department heads; a Branch Manager's change also tells the Director; the person who made the
change is never told; a pending confirmation tells the Accountant (or the Director for the holiday list) to confirm. The notice is
data (`rules.version_created` carries `notice.recipients`); delivery is the Notifications slice. **A pay field is told without
figures** (`pay: true`, `changes: []`); other fields carry old and new. The HTTP response carries counts per role only, never the
people. Audit actions: `rules.version_created`, `rules.version_confirmed`, `rules.version_withdrawn`, each with the signature.

## Edits to files other sessions also touch

`_shared/workforce-access.ts`: capability list (`rules.edit.leave` became `leave_types`, plus `min_cover` and `holiday_pay`), and the
grants of the Unit Manager, Accountant, HR, Director and System Admin (separate lines). `_shared/audit/audit-actions.ts`: one line
(`rules.version_withdrawn`). `_shared/events.ts`: two fields on `rules.version_created` and one new event. `rules-schemas.ts`: the
Overtime, Leave, Probation, Casual, Statutory and Holidays shapes (the Week and breaks section is untouched, so the cut-off removal
merges cleanly). `rules-defaults.ts`: four lines. `WeekAndBreaks.timesheetPeriod` and `timesheetCutoff` are now Fixed in the field
policy (no screen edits them) and are still parsed.

## Coupling

Reads `sites`, `users`, `companies` and department heads only through `resolve/rules-repository.ts`. Does not read Timesheets or
Payroll; the month-approval status arrives through `ApprovedMonthGuard`. Impact rows that need another module's count (late marks,
requests waiting, people on probation) are left out until that module can answer them; the server never invents one.
