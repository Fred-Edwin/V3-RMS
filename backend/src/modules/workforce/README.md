# Workforce (backend module)

People, rota, attendance, timesheets, leave, payroll and conduct for Wendo. The living spec is in
[`docs/features/workforce/`](../../../../docs/features/workforce/README.md) (proposal and decisions D1 to D18); slice 0's
frozen build contract is [`slice-0-contract.md`](../../../../docs/features/workforce/slice-0-contract.md).

## Status

| Slice | What | State |
|---|---|---|
| 0 | Foundation: access table, time engine, audit writer, rules store (no screens) | **Built** (`_shared/`, `rules/`) |
| 1 People · 2 Rota · 3 Attendance · 4 Timesheets, overtime, approvals · 5 Leave · 6 Payroll · 7 Conduct, audit read side | Not started |

The eleven sub-modules of the proposal arrive with those slices. Today the legacy HR, clock, shift and payslip code in
`controllers/ services/ repositories/` still runs; each slice replaces its part in place (contract section 10 lists what
is left on purpose).

## Layout

```
workforce/
  index.ts        the public door: the only file other modules may import
  _shared/        access table, time engine, audit writer, events (README inside)
  rules/          rules store: versioned, effective-dated settings (README inside)
```

## Dependency direction

Sub-modules depend downwards only: rules and the later sub-modules use `_shared/` (access, time, audit); `_shared/` never
imports a sub-module except for types (`events.ts` reads the rule types). Nothing outside Workforce imports anything
except `index.ts`.

## The public door (`index.ts`)

Exports the access table and guards, the time engine, the audit writer and chain verifier, `getEffectiveRules` and its
helpers, the rule defaults and schemas, the typed event bus, and the two routers `routes/index.ts` mounts. Four calls
need later slices and are **stubs that throw `NotBuiltYetError`** (HTTP 501, `NOT_BUILT_YET`): `getOnShiftNow` (slice 3),
`getEmployee` (slice 1), `isOnLeave` (slice 5), `getApprovedHours` (slice 4). Nothing calls them yet.

## Endpoints (slice 0)

| Method | Path | Guard |
|---|---|---|
| GET | `/workforce/permissions/me` | `authenticate` |
| GET | `/workforce/rules/effective` | `authenticate`, `requireCapability('rules.read')` |
| GET | `/workforce/rules/:group/versions` | `authenticate`, `requireCapability('rules.read')` |

## Rules for anyone adding to this module

- Access is by **capability**, from the one table in `_shared/workforce-access.ts`. Never add a `requireRole(...)` list.
- Prisma only in `*-repository.ts` (the `$transaction` in `_shared/audit/audit-writer.ts` is the one named exception).
  `workforce-layering.test.ts` checks it.
- Every change to hours, leave, pay, rules, roles, departments or heads goes through `runAudited` (the change and its audit
  entry commit together).
- Every moment is UTC, every shift time a Nairobi clock time; never use server-zone date calls in `_shared/time/`.
