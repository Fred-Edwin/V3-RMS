# Prep · Fix a slip (`fix/`)

Correct or cancel a recorded prep run. Spec: `docs/API_CONTRACT.md` §33.3 (#11–13), §33.5; plan `docs/features/inventory/prep-plan.md` §3.5.

**Status:** built (Slice 3). Tests: `fix-service.test.ts` (mocked), `fix-service.db.test.ts` (opt-in, `RUN_DB_TESTS=1`, run it on its own, not beside the other db tests: they share the PREP counter).

## Endpoints

| # | Route | Capability | Notes |
|---|---|---|---|
| 11 | `POST /inventory/prep/runs/:id/correct` | `prep.record` | 201 new run, 200 when the idempotency key was already used |
| 12 | `POST /inventory/prep/runs/:id/cancel` | `prep.record` | a repeat is 409 `RUN_NOT_OPEN` |
| 13 | `GET /inventory/prep/runs/:id/cancel-preview` | `restock.read` | on-hand now and after, `belowZero` per item |

## Rules

- **Window rule** (service, `assertCanFix`): without `prep.fix_any` the caller must be the run's creator and within `FIX_WINDOW_HOURS` (24), else 403 `PREP_RUN_LOCKED` "Ask the Store Manager". Store Manager and System Admin hold `prep.fix_any`.
- **One transaction, row lock first.** `lockForFix` takes `SELECT … FOR UPDATE` on the run. A second fixer waits, then finds the run closed: 409 `RUN_NOT_OPEN` (or, with the same key, the replayed run).
- **Reversing rows** for every standing ledger row of the old run (`findReversibleRows`): same type, opposite sign, `reversesTransactionId` = the original, linked to the old run, through `postStockMovement`. Nothing is deleted or edited.
- **Correct:** old run → `CORRECTED` (`closedAt/By`); the new run is `RECORDED`, gets a fresh `PREP-nnnn`, `replacesRunId`, `correctionReason`, and is judged (record's `assess`) against the current expected figure with the old run out of the past-runs set and its stock back. Unit costs: the old snapshot for items the old run used, the current cost for added items. **Output cost** moves only when the fixed run was the latest `RECORDED` run of that output.
- **Cancel:** same reversals, status `CANCELLED`, `cancelReason`, `reasonNote`; stock may go below zero; output cost unchanged (Q-2).
- **Needs a look:** a correction is flagged when the corrector cannot review (`prep.review`), or its own yield or stock check is off. A closed run (corrected or cancelled) is taken out of Needs a look (`needsLook = false`): it is superseded, and the manager reviews the replacement. A cancel is never queued (Mark reviewed refuses a cancelled run, #16).
- **`reasonNote`** is one column: on a correction or a cancel it is that reason's note, so the run detail returns it as `correction.note` / `cancellation.note` and `yieldReasonNote` is null there.

## Files

`fix-{routes,controller,service,repository,validators}.ts`, `fix.types.ts`. The shared write functions (`lockForFix`, `findReversibleRows`, `latestRecordedRunId`, `closeRun`, `createReplacement`) are in `_shared/prep-run-repository.ts`; `_shared/prep-run-serializer.ts` fills `correction`, `timeline` and the can-fix fields. `record/record-service.ts` exports `assess`, `loadItems`, `toInputs`, `yieldLabel` for reuse.

## Coupling

Reads `record/` (judging), `stock/ledger` (the door), `_shared/central-store-access.ts` (capabilities). The run drawer (Slice 4) mounts the front-end components.
