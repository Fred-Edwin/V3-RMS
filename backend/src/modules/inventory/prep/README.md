# prep

**Design:** approved (Paper: *Prep*) · **Code:** built to the old flow (Milestone Three), **pending redo**.

Full approved wording, running example and mistake/fix tables: [DESIGN-NOTES.md](DESIGN-NOTES.md). **Delete that file when the redo merges.**

Prep turns raw ingredients into the portions branches order. Recorded **after the fact**, never planned: output item, inputs actually used, actual yield.

## Who can do what
- **Store Attendant** (phone): record a run; correct or cancel **own** runs for 24 hours; never sees stock, expected stock or costs.
- **Store Manager** (desktop): sees and reviews everything; corrects or cancels any run, any age.
- No PIN or signature; the record shows who and when.

## Approved behaviour
- **Prep again** tiles for the 3 most-made outputs open a run pre-filled as last time; "Something else" picks any prepped item. − / + steppers; live yield check against the usual figure is a nudge, never blocks.
- Confirm sheet; optional reason when yield is off (Trimmed more, Spillage, Burnt, Other).
- Recorded as one atomic entry: inputs down (`PREP_CONSUME`, negative), output up (`PREP_PRODUCE`), output cost = total input cost ÷ yield.
- Flags: yield >15% off usual = warning + manager flag; >35% = also notify. Input exceeding expected stock = silent manager-only flag; the run still saves. Flagged and corrected runs appear in **Needs a look** (Dashboard band, top of Prep, Audit log); **Mark reviewed** is one tap.
- Correct = reverse the old run and post a new linked one (reasons Typo, Wrong item, Wrong quantity, Other). Cancel reasons: Entered twice, Never made, Wrong item, Other; managers get a below-zero stock warning. Old run stays as Corrected/Cancelled. Output cost updates only if it is the latest run of that item. A corrected run counts in typical yield; a cancelled one does not. Cancelling may drive stock negative (allowed, marked).
- After 24 h the attendant sees the run locked: "Ask the Store Manager". Warnings: "Looks like a repeat", yield typo check (380 vs 38).
- Run numbers PREP-nnnn (open question Q5). Typical yield = last 10 runs or 30 days.

## Built today vs approved
When rebuilt, use the shared blind rule (`_shared/blind-rule.ts`) instead of an `isAttendant` check. Since 6 Oct 2026 the Attendant may see item costs; stock and expected stock stay hidden.
**Foundation built (Slice 0 Part 2, 7 Oct 2026, branch `feat/prep-rebuild`):** the frozen contract (`_shared/prep-contract.ts`, mirrored in `frontend/features/inventory/prep/_shared/types/`, API_CONTRACT §33); migration `20261007120000_prep_rebuild` (run status, numbering, reasons, idempotency key, recipe tables, one-main-ingredient index, `typical_yield_at_run_time` dropped); the seven `prep.*` capabilities in `central-store-access.ts`; the ledger door reverses prep rows; the old service posts through the door. The 5 old endpoints below still run (they now write `expected_yield`/`expected_source`) until Slice 2 deletes them. Nothing new is served yet: recipes arrive in Slice 1.

Old design: immutable runs, no numbers, costs on the attendant list, no Needs a look, no Correct/Cancel, no Prep-again tiles. 5 endpoints, `PrepRun`/`PrepRunInputLine` models.

## Endpoints
5 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/prep/runs` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/prep/runs/:id` | STORE_MANAGER, STORE_ATTENDANT |
| POST | `/inventory/prep/runs` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/prep/summary` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/items/:id/typical-yield` | STORE_MANAGER, STORE_ATTENDANT |

## Code map
`prep-controller.ts`, `prep-repository.ts`, `prep-routes.ts`, `prep-service.ts`, `prep-validators.ts`, `prep.types.ts`. 2 test files beside the code.

## Coupling
Uses `catalog/inventory-repository`.
