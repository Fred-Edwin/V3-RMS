# counting / setup

**Design:** approved (Paper: *Inventory · Counting redesign (Oct 7)*, steps 24 Count setup, 24B and 24C Add items, 40 and 41 the Attendant's reorder and move, 50 and 51) · **Code:** built.

## What it does
The Manager's shelf order: which sections there are, which items are in each, and in what order. A section is a **supplier section** (name and supplier fixed, made by the migration, one per supplier with items) or a **manual section** ("Others", "Packaging", anything added). An item is in **at most one** section (`UNIQUE (organization_id, inventory_item_id)`); items in none show as **Not in any section** and are never counted until placed. "Last counted" is derived, never stored.

Moves are logged (`count_item_moves`), by the Manager's layout save and add-items, and by the Attendant's own move (C21). The Manager sees "1 item moved by the Attendant since your last visit" (`count_setup_visits`, stamped on each C15) and can **undo**. An item inside an OPEN count keeps its line in that count: a count's lines are copies made at the start.

## Who can do what
| Who | Can |
|---|---|
| Store Manager, System Admin | everything: read, add a section, save the order, add items, move, undo (`counts.setup`; move is `counts.record`) |
| Store Attendant | **move an item** (C21, `counts.record`) and nothing else here (403 on every other route) |
| Director, Accountant, Branch Manager | read the page and a section's items (`counts.read`) |

Reads use `requireHubReader`, writes `requireHubActor`. No `requireRole`.

## Endpoints (base `/api/v1/inventory/stock`)
| # | Method | Path | Cap | Notes |
|---|---|---|---|---|
| C15 | GET | `/count-setup` | `counts.read` | the page. Runs `adoptNewItems` first and stamps this person's visit AFTER reading |
| C16 | GET | `/count-setup/sections/:id/items` | `counts.read` | one section on one list, no pager; `unsectioned` is a valid id |
| C17 | POST | `/count-setup/sections` | `counts.setup` | `{ name }`; 409 `SECTION_NAME_TAKEN` (case-insensitive); added last, manual |
| C18 | PUT | `/count-setup/layout` | `counts.setup` | "Save order": one transaction under a per-site advisory lock; 409 `LAYOUT_CHANGED` when `version` is stale |
| C19 | GET | `/count-setup/add-items` | `counts.setup` | search as you type (a search looks at every section), filters, tabs, numbered pager; items already in the section never listed |
| C20 | POST | `/count-setup/sections/:id/items` | `counts.setup` | adds at the end; an item in another section moves (logged) |
| C21 | POST | `/count-setup/items/:itemId/move` | `counts.record` | applies at once, logged; returns the move |
| C22 | POST | `/count-setup/moves/:id/undo` | `counts.setup` | 409 `MOVE_ALREADY_UNDONE`; 409 `LAYOUT_CHANGED` when the item moved again since |

## Rules worth knowing
- **Version** (`setup-version.ts`): a hash of what the layout IS (sections, names, order, placements, the unsectioned set), so any change by anyone changes it. C18 sends it back; a stale one is `LAYOUT_CHANGED`.
- **Layout save**: lists every section exactly once (`unsectioned` optional and only items already unsectioned); items left out of the payload keep their section after the listed ones; an item that changes section (or is placed from "Not in any section") is logged as the caller's move; an item cannot be pushed out into "Not in any section".
- **`adoptNewItems(siteId)`** (`../_shared/count-sections.ts`): a new item whose preferred supplier already has a supplier section is placed at the end of that section, in one idempotent `INSERT … ON CONFLICT DO NOTHING`. Run by C15, C8 and C9. Nothing in the catalog is edited. An item with no supplier waits in "Not in any section".
- **Undo** puts the item at the END of the section it came from (or back into "Not in any section"); it never rewinds an item that has moved again.
- A **stale** item (drawn amber) is one last counted five or more whole Nairobi days ago; one never counted says "Never counted".

## Code map
`setup-routes/controller/service/repository/validators.ts`, `setup.types.ts`, `setup-view.ts` (the page and move views, words), `setup-version.ts`. The shared section reads and `adoptNewItems` are in `../_shared/count-sections*.ts` because the count flow reads sections too.

## Tests
`setup-service.test.ts` (every rule, mocked repository), `setup-routes.test.ts` (the §3.1 grid for six roles on every endpoint, validation, no token), `setup-version.test.ts`, `setup.db.test.ts` (opt-in `RUN_DB_TESTS=1`, all inside rolled-back transactions: the seeded sections, adopt, the one-section key, move and undo, retired items, layout rewrite, the add-items search).

## Coupling
`../_shared/` (count-sections, count-sections-repository, count-reads-repository for "last counted", count-errors, count-people, count-time, counting-contract), `../../_shared/central-store-access`. Nothing from the kept `counting/thresholds-*` files.
