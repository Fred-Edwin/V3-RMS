# catalog

**Design:** approved (Paper: *Catalog, suppliers and restock levels*) · **Code:** rebuilt, do not rework without a new design.

Items and categories: what the Central Store counts and issues, under our own name, held in the usage unit.

## Who can do what
- **Store Manager**: add, edit, retire, restore items and categories; review a change to pack/unit/type (summary + reason).
- **Store Attendant**: find an item; add a missing item directly (Stocked or Raw ingredient only, no prices). It lands under **Needs setup**.
- **Department Head**: reads items for their department.
- Attendants see item costs and prices but never stock figures (restock level, days of cover, on hand). The catalog service uses the shared blind rule (`_shared/blind-rule.ts`). Item history needs `catalog.read_history`.

## Approved behaviour
- One drawer to add an item: name, type (Stocked / Raw ingredient / Prepped, each with a one-line explainer), how it is bought ("1 bag = 50 kg, used in kg"), category, used-by departments (incl. Housekeeping), restock level. Prepped hides buying fields; Raw ingredient hides Used by. A similar-name warning shows before saving.
- Who sells it is added afterwards from the item or the supplier page.
- Edit shows a **Review change** step for pack/unit/type/retire. Every change is logged with who, when, why.
- Item page: pack, used by, restock level, sellers with prices, change history.
- Duplicates: retire and note the replacement; open orders keep their lines; restore any time.
- Catalog search also matches supplier names and codes and says why a row matched.
- Strip: items tracked, needs setup, low or out, added this week (one-tap filters, assumption).

## Built today
Matches the approved design for items/categories. `Category.parentCategoryId` (one level) exists for requisition grouping. This folder's `inventory-*` files also hold **restock-level** logic (see [restock](../restock/README.md)); split at the next catalog/restock change.

## Endpoints
14 endpoints (generated from the route files; re-run if routes change).

| Method | Path | Roles |
|---|---|---|
| GET | `/inventory/central-store-location` | STORE_MANAGER |
| GET | `/inventory/categories` | STORE_MANAGER, STORE_ATTENDANT |
| POST | `/inventory/categories` | STORE_MANAGER |
| PATCH | `/inventory/categories/:id` | STORE_MANAGER |
| DELETE | `/inventory/categories/:id` | STORE_MANAGER |
| POST | `/inventory/categories/:id/restore` | STORE_MANAGER |
| GET | `/inventory/items` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/items/:id` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/items/:id/change-review` | STORE_MANAGER |
| POST | `/inventory/items` | STORE_MANAGER, STORE_ATTENDANT |
| GET | `/inventory/items/:id/history` | STORE_MANAGER |
| PATCH | `/inventory/items/:id` | STORE_MANAGER |
| DELETE | `/inventory/items/:id` | STORE_MANAGER |
| POST | `/inventory/items/:id/restore` | STORE_MANAGER |

## Code map
`inventory-controller.ts`, `inventory-repository.ts`, `inventory-routes.ts`, `inventory-service.ts`, `inventory-validators.ts`, `inventory.types.ts`, `item-history-repository.ts`, `item-history.ts`. 3 test files beside the code.

## Coupling
`inventory-repository` is imported by dispatch, prep, purchasing, requisitions, stock, waste; `item-history` by suppliers. Catalog itself imports `suppliers/supplier-repository` and `supplier-serializers`.

## Session 7 additions
- Retire is a dialog (Paper step 31): what it touches, a required reason (Added twice, No longer sold, Other), and an optional replacement. The reason and replacement go into one sentence on the history row (`DELETE …?reason=`); no schema change. A retired item's page shows who retired it, when and why, with Restore item.
- The attendant's "Not found? Add it now" (Paper chapter 6) lives in `frontend/features/inventory/catalog/components/phone/`; it posts the attendant's short form to `POST /inventory/items` (§29.4) from the mobile receipt screen.
