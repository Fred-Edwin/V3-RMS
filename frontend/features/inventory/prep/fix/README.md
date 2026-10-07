# Prep · Fix a slip (front end)

Correct or cancel a recorded run. Back end: `backend/src/modules/inventory/prep/fix/README.md`. Spec: `docs/API_CONTRACT.md` §33.3 #11–13. Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Inventory · Prep".

**Status:** built (Slice 3). Tests: `lib/fix-logic.test.ts`, `components/fix-states.test.ts` (each state: open, locked, not yours, corrected, cancelled, form, check sheet, cancel with and without stock, below zero, compare with and without costs).

## Components (plain props, for Slice 4's run drawer)

| Export | Props | Paper |
|---|---|---|
| `CorrectedCompare` | `{ run: RunDetail }` | step 17 `87X-0` |
| `CancelRunDialog` | `{ run, open, onClose, onDone(cancelled), onLocked? }` | step 18 `8FT-0` (manager), step 16 `85D-0` (phone) |
| `CorrectRunForm` | `{ run, onDone(newRun), onLocked?, onDirtyChange? }` (mount with `key={run.id}`) | steps 14 `7ZQ-0`, 15 `825-0` |
| `FixRunScreen` | `{ run, onDone, onClose, step?, onStepChange? }` | steps 13 `7Y7-0`, 22 `8YL-0` and the above |
| `FixRunRoute` | `{ runId }` | route `/app/inventory/prep/runs/[id]/fix?step=correct` |

`CancelRunDialog` shows the stock table and the below-zero warning only to a caller holding `restock.read` (it calls #13); the Attendant's sheet has no stock figures and makes no preview call. Costs in `CorrectedCompare` appear only when the server sent them.

## Parity manifest

Paper draws the Attendant flow at 390 only and the manager screens at 1440. Tablet and computer are the phone layout reflowed (no Paper artboard): "needs owner decision" below. Measured with `getComputedStyle` against `get_jsx` values at the true layout width.

| Paper node | Reached at | Verdict |
|---|---|---|
| 13 `7Y7-0` run detail, open | `/prep/runs/<own open run>/fix` at 390 (Attendant) | matches (header 22/28 title, 13/18 subtitle, info note 13/18, table rows 12/14 padding, buttons 52 and 48 tall) |
| 14 `7ZQ-0` correct form | `?step=correct` at 390 | matches after fix: stepper number Geist 600 18px (20px for made), unit mono 12px, cells 44 and 84 wide (made 48 tall, 116 wide), "Was 10 kg" amber, chips 14px with 11/14 padding |
| 15 `825-0` check the correction | Review the correction | matches (rows, reason row, blue manager note, Back 110 wide and Save) |
| 16 `85D-0` cancel sheet | Cancel this run | matches; "Cancel run" disabled until a reason is chosen, with a hint |
| 22 `8YL-0` locked | a run over 24 h old | matches (amber note, both buttons really disabled, "Ask the Store Manager") |
| 18 `8FT-0` cancel dialog | manager, 1440, run whose output was used | matches, 540 wide; Paper also draws a "Looks like a duplicate" note that the contract has no data for: not built (needs owner decision) |
| 17 `87X-0` corrected compare | component only; Slice 4's drawer mounts it | covered by tests; not seen in a browser here |
| Not in Paper | tablet 820 and computer 1440 for the Attendant; "not yours" note; corrected and cancelled detail notes; discard-changes dialog; loading and error frames | built from existing tokens, **needs owner decision** |

Known deliberate difference: chips are at least 44px tall (Paper 42) for a thumb.

`_shared/components/prep-stepper.tsx` gained an opt-in `numeral="sans"` (Paper step 14 draws a sans number; the record form's step 39 is mono and unchanged).
