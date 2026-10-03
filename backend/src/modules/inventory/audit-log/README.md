# audit-log

**Design:** approved (Paper: *Catalog, suppliers and restock levels*, chapter 8, step 35) · **Code:** built (Session 7).

One read-only list of what changed in the Catalog, Suppliers and Restock levels, with who, when and why.

## Who can do what
- **Store Manager, Accountant, Director**: read it. Nobody can edit or remove an entry.
- Hub organization only.

## Behaviour
- Merges four sources, newest first: item history, supplier audit rows, supplier creation, restock level changes (Central Store and every branch department).
- Filters: area, who, period; pages of 50.
- Sentences are plain words; no account number can appear (the payment-method sentences only name which field changed).

## Endpoint
| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/audit-log` | SM, ACC, DIR |

Contract: `docs/API_CONTRACT.md` §30.12. Frontend: `frontend/features/inventory/audit-log/`.
