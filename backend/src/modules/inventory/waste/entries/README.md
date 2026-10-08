# waste/entries

**Design:** approved (Paper steps 19 and 21) · **Code:** built to the contract (Back end B).

The waste list with its KPI strip (W3).

## Spec
- **W3 `GET /inventory/stock/waste`** (`waste.read`), query `period=today|7d|reversed`, `scope=all|mine`, `search`, `page`, `pageSize` (25, 50 or 100; default 50). Newest first (a `reversed` period: newest reversal first). **Lane 0 additions (8 Oct 2026, all optional):** `from` and `to` (Nairobi days, both included, either alone; they replace `period` as the window on when the entry was logged), `reason`, `loggedBy` (a person's id; the Attendant stays on their own), `status=logged|reversed`. The page and not the chip counts or KPI strip follows these. The response adds `people` (who has logged waste, for "Logged by"; absent for the Attendant). A `from` after `to` is a 400.
- Periods are Nairobi days: `today` from 00:00 today, `7d` from 00:00 six days ago (today included), `reversed` = reversed since then, whenever logged.
- **Own entries only** for a caller without `stock.read` (the Attendant holds `waste.read` but none of the desktop reads), whatever `scope` says: a capability test (`seesOwnEntriesOnly`), never a role name. Everyone else may narrow with `scope=mine`.
- **KPI cells** (callers who may see store-wide money; not the Attendant): `today` (KES, entries), `last7`, `most` (the item with the most value in 7 days and its commonest reason, "mostly expired"), `reversed` ("Both by the Attendant, same day", built from the reversals). A reversed entry's value counts for nothing everywhere. KPIs follow the scope but not the search.
- `chips` = entries logged today, entries in the last 7 days, entries reversed in the last 7 days, over the same scope **and search** as the rows.
- `bannerText` for the own-entries-only reader: "2 items logged at 14:20. You can reverse your own entries today." from their latest batch today; `null` when nothing was logged today; absent for everyone else.
- Search matches item name and who logged it. Every row goes through `waste/_shared/waste-view.ts` (`valueKes` with `catalog.see_costs`, `can.reverse` from the one reverse rule).

## Status
Built and tested (service, KPI builder, the role grid, query validation). Real-API walk: see `waste/README.md`.

## Endpoints
| # | Method and path | Capability |
|---|---|---|
| W3 | `GET /inventory/stock/waste` | `waste.read` (Attendant: own only) |

## Coupling
`waste/_shared/{waste-view,waste-rules,waste-row}`, `stock/_shared/{nairobi-time,person}`, `_shared/central-store-access`, `_shared/blind-rule`.
