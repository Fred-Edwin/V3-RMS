# prep / runs (front end)

**Design:** approved (Paper steps 1, 10, 35, 36) · **Code:** the Runs home is built (Slice 2). The KPI strip, "Needs a look" band and review columns are **Slice 4**; the seam is marked in `manager-runs-home.tsx`.

## What it does
`PrepHomeScreen` (the route `/app/inventory/prep`, a thin shell in `app/`) picks the view from the server's permissions, not a role name:
- holds `prep.record` and not `prep.read_flags` (Store Attendant): `AttendantHome` (Prep again tiles, "+ Something else", Recent runs; phone, tablet and computer layouts);
- anyone else with `prep.read`: `ManagerRunsHome`, a plain runs list with search and "Showing x of y", plus "New prep run" for those with `prep.record`.

`RunTable` (in `_shared/components`) has an Attendant and a manager column set; Unit cost shows only if the server sent it.

## Temporary adapter
The old History page and run-detail drawer still use the old shapes. `../services/prep-api-service.ts` calls the new `GET /runs` and `GET /runs/:id` and maps them back (`../types/prep.ts`). Slice 3 deletes the detail drawer, Slice 4 the History page, `use-prep-summary.ts`, `use-prep-runs-list.ts`, this adapter and the old types.
