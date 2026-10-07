# prep / runs

**Design:** approved (Paper: *Inventory · Prep*, Runs steps 10-12, Attendant Recent runs) · **Code:** list and detail built (Slice 2); summary, export and the manager screens are Slice 4.

## Who can do what
`prep.read` (Store Attendant, Store Manager, System Admin, Accountant, Director, Branch Manager). Reads use `requireHubReader`.

## Endpoints
| # | Method | Path | Notes |
|---|---|---|---|
| 8 | GET | `/inventory/prep/runs` | filters `search`, `outputItemId`, `personId`, `status`, `needsLook` (honoured only with `prep.read_flags`), `mine`, `from`, `to` (Nairobi days), paging; newest first |
| 9 | GET | `/inventory/prep/runs/summary` | `prep.read_flags` (desktop roles; never the Attendant). `{ runsThisWeek, runsToday, needsLookCount, prepValue7d? }`: RECORDED runs only, Nairobi days, the week starts Monday; `prepValue7d` (sum of total input cost over the last 7 days) only with `prep.see_costs` |
| 10 | GET | `/inventory/prep/runs/:id` | `RunDetail`, blind per role |

Not here: #14-17 live in `../review/` (`/runs/export` is mounted before this router); #11-13 correct and cancel (Slice 3, which also fills `correction` on the detail). `/runs/summary` is registered before `/runs/:id` in `runs-routes.ts`.

## Blind rule (`../_shared/prep-run-serializer.ts`)
Costs need `prep.see_costs`; flags (`needsLook`, review, `flags`, `exceedsStock`) need `prep.read_flags`; `onHand` needs `restock.read`. `can` and `windowEndsAt` are worked out for the caller: own run for 24 hours, or `prep.fix_any`; after the window the Attendant gets `lockedReason: "Ask the Store Manager"`; someone else's run is read-only.

## Code map
`runs-routes/controller/service/validators.ts`; the repository and serializer are in `../_shared/`. Tests: `runs-service.test.ts` (per-role payloads, 24-hour rule, route gates).
