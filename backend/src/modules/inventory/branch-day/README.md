# branch-day

**Design:** approved by the owner (Paper: *Inventory · Counting and closing*, B0 to B18 and chapter 5; flow in `branch-day-flow.md`) · **Code:** **back end built** (Block 4, 10 Oct 2026, branch `feat/block4-be`, not pushed): BD1 to BD21 to the frozen contract, the expand migration, the Audit log source, the old flow deleted. **No front end yet** (phone and desktop are the next two sessions). **The contract migration (drops the old enums and columns) is NOT written**: a separate later session (contract §11).

A branch's end-of-day count and close, and the morning opening. Each department head counts their own department blind on their phone and signs with their PIN; the Branch Manager reviews all departments, closes the day with a PIN, and corrects one item if it was wrong. The figure is **Used today** = opening stock + received − waste − closing stock. Nothing is reopened; the system flags nothing, asks for no reason and tells nobody.

The frozen contract is [branch-day-contract.md](../../../../../docs/features/inventory/branch-day-contract.md); in code it is `_shared/branch-day-contract.ts` with `branch-day-contract.fixtures.json` and `branch-day-contract.test.ts`, mirrored by hand in `frontend/features/inventory/branch-day/_shared/types/branch-day-contract.ts` (the fixtures are byte-identical). Nothing in the contract changed in this build.

## Endpoints (base `/api/v1/inventory/branch-day`)
| # | Method and path | Who |
|---|---|---|
| BD1 | `GET /home` | department rule (an active head or member of an active department of the branch). Creates today's day on the first read |
| BD2 | `GET /opening` | department rule; `branch_day.count_on_behalf` names `departmentId` |
| BD3 | `POST /opening/accept` | the same. No PIN, no ledger row |
| BD4 | `POST /opening/recount/preview` | the same. Writes nothing |
| BD5 | `POST /opening/recount` | the same. PIN. One `ADJ-` entry per line whose count differs from the ledger position |
| BD6 | `GET /count` | the same. Blind: nothing to count against, no money |
| BD7 | `PUT /count` | the same. Stores what was typed |
| BD8 | `POST /count/sign` | the same. PIN. Every line filled |
| BD9 | `GET /mine/history` | department rule only: the department's closed days, last 30 days by default, no money |
| BD10 | `GET /mine/days/:id` | department rule only: one past day, quantities only |
| BD11 | `GET /today` | `branch_day.read` (own branch; creates the day) or `read_any_branch` (picker; never creates) |
| BD12 | `GET /days/:id/departments/:departmentId` | a reader |
| BD13 | `GET /days/:id/close-summary` | `branch_day.close` |
| BD14 | `POST /days/:id/close` | `branch_day.close`. PIN |
| BD15 | `GET /history` | a reader: last 7 Nairobi days by default |
| BD16 | `GET /days/:id` | a reader (the day file) |
| BD17 | `GET /days/:id/activity` | a reader |
| BD18 | `GET /days/:id/documents` | a reader |
| BD19 | `GET /days/:id/entries` | a reader |
| BD20 | `POST /days/:id/corrections` | `branch_day.correct`. PIN |
| BD21 | `GET /days/:id/sheet` | a reader: the stored sheet, `printedAt` now, writes nothing |

Access: the six `branch_day.*` rows in `_shared/central-store-access.ts`. A head or member holds none of them from the table: the department rule is in the service (`departmentCaller`). The Branch Manager's own branch and the System Admin's reach are service rules (`NOT_YOUR_BRANCH`). No `requireRole` list anywhere.

## Rules in code
- **`branch-day-rules.ts` (pure):** the Nairobi day window, opening stock (accepted, else last night's signed figure, else the ledger at the start of the day), Used today, the usage entry (closing minus the ledger position), money (two decimals, half up, a line value is what totals add up), the blockers in Paper's order, the head's button (switches at 12:00 Nairobi), the correction window, the sheet pages (16 rows to a page).
- **`branch-day-figures.ts`:** a department's figures, live while the day is open, frozen at the close. A day closed under the old flow has closing figures only (`legacy`).
- **`branch-day-service.ts`:** every rule and every transaction. The first read makes the day, a row per ACTIVE department and a line per live item, with the number `DAY-{code}-{nnnn}` from the per-branch counter; a losing creation race re-reads the winner (proved with five simultaneous first reads). The close, a correction and a sign are idempotent by the key in the body (`replayed: true`).
- **Close (BD14):** one transaction under a row lock: blockers re-checked, every line frozen, one usage entry per line that moved (through `postStockMovement`, reference the day number, linked to the line, reason "Used today", signer the Branch Manager), totals, the day closed, sheet version 1. A line that moved nothing posts none (so a zero-use item has no entry; the contract's "43" is 41 in the fixtures).
- **Correct (BD20):** one linked `ADJUSTMENT` of the change, both figures kept, totals updated, sheet version n+1, allowed until that department's next opening is accepted. No reopen exists.
- **Views (`branch-day-view.ts`, `branch-day-sheet.ts`, `branch-day-sentences.ts`):** money keys are ABSENT unless the caller holds `catalog.see_costs`; the blind count carries none of the figure keys (a test pins the key names).
- **Audit log:** `audit-log/sources/branch-day-source.ts` (area `BRANCH_DAY`), derived from the rows, no money and no PIN.

## Files
`branch-day-{routes,controller,service,repository,validators,errors,rules,figures,view,sheet,sentences}.ts`, `branch-day.types.ts`, `_shared/` (the frozen contract), tests beside the code.

## Data (migrations, both committed beside the schema)
- `20261010090000_block4_branch_day_expand`: nullable and defaulted columns on `branch_days`, `branch_day_departments`, `branch_day_lines` and `department_openings`; new tables `branch_day_corrections` and `branch_day_sheets`; back-fills the department id links, the opening kind and the closing value of old closed days. Tested against the lane database's real rows (5 of 5 linked, 0 mismatches).
- `20261010091000_block4_branch_day_expand_tag_nullable`: `department_tag` becomes nullable on `branch_day_departments` and `department_openings`. **Contract §10.1 omitted this**: a department added in Block 1 has no legacy key, so its day row could not be made. The unique on the tag stays (Postgres treats nulls as distinct); the id-link unique covers every department.

## Tests
- Default run (`pnpm test`): `branch-day-rules.test.ts` (the §5 state tables), `branch-day-routes.test.ts` (all 21 endpoints against 7 roles, Zod, uuid params, the old routes gone), `branch-day-view.test.ts` (blind and money keys, figures, the sheet), the contract and access tests, the door's `reference` cases, `ledger-guard.test.ts` (its allow-list is now empty), `audit-log/sources/derived-sources.test.ts`.
- **Opt-in database test** `branch-day.db.test.ts` (49 tests, 10 Oct 2026, all passing): `cd backend && DATABASE_URL=<the lane's> RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/branch-day/branch-day.db.test.ts`, on its own, on the lane's database migrated to head. It builds two branches (the five departments, an added one with no key, a retired one), real users in every role, items, stock, a signed dispatch and an open discrepancy, parses every response against the contract's schema, and removes everything it made. Covers the migration back-fill, the concurrent first read, the department and branch rules for every kind of caller, opening accept and recount, the blind count, blockers, the close (balanced, linked, numbered, none for an unmoved item, idempotent, the ledger equals the count afterwards), Used today with received, waste and a reversed waste entry, money by capability, History, Activity, Documents, the stored sheet, the correction (a second one, the per-department window, replay), the Yesterday column, a day closed under the old flow, and an open day the old code made.
- Dev fixtures: `src/scripts/seed-branch-day-dev-fixtures.ts` (`--state=none|open|counting|ready|closed`) and `seed-branch-day-history-dev-fixtures.ts`, rewritten for the new shape.

## Build notes: where this build fills a gap or differs from the contract (for the owner)
1. **`department_tag` nullable** (above): a contract omission needed by §5.1.
2. **The Audit log has no money and no PIN** (the owner's instruction for this build). Contract §9 words the close as "Closed the day · Used value KES … · signed with PIN" for the Audit log; the log says "Closed the day". The Activity tab (BD17) keeps the contract's sentence with the Used today value, only for a holder of `catalog.see_costs`, and a correction's detail ends "Signed with PIN."
3. **A day closed under the old flow** has no Used today. The contract's `figureLine` cannot say "no opening figure", so BD12 sends `"0"` for opening, received and waste with `usedQty: null`; the front end reads `usedQty: null` on a closed day as "no figures". BD9 leaves such days out, BD10 answers 404, BD20 answers 400, and `can.correct` is false.
4. **An open day the old code made is adopted on its first read:** a department with no lines gets them, a row with no id link is linked, and a department marked counted with a blank line goes back to not counted so the head recounts blind.
5. **BD13's `entryCount`** counts the lines the close will post by the §5.8 rule (closing differs from the ledger position), which is the same as "non-zero Used today" unless something else moved the stock.
6. **The head's button** (gap 8): before 12:00 Nairobi it is "Check the opening" only until the opening is checked; after a check, or from 12:00, it is "Count your department".
7. **A department added after the day was made** has no row on that day: its head gets 409 `NO_DEPARTMENTS` until tomorrow (the set is fixed from the first read).
8. **An open discrepancy** is one with status OPEN; a REVERSED one ("held again") is not listed on the delivery tick.
9. **A department with no items** signs nothing; on the day sheet the closer stands in as "counted by" because the sheet's shape needs a person.
10. **Uncategorised items** sort last in the blind count and are grouped as "Other".

## Left for later sessions
The phone and desktop screens; the contract migration (§11) and its guard test; removing the old front-end code that still calls the deleted endpoints (`/branch-day/...`, `GET/PUT /inventory/thresholds`: they now answer 404, which the front-end sessions replace); the Audit log front end's record-link kinds (the log now sends `DAY`); `seed-rehearsal-reference.ts` still writes the branch rows of `counting_thresholds` (harmless until the contract migration drops them); the owner's production counts (§10.4).

## Coupling
`_shared/{central-store-access,reference-counter,wire}`, `stock/ledger/ledger-door` (the optional `reference`), `departments` (Block 1: the rows, `ensureDepartmentLocation` from `deliveries/`), `dispatch` and `discrepancies` (a delivery not confirmed blocks, an open discrepancy never does), `waste_logs` and `waste/_shared/waste-contract` (the Waste column), `counting/_shared/{count-pin,count-people,count-time}`, `audit-log` (the derived source `BRANCH_DAY`). No other sub-module.
