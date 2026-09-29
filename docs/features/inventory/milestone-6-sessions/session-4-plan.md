# Milestone Six — Session 4 (History, next-morning opening, integration) — Build Plan

Scope: `milestone-6-plan.md` §0 "Session 4" and §6. Branch `feat/m6-s4-history-opening`
off `main` (`bb45903`, S3 merged as #45). Last build session of Milestone Six.

## Owner decisions settled at session start (2026-09-29)

- S3 deviations accepted as built: amber "Counted" while open / green once closed;
  counts editable while the day is open; rail names the Branch Manager as counter.
- **Shared PIN sheet fixed this session**: boxes clear after a wrong PIN, Enter submits.
- SM mobile Thresholds entry is already drawn (`1J43-0`) and wired — nothing to build.
- DH landing "Stock ledger" quick action already exists in code (S1). Paper variant
  `1L02-0` (page `p-G-0`) draws it; the S4 landing work keeps it.
- wds line-height drift vs Paper is logged, not fixed in M6.

## Screens

| Screen | Node(s) | Device |
|---|---|---|
| Day close history · list | `1BN0-0` / `1CB2-0` | desktop / mobile |
| Day close history · detail | `1CMM-0` / `1CSZ-0` + `1D2G-0` | desktop / mobile list + drill-in |
| Next-morning opening · review sheet | `1A5R-0` | mobile |
| Next-morning opening · accepted | `1BIS-0` | mobile (landing card + toast) |
| DH landing with Stock ledger action | `1L02-0` | mobile (parity only) |
| Loading / empty / error | plan §0.1 rows "Day close history", "Next-morning opening" — States kit `1I6L-0` | both |

Wire: mobile "History" link on Today's day (was disabled), desktop "History" entry, DH
landing "Opening count" card (was a disabled placeholder), "Reopen day" beside
"View signed document" on history detail (reuses S3 reopen drawer/mobile).

## Data model (migration `20260930100000_milestone6_session4_opening`, additive)

- `DepartmentOpening` (`branchDayId` = the day being opened, `departmentTag`, `locationId`,
  `acceptedById`, `acceptedAt`; `@@unique([branchDayId, departmentTag])`) — created only
  when the DH accepts; "not yet accepted" is the absence of a row.
- `DepartmentOpeningLine` (`inventoryItemId`, `prefilledQty`, `acceptedQty`,
  `overnightVariance`, `unitCost`; unique per opening+item).
- `InventoryTransaction.openingLineId` — nullable real FK + index.

## API (`API_CONTRACT.md` §26.4)

| Endpoint | Roles | Notes |
|---|---|---|
| `GET /branch-day/history?range=day\|week\|month\|custom&from&to` | MANAGER | closed / reopened / open past days; range capped at 92 days; aggregates from saved lines (no per-day recompute) |
| `GET /branch-day/:id` | MANAGER | KPIs, departments (+ lines per department), signed-by, reopen audit trail; saved lines only |
| `GET /branch-day/opening` | Department Head | own department only: prefill = department on-hand now, `lastCloseAt`, accepted state if already accepted |
| `POST /branch-day/opening/accept` | Department Head | `{lines:[{inventoryItemId, acceptedQty}]}` — one transaction: opening + lines + overnight `ADJUSTMENT` per differing line (`ADJ-####`, `openingLineId`); after commit: Branch Manager push if any line ≥ `overnightAlertKes` |

**Recompute hook** (inside `close`, same transaction): if the *next* calendar day has an
accepted opening, after the fresh close adjustments are written, for each opening line:
reverse its standing overnight adjustment (linked), recompute `prefilledQty` = on-hand
excluding the opening's own rows, `overnightVariance = acceptedQty − prefilledQty`, write
a fresh adjustment if non-zero. The accepted figure stays authoritative (it is what the
department head physically counted); Σ ledger equals it afterwards.

## Build order

1. Backend: schema + migration, validators/types, repository, service (history, detail,
   opening get/accept, hook), routes (`allowDepartmentHead` on opening), fcm method,
   tests (service, hook, org-scoping, contract), docs (`API_CONTRACT` §26.4, `DATA_MODEL`).
2. PIN sheet fix (shared component).
3. History list → detail (desktop + mobile), each through the plan §4.4 gate.
4. Opening sheet → accepted, DH landing wiring.
5. Integration pass (plan §6 Session 4): Flows 4, 5, 5a, 6, 12, 12a, 12b, 12c, 13, 19, 20, 21
   across roles in a real browser + Postgres ledger checks; M2–M5 ledger regression click-through.

## Outcome log

_(appended as built)_
