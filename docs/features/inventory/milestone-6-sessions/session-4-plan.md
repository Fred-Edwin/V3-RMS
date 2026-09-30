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

### Visual parity pass (2026-09-29)

Method: Paper `get_computed_styles` / `get_jsx` per artboard against `getBoundingClientRect` / `getComputedStyle` on the live page (desktop 1440, mobile 390), then fixed every measurable difference. No pixel-diff.

- **History list** `1BN0-0` / `1CB2-0` — matched: header 68, chips row 48, row 113, selected chip 30 (mobile) / 26 (desktop), title tracking, ▾ on Custom range, "Sep" spelling. Empty state re-centred; loading and error states viewed in the browser (kit copy + Retry).
- **History detail** `1CMM-0` / `1CSZ-0` — matched: pill row 38, KPI 123 (cells 61/61/60/60), departments section 430 (16px inset, 8px row gaps), signed block 164, Reopen button 44, audit trail 135, total scroll height 958 = Paper. Rail name 15/18 and 5px dot on mobile.
- **Department drill-in** `1D2G-0` — matched: KPI strip 82, plain rows 85, note 56, sticky footer 85, button 46; closed-day note added; reason label in mono. Gap rows 134 vs Paper 135.
- **Opening sheet** `1A5R-0` (measured from the artboard's markup; Paper Desktop was closed for the last pass) — matched: text at x=36, × at 346–374, rows 358×63 at an 81px pitch, buttons 36→354 (46 / 48 tall), 64px below the buttons.
- **Accepted card** `1BIS-0` — card 358×90, 12/16 tracked label, 15/18 name.

**Deviations left (owner to confirm):**
1. The success toast is the shared light top toast; Paper `1BIS-0` draws a dark bottom toast. Every M6 toast is the shared one — a design-system decision, not changed here.
2. The pending opening card says "awaiting review"; Paper `122U-0` says "1 overnight variance". That number can't be known before the head recounts, so it isn't invented.
3. The recount stepper sits inline under the tapped row (Paper draws one stepper block after the list).
4. Paper's detail header uses `#241C16`, its list header the sidebar token; the app uses the token on both.
5. Rail names read "D. Town)" only because dev users are named "Dev Manager 1 (Nyeri Town)".
6. Month chip is 2px narrower than Paper (text metrics).
7. The detail/drill-in loading and error states and hover/motion were spot-checked, not measured.

## Outcome log

Built 2026-09-29: backend `ed63ac2`, frontend + docs `cf9d11e`, parity pass `15924e0`. Headlines, additions beyond this plan (`GET /branch-day/:id/overview`, past-day end-of-day cutoff, "Reopened · open" label, PIN dialog fix) and the ledger checks are in `milestone-6-plan.md` §8 → Session 4. Owner walkthrough: `demo/session-4-walkthrough.html`. **Still to do:** the cross-role integration pass (plan §6), owner review, push and PR.
