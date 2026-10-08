# departments

**Design:** approved (Paper: *Inventory · Requisition and dispatch*, step 20; gap fix G4) · **Code:** contract frozen in code, **no service yet** (Block 1, back end A builds it).

Departments as data: a branch's list of departments (Kitchen, Barista, Pastry, Service, Housekeeping, and any the Branch Manager adds), which the requisition reads to make a section per active department.

## Who can do what
- **Branch Manager** (own branch), **System Admin**: add, rename, retire, restore (`departments.write`).
- **Store Manager, Accountant, Director**: read only (`departments.read`), with a branch picker.
- Department Heads and members hold nothing from the table.

## Rules
- A department is a row; `key` is the legacy `DepartmentTag` value for the original five and null for an added one. Renaming or retiring never touches the key.
- Past requisitions keep their sections; a retired department gets no section in new requisitions.
- Dual-write during the expand phase: every write that sets `InventoryItem.departmentTags`, `User.departmentTag` or `Location.departmentTag` also sets the id link. Reads in new code use ids only.
- **Do not add a department in production before Block 2 ships** (the old dispatch screens cannot see an added department). Rename and retire are safe.

## Endpoints (frozen: `_shared/departments-contract.ts`)
Under `/api/v1/inventory/departments`, mounted in `routes/index.ts`; `departments-routes.ts` is a placeholder router today.

| # | Method and path | Capability |
|---|---|---|
| R23 | `GET /inventory/departments?branchId` | `departments.read` |
| R24 | `POST /inventory/departments` | `departments.write` |
| R25 | `PATCH /inventory/departments/:id` | `departments.write` |
| R26 | `POST /inventory/departments/:id/retire` and `/restore` | `departments.write` |

## Contract
`_shared/departments-contract.ts` (Zod), `departments-contract.fixtures.json`, `departments-contract.test.ts`. Front-end mirror: `frontend/features/inventory/departments/types/`.

## Coupling
Reads `Site` (branch code), `User` (the head), `ItemDepartment` (items tagged). Read by `requisitions/` (sections). Catalog's item panel department chips are driven by these rows (small change, owned by back end A).
