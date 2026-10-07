# Workforce `rules`

The rules store: the settings that decide lateness, overtime, attendance, leave, probation, casual work, conduct,
statutory deductions, holidays and the week. Built in slice 0; spec in
[`slice-0-contract.md`](../../../../../docs/features/workforce/slice-0-contract.md) section 6.

**Status:** service and two read endpoints built. The Rules screens and the **write endpoints are slice 4**; until then
`rulesService.createVersion` and `confirmVersion` are called by tests only.

## The ten groups

Lateness, Overtime, Attendance, Leave, Probation, Casual work, Conduct, Statutory, Holidays, Week and breaks. Each has a
Zod schema (`rules-schemas.ts`). Money and multipliers are decimal strings. **Every default in `rules-defaults.ts` is an
example, not a legal or policy value.** Statutory ships empty; holidays are off.

## Who edits, who confirms

Per field, as capabilities (`rules-field-policy.ts`): the Director edits most groups, HR the leave types and holidays, the
Accountant the statutory tables; a Branch Manager may write an override for **their own branch** only, for lateness,
overtime (not the multipliers) and leave minimum cover. Pay-rate fields (overtime multipliers, holiday pay rate,
statutory tables) and the holiday list need a second person's **confirmation** (Accountant, Accountant, Director). An
editor who holds the confirm capability for what they changed confirms it in the same step.

## Resolution and versioning

- `getEffectiveRules(siteId, date)`: per group, the company version with the greatest `effectiveFrom` not after the date
  (a tie goes to the higher version), else the code default as version 0 (`isDefault`); then the site override's fields
  laid over it; then validated. System use only, never over HTTP.
- Editing **never changes a row**: it inserts a new `RuleVersion` with the full new values, an effective date and a
  required reason. The date must be today (Nairobi) or later and not before a version already stored; the same date makes
  a higher version number. No difference from what is in force: `409 RULE_NO_CHANGE`.
- Confirmations are rows too; an unchanged, already-confirmed scope is **carried forward** into the next version. Only
  payroll refuses an unconfirmed pay rate (`isPayConfirmed`); the engine and attendance always run.
- Each audited edit writes `rules.version_created` (category `RULES_PAY` for statutory, multipliers and holiday pay, else
  `RULES_OPERATING`) in the same transaction, and emits the event with who is to be told.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/workforce/rules/effective?siteId=&date=` | `rules.read`; date defaults to today in Nairobi; a branch holder reads their own site only; STATUTORY is `{ locked: true }` without `payrun.read` |
| GET | `/workforce/rules/:group/versions?siteId=` | newest first; no `siteId` = company versions |

## Coupling

`getEffectiveRules` is what the time engine's callers use. Reads `sites`, `users` and `companies` only through
`rules-repository.ts`. Versions and confirmations are never updated or deleted (a static test checks the repository).
