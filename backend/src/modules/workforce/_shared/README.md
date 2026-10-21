# Workforce `_shared`

Access table, time engine, audit writer and events. Built in slice 0; spec in
[`slice-0-contract.md`](../../../../../docs/features/workforce/slice-0-contract.md) sections 3 to 5 and 7.

**Status:** built, tested, no screens.

## Access (`workforce-access.ts`, `tracks-time.ts`, `permissions-routes.ts`)

One table, **role by capability by scope** (`own`, `dept`, `unit`, `all`), read by routes, services and the front end
(`GET /workforce/permissions/me`, with the System Admin's demo-only `?asRole=` preview; ignored for anyone else).

- Routes use `requireCapability(...)` after `authenticate`. Services check the record with `assertInScope` (writes refuse
  with 403, reads answer 404) and `assertNotSelf`. Never add a `requireRole(...)` list.
- **The Director and the System Admin read and write everything (owner decision, 21 Oct 2026; reverses D2 and D15).**
  Their grants are `FULL_ACCESS` (every capability at scope `all`) minus `NOT_FULL` in `workforce-access.ts`: the
  own-file capabilities (the Director keeps them at scope `own`; the System Admin has no file, payslip or clock), the steps
  that belong to one role (Accountant: `payroll.approve`, `payroll.pay`, `p9.confirm_format`, `rules.confirm.pay_rates`,
  `rules.confirm.statutory`; HR: `payroll.review`, `payroll.publish`, `payroll.correct`, `p9.generate`, `payslip.read_any`,
  `discipline.decide` for the System Admin), and `timesheet.close` (the Director keeps it at `unit`). Nobody approves,
  decides, signs, exits or changes the pay of **their own** file (`assertNotSelf`); PIN steps stay the actor's own PIN; a
  Director's pay change applies at once and tells HR and the Accountant (no amount), while an HR or System Admin request
  still needs a different Director. Choices and reasons: `docs/features/workforce/decisions-access-change.md`.
- A **department head is a marker on a base role**, not a role: `grantsOf` merges the base role's grants with the head
  extras, the wider scope winning. Heads' department scope uses `sameDepartmentGroup` (Kitchen covers Pastry).
- **Tracks time** drops `time.own`. Until slice 1 gives each person a flag, `defaultTracksTime(role)` applies (decision
  D2); slice 1 registers the real lookup with `setTracksTimeResolver`.
- **Sensitive fields** (pay, bank, ids, documents, discipline, payslip opens) are hidden by omission; `redactSensitive`
  also returns `locked` so a screen can show a lock.
- To change who can do what, edit the grants in `workforce-access.ts` and the matrix in its test, nothing else.

## Time engine (`time/`)

Pure functions: Nairobi helpers, lateness, hours worked, weekly and period totals, overtime candidates, period
boundaries. Ground rules:

1. Stored moments are UTC; shift times are Nairobi clock times; Nairobi is a fixed UTC+3.
2. **Forbidden in this folder:** `getHours`, `getMinutes`, `getDay`, `getDate`, `getMonth`, `getFullYear`, `setHours`,
   `toLocale*`, `Intl.`, the local-time `new Date(y, m, d, ...)`, an argument-less `new Date()` and `Date.now()` (the
   current time is always a parameter). `time-static.test.ts` greps for them.
3. No overnight shifts (D5); work after the end belongs to the shift's date.
4. Early arrival is not paid and not overtime. Minutes are whole and floored (06:05 on a 06:00 shift is 5 minutes late).
5. Each shift is separate; totals add them. Weeks start on the rule's day (Monday by default).

Run the three-zone check: `pnpm test:workforce-tz` (the folder runs under `TZ=UTC`, `Africa/Nairobi`,
`America/Los_Angeles`, as three separate processes).

## Audit (`audit/`)

`runAudited(change)` opens the transaction, runs the change, writes each entry, commits, then emits the events; a failed
change leaves no entry and no event. Entries are **append-only** (database trigger on `workforce_audit_entries`, no
escape hatch) and **hash-chained** per company (`seq` gap-free, `prev_hash`, `hash`; `verifyAuditChain` checks it).
`writeAuditEntry` must be the **last write** of a transaction (it locks the company's chain head). One entry per bulk
action. Actions are registered in `audit-actions.ts` with the categories they may use; each slice adds its own codes.
Reading is role-limited by category (`auditReadScopeOf`); the endpoints and screens are slice 7. Entries are kept 7 years;
slice 0 deletes nothing. `audit-db.test.ts` is the integration proof and runs only against a `_lane` database.

### Added in Segment 6a
- `runAudited` takes an optional `afterWrite(tx, records)`: it runs in the same transaction right after the entries are written and receives them, so a row that must carry an entry's id (a security alert) is written with it. It must not lock anything another writer waits on.
- The writer also inserts the entry's `workforce_audit_entry_index` row (title, area, flag, search text) from `describeEntry` (`audit/audit-describe.ts`, wording in `audit-titles.ts`). The detail builder uses an allow-list and never prints a money or secret-looking key.
- PIN door (`pin/`): `attemptWithPause(userId, purpose, check)` returns `RIGHT`, `WRONG` (with `alert` on the 3rd wrong in 15 minutes) or `SLOW` (2, 4, 8, 16, 30 s; never a lock). `setPinTryStore` swaps the store (memory in tests, the database from `registerPinTries()`); `setWrongThresholdListener` is how security hears about the 3rd wrong signing PIN. Purposes: `SIGNER`, `CONDUCT_SIGN`.

## Events (`events.ts`)

A typed in-process bus (`workforceEvents`) and a `WorkforceNotifier` that only logs until a later slice delivers
notifications. Slice 0 emits `rules.version_created` and `rules.version_confirmed`; the other event names are declared so
later slices agree on payloads from day one.

## Coupling

Reads the signed-in user only through `req.user`. Imports the legacy `utils/departments`, `utils/errors`,
`utils/date-only` and `utils/logger`. Imports only the *types* of `../rules`.
