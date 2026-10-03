# suppliers

**Design:** approved (Paper: *Catalog, suppliers and restock levels*; statement and orders tab are in *Purchasing*) · **Code:** rebuilt.

Suppliers, contacts, payment methods, the catalog lines they sell, and their documents.

## Who can do what
- **Store Manager**: add/edit suppliers, contacts, payment methods, catalog lines, documents; put on hold or archive.
- **Accountant**: sees payment details; is told when they change.
- Payment details are visible to Store Manager, Accountant, Directors only. Attendants never see them.

## Approved behaviour
- Add supplier needs only name, type, phone, address and how we pay them (duplicate warning first); the page shows a completeness checklist (Profile 4 of 7).
- Tabs: Overview, Contacts, Payment, Catalog, Documents. Account numbers hidden until Show.
- Payment methods: bank, M-Pesa, Cheque (payable to, bank, note), Cash. A change needs a reason, is logged, tells the Accountant, no PIN.
- Catalog lines: their name and code, their pack, their price; several lines per item allowed. Prices update from signed receipts; a hand-set price is logged. A seeded preferred supplier shows "Preferred · confirm" until confirmed. Add several items at once.
- Documents tab: search, date range, Added by, All/Uploaded/Automatic, type chips with counts, "Showing x of y". Upload by Store Manager and Accountant only.
- Archive is blocked while invoices are unpaid; use Put on hold.
- Strips: active, on hold, profile not finished, owed; and on Catalog tab: items sold, price alerts, last receipt, 90-day spend.

## Built today
Matches the approved design including payment-method history, supplier list summary (profile + owed), and catalog row extras. Supplier AP (invoices/payments against suppliers) is served from [purchasing](../purchasing/README.md).

## Endpoints
35 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/suppliers` | ...READ, STORE_ATTENDANT |
| POST | `/inventory/suppliers/quick` | SM, STORE_ATTENDANT |
| GET | `/inventory/suppliers/summary` | ...READ |
| GET | `/inventory/suppliers/:id` | ...READ |
| POST | `/inventory/suppliers` | SM |
| PATCH | `/inventory/suppliers/:id` | SM |
| PATCH | `/inventory/suppliers/:id/status` | SM |
| DELETE | `/inventory/suppliers/:id` | SM |
| POST | `/inventory/suppliers/:id/restore` | SM |
| GET | `/inventory/suppliers/:id/summary` | ...READ |
| GET | `/inventory/suppliers/:id/contacts` | ...READ |
| POST | `/inventory/suppliers/:id/contacts` | SM |
| PATCH | `/inventory/suppliers/:id/contacts/:cid` | SM |
| DELETE | `/inventory/suppliers/:id/contacts/:cid` | SM |
| GET | `/inventory/suppliers/:id/payment-methods` | ...READ |
| GET | `/inventory/suppliers/:id/payment-methods/history` | ...READ |
| GET | `/inventory/suppliers/:id/payment-methods/:pid` | ...READ |
| POST | `/inventory/suppliers/:id/payment-methods` | SM, ACCOUNTANT |
| PATCH | `/inventory/suppliers/:id/payment-methods/:pid` | SM, ACCOUNTANT |
| DELETE | `/inventory/suppliers/:id/payment-methods/:pid` | SM, ACCOUNTANT |
| GET | `/inventory/suppliers/:id/items` | ...READ |
| POST | `/inventory/suppliers/:id/items` | SM |
| GET | `/inventory/suppliers/:id/catalog-summary` | ...READ |
| GET | `/inventory/suppliers/:id/pack-mismatches` | ...READ |
| PUT | `/inventory/suppliers/:id/items/:itemId` | SM |
| DELETE | `/inventory/suppliers/:id/items/:itemId` | SM |
| GET | `/inventory/suppliers/:id/documents` | ...READ |
| POST | `/inventory/suppliers/:id/documents` | SM, ACCOUNTANT |
| GET | `/inventory/suppliers/:id/documents/:docId/download` | ...READ |
| DELETE | `/inventory/suppliers/:id/documents/:docId` | SM |
| GET | `/inventory/suppliers/:id/recent-items` | STORE_MANAGER |
| POST | `/inventory/supplier-invoices` | STORE_MANAGER |
| POST | `/inventory/supplier-invoices/:id/adjustments` | STORE_MANAGER, ACCOUNTANT |
| POST | `/inventory/supplier-payments` | STORE_MANAGER, ACCOUNTANT |
| POST | `/inventory/supplier-payments/:id/reverse` | STORE_MANAGER, ACCOUNTANT |

## Code map
`supplier-catalog-extras.ts`, `supplier-controller.ts`, `supplier-files.ts`, `supplier-line-key.ts`, `supplier-pay-history.ts`, `supplier-repository.ts`, `supplier-serializers.ts`, `supplier-service.ts`, `supplier-storage.ts`, `supplier-summary.ts`, `supplier-validators.ts`, `supplier.types.ts`. 8 test files beside the code.

## Coupling
Uses `purchasing/receiving-repository` and `catalog/item-history*`. `supplier-line-key` is imported by purchasing; `supplier-repository` and `supplier-serializers` by catalog and purchasing.
