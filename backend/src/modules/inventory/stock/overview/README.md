# stock/overview

**Design:** approved (Paper step 42) · **Code:** built to the contract (Back end B).

The Overview hub (S1).

## Spec
- **S1 `GET /inventory/stock/overview`** (`stock.read`, no query).
- `kpis`: Items tracked, Low or out, Negative stock (the same cells as All items) and Counts today ("2 signed · 1 in progress", "None yet").
- `todaysCounts` from Counting's `todaysCounts`: OPEN is `IN_PROGRESS` ("Isabel · started 11:02"), SUBMITTED is `TO_REVIEW`, APPROVED is `SIGNED` (a Manager's own count and an approved Attendant count alike), with "07:02 to 07:41".
- `longestWithoutCount`: the 3 sections or items longest without a count ("Section · 36 items", "Item · Others", "12 days ago", "Never counted").
- `can.startCount` = holds `counts.record` and is not blind to stock figures (a capability test, never a role name).

## Status
Built and tested: service (mocked repository and count-reads), the six-role grid.

## Endpoints
| # | Method and path | Capability |
|---|---|---|
| S1 | `GET /inventory/stock/overview` | `stock.read` |

## Coupling
`counting/_shared/count-reads` (`todaysCounts`, `longestWithoutCount`, `sectionNamesByItem`) only; `stock/_shared/{stock-repository,stock-kpis,stock-sections}`.
