# restock

**Design:** approved · **Code:** rebuilt; most logic currently lives in `../catalog/inventory-*` files.

Restock levels decide **OK / Low / Out** for every stock-holding location and drive purchasing suggestions and requisition suggestions.

## Who can do what
- **Store Manager**: all Central Store levels, and every department's via the *Whose levels* switch (Central Store, Kitchen, Pastry, Barista, Service, Housekeeping).
- **Department Head**: own department's levels, any time (no time window), with big −/+ steppers on the phone.
- Attendants see Low/Out only, never numbers.

## Approved behaviour
- One page: on hand, status, level, suggestion. Edit in rows, then **Review changes** (says which items will turn Low).
- Suggestion = average daily use over recent days × days of cover; new items show "Needs 14 days of use first".
- Every change is logged with a history per item and **Put back** in one tap.
- Strip: out, low, no level set, suggestions differ.

## Built today
`restock-suggestion.ts` here; endpoints, service and repository are in `../catalog`.

## Endpoints
6 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/restock-levels/branches` | STORE_MANAGER |
| GET | `/inventory/restock-levels/summary` | STORE_MANAGER |
| GET | `/inventory/restock-levels` | STORE_MANAGER |
| PUT | `/inventory/restock-levels` | STORE_MANAGER |
| GET | `/inventory/restock-levels/history` | STORE_MANAGER |
| POST | `/inventory/restock-levels/changes/:id/put-back` | STORE_MANAGER |

## Code map
`restock-suggestion.ts`. 2 test files beside the code.

## Coupling
Logic is in `catalog/inventory-service|repository`; `restock-suggestion` is imported by `catalog/inventory-repository`. Move the restock endpoints here when the next restock change is made.

## Open questions
See decisions.md Q1.

## Session 7 additions
- The Department Head's phone screen (Paper chapter 7) is rebuilt in place: big −/+ steppers, the suggestion under each item, a review sheet, a saved state with "Your recent changes" and Put back. It reuses the same endpoints as the Store Manager's page (`PUT /inventory/restock-levels`, `GET …/history`, put-back). The Housekeeping head uses the same screens.
