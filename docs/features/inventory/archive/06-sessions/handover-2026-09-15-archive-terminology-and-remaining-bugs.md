# Handover — Archive terminology rename + remaining functional bugs

Paste everything below the line to the agent running this session.

---

You are continuing the Inventory Milestone One (Catalog, Suppliers & Restock
Levels) bug-fix work. The owner has been driving two prior sessions today
(2026-09-15) — a UI refinement pass, then a functional bug-fix pass — both
logged in `docs/features/inventory/04-components.md`'s Status section under
dated entries. **Read those two entries before touching anything** — they
document what was already fixed today (pagination, `includeRetired`
backend bug, toolbar-disappearing-on-empty-results, the retire/confirm
pipeline for items/categories/suppliers, category-refresh-without-reload,
field-level save error messages, the type-to-create combobox, department
multi-select, and more) so you don't re-investigate or redo work.

This handover covers what the owner found **after** that second session,
verified against real code and a live browser. Most have a confirmed root
cause and are ready to fix; one (terminology) is a decision already made
and ready to execute; one ("Show retired" still not working) did not
reproduce on a fresh test and needs the owner's exact repro steps before
you chase it further; one (Delete vs. Archive) is already answered.

## Environment

Both dev servers were left running at the end of the prior session:

```bash
# Backend (from backend/) — if not already running
docker compose up -d postgres redis   # if not already up
npx tsx watch src/server.ts

# Frontend (from frontend/) — if not already running
npx next dev -p 3000
```

Login: `store.manager@wendo.test` / `password123` (Store Manager, hub org).

**If either dev server shows stale-chunk 404s or won't reflect a change**,
`rm -rf .next` (frontend) or kill/restart `tsx watch` (backend) — this cost
real time in every session today, always from a production `pnpm build` or
a long-running process not picking up a file change. Don't assume a fix
isn't working before ruling this out.

Real seed data exists (~31 live items, several already-retired test rows
from today's QA, 2 suppliers, 5 categories). Postgres MCP is available for
direct queries (`inventory_items`, `restock_levels`, `categories`,
`suppliers` tables) — use it to verify state directly rather than trusting
only what the UI shows.

---

## 1. Terminology: "Retire" → "Archive" / "Unarchive" — full sweep, decided

The owner does not want "Retire" used anywhere in this feature. Decision
already made after discussion (not to be re-litigated): **use "Archive" /
"Unarchive"**, not "Delete" — nothing in this feature is ever hard-deleted
(`deletedAt` soft-delete, full history kept, fully restorable), so "Delete"
would misleadingly imply data loss. "Archive" is the standard term for
exactly this pattern (Gmail, Slack, Notion: hidden from default view, fully
recoverable).

**This is a full sweep, not just the dialogs added in the prior session.**
"Retire"/"Retired"/"Restore" appears throughout the whole feature — Paper's
own screens already use this language, so you're changing product copy that
predates today's sessions too, not just new UI. Known locations (grep for
`retire|Retire|Retired` case-insensitively across `frontend/features/inventory/`
to find any this list misses):

- **Confirm dialogs** (built in the prior session): `item-form-screen.tsx`
  ("Retire this item?" / "Retire this item" link / retire error messages),
  `category-manager-screen.tsx` ("Retire this category?"),
  `supplier-form-screen.tsx` ("Retire this supplier?" / the blocked-dialog
  copy "Can't retire this supplier yet").
- **Category Manager List** (`category-manager-list.tsx`): the "Retire"
  button next to "Rename" (added prior session), and the pre-existing
  "Restore" link for already-retired rows (Paper-sourced,
  `SRG-0`/`TX2-0`).
- **Item Catalog Table** (`item-catalog-table.tsx`): retired rows render
  `"Retired {date} · history kept"` in the Department Scope column
  (`formatDepartmentScope` in `item-catalog-screen.tsx` actually owns this
  string — check there too), and the "Show retired" toolbar toggle
  (`ItemCatalogToolbar`'s `showRetired`/`onShowRetiredChange` props — the
  prop names themselves can stay `retired`-named internally if you want to
  avoid a bigger refactor, just the **user-visible label** needs to change;
  use your judgment on whether renaming the props too is worth the churn).
- **Item Catalog screen description**: `"Every item Wendo tracks — raw
  ingredients, prepped items, stocked items. Retiring keeps history;
  nothing is hard-deleted."` (`item-catalog-screen.tsx`).
- **Restock Levels helper note / any other inventory screen** that
  mentions retiring — grep to be sure you catch every instance, including
  `suppliers-screen.tsx`'s retired-row dimming if it has adjacent copy.
- **Backend**: do **not** rename `deletedAt`, `retireCategory`,
  `retireItem`, `retireSupplier`, `RestockLevelsActor`, or any DB
  column/API function name — those are internal/contract-level and out of
  scope (renaming them would be an actual contract change requiring the
  amendment process `inventory-validators.ts`'s header describes — this
  session is a **display-copy** rename only, not a backend rename). Only
  change what a user actually reads: button labels, dialog titles/body
  copy, table cell text, toggle labels, toast/error messages.

**Verify Paper too** (not just code) — `docs/features/inventory/03-design.md`
and the Paper file itself may need a note added (not necessarily changed in
Paper — check with the owner whether Paper's actual artboards should be
updated to match, or whether this is treated as a deliberate code-side
deviation like others already logged in `04-components.md`). At minimum,
log the decision and scope in `04-components.md`'s Status section the same
way prior sessions have, once done.

---

## 2. Desktop sidebar navigation is broken — confirmed, real bug, root cause found

**Clicking any sidebar link other than the current page does nothing** on
desktop (e.g. "Suppliers" while on the Catalog page). Confirmed live: URL
never changes.

**Root cause, precisely located:** `components/app/shell/sidebar-nav.tsx`'s
`DesktopNavItem` always calls `e.preventDefault()` on click whenever the
parent `SidebarNav` was given an `onNavigate` prop at all — regardless of
whether that prop actually does anything:

```tsx
onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate(item); } : undefined}
```

`features/inventory/components/inventory-shell.tsx`'s `InventoryDesktopShell`
**always** passes a non-null `onNavigate` to `SidebarNav`:

```tsx
onNavigate={(item) => onNavigate?.(item.href)}
```

But neither `item-catalog-screen.tsx` nor `suppliers-screen.tsx` (the two
screens that render `InventoryDesktopShell`) ever pass their own
`onNavigate` prop down to it — so the inner `onNavigate?.(item.href)` is
always a no-op. Net effect: every sidebar click prevents the native `<a
href>` navigation and then calls a function that does nothing.

**Fix options** (pick whichever is more consistent with the rest of the
codebase's patterns — check how the legacy `components/ui/SidebarNav.tsx`
or `DirectorSidebarNav.tsx` handle real navigation, since sidebar links
across other already-shipped features presumably work):
- Simplest: don't call `e.preventDefault()` when the resolved handler is a
  no-op — i.e. only intercept when there's a real navigation function to
  call. Or:
- Have `InventoryDesktopShell` not pass a synthetic `onNavigate` at all
  when it wasn't given a real one — let the `<a href>` navigate natively
  (this is probably correct regardless, since these are real routes, not
  client-side-only state — a normal Next.js `<Link>`/anchor navigation is
  simpler than intercepting at all unless there's a reason to intercept,
  e.g. preventing a full page reload).

**Check the mobile nav drawer too** (`InventoryMobileNavDrawer` in the same
file) — it may have the same `onNavigate` pass-through issue; verify links
inside it actually navigate before assuming it's fine because it was built
this same day.

Verify the fix by clicking every sidebar link from both the Catalog and
Suppliers screens and confirming the URL actually changes and the correct
page renders — not just that a console log fires.

---

## 3. "Show retired" — did not reproduce; needs the owner's exact steps

The owner reports clicking "Show retired" does nothing (again, after the
`includeRetired` backend bug was fixed in the prior session). **Tested live
this session and it worked correctly**: toggling it flipped the toolbar
into a visually active state and the "Items" badge count changed
(32 → 35, matching 3 actually-retired rows in the seed data at the time).

Do not assume this is fixed and skip it — the owner is still seeing a
problem. Possible explanations to check, in order:
1. **Stale browser tab** — the owner may be testing in a tab that predates
   the prior session's dev-server restart (the `includeRetired` fix
   required a full `tsx watch` restart to take effect, confirmed in the
   prior session's own log — a tab that made its request before that
   restart, or that has cached the old JS bundle, would still show the
   old broken behavior). Ask the owner to hard-refresh (or close and
   reopen the tab) and retry before assuming there's still a bug.
2. **A specific sequence** — e.g. toggling it a second time, or combining
   it with another active filter, might reveal a real remaining bug the
   simple toggle-from-clean-state test in the prior session didn't
   exercise. Ask for the exact steps if a hard refresh doesn't resolve it.
3. If it's confirmed still broken after a hard refresh, re-verify the
   network request itself (`includeRetired=true` in the query string,
   response `data` array actually containing rows with non-null
   `retiredAt`) before assuming the bug is in the UI layer at all — the
   prior session found the real bug was backend-side, not obvious from the
   frontend code alone.

---

## 4. Restock Levels drawer's "+ Add an item" button does nothing — confirmed bug, but check the premise first

Confirmed live: the dashed "+ Add an item" row at the bottom of the Restock
Levels grid is purely decorative — clicking it does nothing.

**Root cause:** `features/inventory/components/restock-level-grid.tsx`'s
`RestockLevelGrid` accepts an `onAddItem?: () => void` prop and wires it to
the button's `onClick` — but `features/inventory/components/screens/
restock-levels-screen.tsx` (the only consumer) never passes `onAddItem` at
all.

**Before wiring it up, question the premise with the owner:** the Restock
Levels drawer already lists **every** non-retired Central Store item (31 of
31 confirmed live, matching the catalog's own count) — every item already
has a row, editable restock level included. There is nothing left to "add"
in the sense of "pick a new item from a list," since every item is already
present. This button may be leftover UI from an earlier design iteration
that assumed a shorter, curated subset of items with an explicit opt-in —
not the current "show everything" design. Recommend flagging this to the
owner as a design question (remove the button entirely vs. it meaning
something else, like a shortcut to `New item` for an item that doesn't
exist in the catalog yet) rather than wiring a "select from a list that's
already fully shown" flow that wouldn't make sense.

---

## 5. Restock level and preferred supplier — save works, but re-opening the item to edit it shows them blank. Root cause found.

Initial test (create a new item, fill supplier + restock level, submit)
looked clean: the `POST /inventory/items` request carried both fields
correctly, the 201 response echoed the supplier back, and a direct
Postgres query confirmed `restock_levels.level` was persisted. **But the
owner's actual repro was different and more precise: after creating the
item, click on it in the table to re-open it for editing — the restock
level field shows blank**, even though the value is genuinely in the
database. Confirmed once given this exact sequence — this is a real read
bug, not a save bug.

**Root cause, precisely located:**
`item-form-screen.tsx`'s `useEffect` that populates form `values` when an
existing `item` loads for editing hardcodes the restock level to empty
unconditionally:

```tsx
React.useEffect(() => {
  if (!open) return;
  if (item) {
    setValues({
      ...
      restockLevel: '',   // <-- always blank, never reads the item's real value
    });
  }
  ...
}, [open, item]);
```

This isn't a simple omission — **the data isn't available to read in the
first place.** `InventoryItem` (the type `GET /inventory/items/:id`
returns) has no restock-level field at all; `centralStoreRestockLevel`
only exists on the *write* shapes (`CreateItemInput`/`UpdateItemInput`).
Confirmed on the backend too: `inventory-service.ts`'s `getItemById` calls
`inventoryItemRepository.findById` → `serializeItem`, neither of which
touches the `restock_levels` table at all.

**This is the same underlying gap as item 6 below** (no restock-level data
anywhere in the items read path) — fix them together, not separately, once
the contract-change is approved (see item 6's own note on why this needs
owner sign-off before implementing). Once the backend returns the Central
Store restock level on `GET /inventory/items/:id` (and ideally the list
endpoint too, for item 6), update this `useEffect` to actually read it
instead of hardcoding `''`.

**Supplier field, for the record:** re-tested this specifically and it
round-trips fine — `preferredSupplierId` **is** present on `InventoryItem`
and correctly re-populates the Supplier combobox when re-opening an item
for edit (confirmed live: re-opened "QA Restock Test" after creating it,
Preferred Supplier field correctly showed "Samrat Supermarket Ltd"). Only
restock level has the gap. Don't spend time re-investigating the supplier
field — it works.

---

## 6. No restock-level data anywhere in the items read path — powers both item 5's edit-reopen bug and the missing catalog column

Confirmed at both call sites: neither `GET /inventory/items` (list —
`inventory-repository.ts`'s `findAllByOrganization`) nor
`GET /inventory/items/:id` (single item — `getItemById` /
`inventoryItemRepository.findById`) joins or returns restock-level data.
This is the root cause of **two** owner-reported issues, not two separate
bugs:
- Item 5 above: the Item Form can't show an existing item's current
  restock level when re-opened for editing, because the data was never
  fetched.
- This item: there's no way to add a Restock Level column to the Item
  Catalog table, because the list endpoint doesn't carry it either.

Fix both from the same backend change.

**This needs a backend change**, not just a frontend one. Two ways to get
the data to the client, in rough order of likely fit — check with the
owner or `docs/API_CONTRACT.md` §21 before picking one, since this is a
contract-shape change (`InventoryItemSchema` in `inventory-validators.ts`
is the frozen contract) and per that file's own header should go through
the amendment process (stop, flag to the owner, get it approved) rather
than silently picking an approach:
1. Extend both the list and single-item responses to include each item's
   Central Store restock level (a join in `findAllByOrganization` and
   `findById`, new field on `InventoryItemSchema`). Covers both bugs in
   one contract change.
2. Have the frontend make a second request (already-existing
   `listRestockLevels`) and merge client-side by `inventoryItemId` — avoids
   a contract change, but is an extra round-trip per screen, and the two
   lists could theoretically drift out of sync (different pagination,
   different default location scoping) — more fragile than a proper join,
   and would need doing twice (once for the catalog table, once for the
   single-item edit fetch).

**Stop and flag to the owner before implementing either** — this is
exactly the kind of contract-touching change `inventory-validators.ts`'s
header says to pause on, not work around.

---

## 7. Item Catalog table column widths — not adjustable, real feature request

Confirmed: `features/inventory/components/item-catalog-table.tsx`'s
`ItemCatalogTable` uses fixed Tailwind width classes per column
(`w-[120px]`, `w-[140px]`, etc.) via the `Table`/`TableHead`/`TableCell`
primitives in `components/ui2/table.tsx` — no resize handles, no
drag-to-resize affordance anywhere.

This is real, scoped feature work (not a bug) — implementing resizable
columns typically means either a full data-table library (e.g. TanStack
Table's column-sizing API) or hand-rolling drag handles with `mousedown`/
`mousemove` listeners persisting widths to component state (and possibly
`localStorage` for persistence across sessions). Given the project's
existing `Table` primitive is hand-built (not a data-table library), this
is a meaningful scope decision — **ask the owner** whether they want:
- A full resizable-columns implementation (bigger lift, real UX
  improvement for a table with this many long text columns), or
- Just fixing the Units column specifically (already flagged in the prior
  session as hard-to-parse — a narrower, more targeted fix, e.g. wrapping
  instead of truncating, or a tooltip on hover, rather than a general
  resize mechanism).

---

## 8. Conversion field — not a bug, needs owner-facing clarification only

The owner asked what the "Conversion" field in the Item Form is for. This
is legitimate existing domain logic (confirmed via
`docs/features/inventory/05-plan.md` and the backend validators), not
something to change:

- **Buy unit** = the unit the item is purchased in (e.g. "bag").
- **Usage unit** = the unit stock is tracked/consumed in (e.g. "kg").
- **Conversion** = how many usage units are in one buy unit — e.g. "1 bag
  = 25 kg" means buying 1 bag adds 25 kg to on-hand stock. This lets
  receiving/goods-receipt flows (a later milestone) record "received 3
  bags" and have the system correctly add 75 kg to inventory, while the
  catalog and reports always show quantities in the consistent usage unit.
- It's nullable — `conversionFactor: null` renders as "no conversion" (an
  item bought and used in the same unit, e.g. "kg → kg", needs no ratio).

No code change needed here — this is purely an in-product help-text/
tooltip opportunity if the owner wants it clarified for future users, not
a bug. Mention this back to the owner as a "no fix needed, here's what it
does" response; only build a tooltip/help text if they explicitly ask for
one.

---

## 9. "Delete" vs. "Archive" — already asked and answered, don't re-litigate

The owner asked whether there should also be a separate "Delete" option
distinct from Archive. Answered directly in this session, not something to
second-guess: **no, don't add one.** Nothing in this feature is ever
hard-deleted — the entire soft-delete design (`deletedAt`, full history
kept, fully restorable) exists specifically so records stay around for
history/audit purposes across the rest of the product (past orders,
receipts, and other milestones can still reference a category/supplier/item
that's since been archived). A true hard-delete would need to either break
those references or carry its own heavy protections (cascade rules,
confirmation, probably admin-only) — real, separate feature work with its
own risk profile, not something to build speculatively alongside a rename.
If the owner raises a genuine business need for permanent deletion later
(e.g. a compliance requirement), that's a new, deliberately-scoped feature
request — not something to fold into this session.

---

## Process for this session

1. Read the prior two sessions' `04-components.md` entries first.
2. Item 1 (Archive rename) is fully decided — just execute it, full sweep,
   verify with a `grep -ri "retire" frontend/features/inventory/` that
   comes back clean of user-visible strings when done (internal
   function/prop names are fine to leave).
3. Item 2 (sidebar nav) has a confirmed root cause — fix it, verify by
   actually clicking every link and checking the URL changes.
4. Item 3 ("Show retired" toggle) needs the owner's exact repro steps
   (try a hard refresh first) before you can make progress — ask rather
   than re-guessing.
5. Item 4 (Add an item button) — flag the design question to the owner
   before wiring anything.
6. Items 5 and 6 share one root cause (no restock-level data in the items
   read path) and one fix — both need the same contract-change stop/flag/
   approve step before implementing, per the frozen-contract file's own
   rule. Once approved, fix the backend once and both the Item Form's
   edit-reopen blank field (item 5) and the missing catalog column
   (item 6) resolve together.
7. Item 7 (column resize) is real scoped feature work — ask the owner
   whether they want full resizable columns or just a targeted Units-
   column legibility fix before building either.
8. Item 8 needs no code, just relay the conversion-factor explanation
   back to the owner.
9. Item 9 (Delete vs. Archive) is already answered — no separate Delete,
   don't re-ask.
10. Update `04-components.md` with a new dated Status entry for whatever
    you complete this session, matching the existing format (what was
    wrong, how it was verified, what changed).
11. `npx tsc --noEmit` clean on both `frontend/` and `backend/`, `pnpm
    build` clean on `frontend/` (including `check-wds-tokens.ts`), and
    re-run the backend test suite (`npx vitest run` from `backend/`) if
    you touch any backend code — before calling anything done.
12. Verify every fix live in the browser against real data, the same
    standard the last two sessions held themselves to — not just "the code
    looks right."
