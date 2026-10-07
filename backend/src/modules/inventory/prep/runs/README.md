# prep / runs

**Design:** approved (Paper: *Inventory · Prep*, Runs steps 10-12, Attendant Recent runs) · **Code:** list and detail built (Slice 2); summary, export and the manager screens are Slice 4.

## Who can do what
`prep.read` (Store Attendant, Store Manager, System Admin, Accountant, Director, Branch Manager). Reads use `requireHubReader`.

## Endpoints
| # | Method | Path | Notes |
|---|---|---|---|
| 8 | GET | `/inventory/prep/runs` | filters `search`, `outputItemId`, `personId`, `status`, `needsLook` (honoured only with `prep.read_flags`), `mine`, `from`, `to` (Nairobi days), paging; newest first |
| 10 | GET | `/inventory/prep/runs/:id` | `RunDetail`, blind per role |

Not here: #9 `GET /runs/summary`, #14-17 (Slice 4); #11-13 correct and cancel (Slice 3, which also fills `correction` on the detail). Slice 4 must register `/runs/summary` and `/runs/export` before `/runs/:id`.

## Blind rule (`../_shared/prep-run-serializer.ts`)
Costs need `prep.see_costs`; flags (`needsLook`, review, `flags`, `exceedsStock`) need `prep.read_flags`; `onHand` needs `restock.read`. `can` and `windowEndsAt` are worked out for the caller: own run for 24 hours, or `prep.fix_any`; after the window the Attendant gets `lockedReason: "Ask the Store Manager"`; someone else's run is read-only.

## Code map
`runs-routes/controller/service/validators.ts`; the repository and serializer are in `../_shared/`. Tests: `runs-service.test.ts` (per-role payloads, 24-hour rule, route gates).
