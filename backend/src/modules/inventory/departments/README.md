# departments

**Design:** approved (Paper: *Inventory · Requisition and dispatch*, step 20; gap fix G4) · **Code:** built (Block 1, back end A): R23 to R26, the dual-write hooks, and branch provisioning.

Departments as data: a branch's list of departments (Kitchen, Barista, Pastry, Service, Housekeeping, and any the Branch Manager adds), which the requisition reads to make a section per active department.

## Who can do what
- **Branch Manager** (own branch), **System Admin** (any branch): add, rename, retire, restore (`departments.write`). A manager of another branch gets `403 WRONG_BRANCH`.
- **Store Manager, Accountant, Director**: read only (`departments.read`), with a branch picker (the first branch when none is asked for).
- Department Heads and members hold nothing from the table.

## Rules
- A department is a row; `key` is the legacy `DepartmentTag` value for the original five and null for an added one. Renaming or retiring never touches the key. Names are unique per branch, case-insensitive (`409 DEPARTMENT_NAME_TAKEN`). A retired department cannot be renamed; retire twice / restore an active one are refused.
- Past requisitions keep their sections; a retired department gets no section in new requisitions, and a retired department that never sent does not hold a requisition up.
- **Dual-write during the expand phase** (`department-links.ts`): every write that sets `InventoryItem.departmentTags` (catalog repository create/update), `User.departmentTag` (assign/unassign head, staff transfer) or `Location.departmentTag` (the provisioning script) also sets the id link in the same transaction. Item links to *added* departments (key null) are never deleted by a tag change. Reads in new code use ids only.
- **New branches** get a three-letter code and the five original departments when they are created (`branchRepository.create` → `departmentLinks.provisionBranch`); the migration did the same for existing branches. The code is a placeholder the owner corrects; there is no endpoint for that yet.
- **Do not add a department in production before Block 2 ships** (the old dispatch screens cannot see an added department). Rename and retire are safe.

## Endpoints (frozen: `_shared/departments-contract.ts`)
Under `/api/v1/inventory/departments`, mounted in `routes/index.ts`.

| # | Method and path | Capability |
|---|---|---|
| R23 | `GET /` (`?branchId`) | `departments.read` |
| R24 | `POST /` | `departments.write` |
| R25 | `PATCH /:id` | `departments.write` |
| R26 | `POST /:id/retire` and `/restore` | `departments.write` |

## Not done here
The catalog item panel's department chips are still driven by the enum values on the wire (`departmentTags`); the catalog only gained the dual-write hook. Driving the chips from Department rows (per-branch added departments) needs a contract decision: an item is company-wide, a department is per branch.

## Code map
`departments-routes.ts`, `-controller.ts`, `-service.ts`, `-repository.ts`, `-validators.ts`, `departments.types.ts`, `department-links.ts` (the dual-write and provisioning helpers), `_shared/departments-contract.ts` (+ fixtures and test). Tests: service, links, routes grid (in `requisitions/requisitions-routes.test.ts`), and the opt-in database test in `requisitions/requisitions.db.test.ts`.

## Coupling
Reads `Site` (branch code), `User` (the head), `ItemDepartment` (items tagged). Read by `requisitions/` (sections). Called by `catalog/inventory-repository`, `repositories/department-repository`, `staff-transfer-repository`, `branch-repository`.
