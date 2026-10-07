# audit-log

**Design:** approved (Paper: *Catalog, suppliers and restock levels*, chapter 8, step 35) · **Code:** built (Session 7).

One read-only list of what changed in the Catalog, Suppliers, Restock levels, Purchasing and Payments, with who, when and why.

## Who can do what
- **Store Manager, Accountant, Director**: read it. Nobody can edit or remove an entry.
- Hub organization only.

## Behaviour
- Merges five sources, newest first: item history, supplier audit rows, supplier creation, restock level changes (Central Store and every branch department), and `purchasing_audit` (areas `PURCHASING` and `PAYMENTS`, written by the purchase file in the same transaction as each action).
- A Purchasing or Payments entry also carries `purchasing: { action, document, detail, orderId, orderReference, supplierName }` and the actor's `role`; the front end's `AuditRow` is built from these.
- Also derives `PREP` entries ("Recipe set", "Recipe changed" with the reason) from the Usual recipe version rows; no event table.
- Filters: area (`CATALOG`, `SUPPLIERS`, `RESTOCK_LEVELS`, `PURCHASING`, `PAYMENTS`, `PREP`), who, period; pages of 50.
- Sentences are plain words; no account number can appear (the payment-method sentences only name which field changed).

## Endpoint
| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/audit-log` | SM, ACC, DIR |

Contract: `docs/API_CONTRACT.md` §30.12. Frontend: `frontend/features/inventory/audit-log/`.
