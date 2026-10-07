# Stock, Counting and Waste rebuild: implementation plan

Written 8 Oct 2026, revised the same day. Status: **design list and defaults approved by the owner (8 Oct 2026); the design pass is next; nothing built.** Goal: build the back end and front end for the approved redesign and push it to production, with screens that match Paper exactly, are fully interactive and accessible, and follow the Purchasing and Prep pattern for who may read and who may write. Sources: Paper page "Inventory · Counting redesign (Oct 7)" (`p-G-0`, steps 1 to 29 plus 24B, 24C), `counting-redesign.md`, `decisions.md`, `purchasing-plan.md`, `prep-plan.md`, `central-store-access.ts`, `UI_BUILD_RULES.md` (§4a tables), the current code.

**Settled by the owner, 8 Oct 2026:** real back end from the start, no mock-data front end. The shared table component is built in another session (`docs/sessions/shared-table-component.md`); it is not part of this plan, and the build sessions use it once it has merged. The Attendant gets a real **desktop** layout, not a centred phone column. The defaults in section 1 are accepted.

## 1. What is left to design in Paper, and the decisions
### New screens to design (one design session; the brief is `docs/sessions/stock-count-waste-design-pass.md`)
| # | Screen | Why it is needed | What to draw |
|---|---|---|---|
| D1 | **Attendant: move an item, reorder sections for today** (phone) | Count setup (step 24) already shows "Moved here by Linnet", but steps 1 and 2 have no control to do it. Moves apply at once, are logged, the Manager can undo | (a) Section list with a "Reorder" mode (drag handles, "for today only"); (b) item row action "Move to another section" opening a small sheet |
| D1b | **Attendant on desktop: count and waste** | Count and waste are drawn as phone screens only; the owner wants a real desktop version | Count: pick a section and count (two panes), check items again, review, sign with PIN, submitted. Waste: log, check before it is logged, my waste today, reverse an entry. Includes the move and reorder controls from D1 |
| D2 | **Overview (stock hub)** (desktop) | First link under Stock & counts; chapter 6 carried over All items, ledger and stock card only | The four-tile hub with the new sidebar and "Start count" in the top bar |
| D3 | **Printed blank count sheet and printed count record** (A4) | "Print blank sheet" (step 24) and the signed-count record exist as buttons only | Two A4 standalone pages in the style of the Purchasing prints |
| D4 | **Director: set the alert amount, and the alert itself** | Step 25 shows the amount read-only; the Director's own place to set it, and how they are told, is not drawn | (a) The step 25 drawer as the Director sees it, amount editable; (b) the alert as an in-app notification row and a push line |
| D5 | **Recount of a signed count** | The old "correct a verified count" path is retired in favour of a linked recount; no screen shows it | "Count again" on a line of an approved count; "Recount of CNT-…" tag on the Counts list row and the review header; step 12 with the item pre-selected |
| D6 | **Small gaps in the Count setup set** | Found while drawing 24B and 24C | No-matches message and clear (×) in the drawer search; the "In other sections" view; the "Unsectioned" count in the Count setup header and on Counts; step 25 drawn over the real Count setup page |
| D7 | **State copy rows** (a document, not drawings) | One reusable states kit with a per-screen copy table | Loading, empty, error and permission lines for each new and carried-over screen |
| D8 | **Screens index** | The contract session needs a map | One artboard listing every screen: step, route, roles that see it, which sub-module owns it |

### Decisions (defaults accepted by the owner, 8 Oct 2026)
| # | Question | Decision |
|---|---|---|
| Q1 | The Attendant on a desktop-width screen | **Design a real desktop version** (owner changed the default): D1b above |
| Q2 | The "count not started" reminder (old Count settings) | **Dropped.** The "longest without a count" tile and the "last counted" labels replace it |
| Q3 | Director "Mark seen" | **Kept.** The "Flagged to you · not seen" tile needs a way to clear; it is the only Director write |
| Q4 | Attendant waste review shows per-item cost | **Yes**, item cost and price, never stock figures |
| Q5 | Accountant sees variance reasons (cause chips) | **Yes**, read only |
| Q6 | Release shape | **Each area switches on when it is finished** (the sidebar link moves from `oldHref` to `newHref` only when that area is done and tested; the old screens keep working until then) |
| Q7 | Rows-per-page choices (25, 50, 100; default 50) and page and filters held in the page address | **Yes to both** (built in the table-component session) |

## 2. What is in the code today (findings)
- **Back end:** `counting/` (13 endpoints, `StockCount` and `StockCountLine`, kinds DAILY and SPOT, one count a day), `stock/` (3 endpoints, ledger door already built), `waste/` (3 endpoints, already on the door). About 5,700 lines across the three, all on the old `requireRole` lists and old design. Counting writes the ledger directly (`count-service.ts` is on the ledger guard's allow-list).
- **Couplings that can break:** `branch-day` imports the counting calculation and service; `stock-service` imports counting; `scripts/seed-counting-dev-fixtures.ts` uses `StockCount`. The branch-day flow is **not** being redone here and must keep working.
- **Front end:** 29 files under `features/inventory/{counting,stock,waste}`, old components, three old screens (daily count, counts list, spot count), `count-print/[id]` page, and nav rows for Overview, All items, Daily count (two versions), Spot count and Ledger still on `oldHref`.
- **New data model needed:** a count becomes its own record with any scope (sections or items), one counter at a time, many a day; spot count and "accept/query" go; per-line cause chips; per-item "short three counts running" flag; Director acknowledgement; Attendant item moves with undo; section order and layout owned in Count setup; range settings (KES and %). Production data in the old tables is unchecked.

## 3. The reference: how Purchasing does read and write (applied here)
1. **One table, `central-store-access.ts`.** A rebuild adds capability rows and a line per role. Routes use `requireCapability(...)`; services call `requireHubReader` (any desktop role may read hub data) and `requireHubActor` (writes need the hub org, except the System Admin). Never a new `requireRole(...)` list.
2. **Read for all desktop roles, write by job.** The same screen shows to every desktop role; write buttons appear only when the server says the person can (`can` flags on each record and `usePermissions()` from `GET /inventory/permissions/me`). Buttons are hidden, not greyed. No role names in the front end.
3. **Blind rule in one helper** (`_shared/blind-rule.ts`): the Attendant sees item costs and prices, never stock figures, and for counting never expected stock. Every response goes through one view builder, as `order-view.ts` does in purchasing.
4. **PIN-signed actions** where a document is signed or money or stock moves: approve a count, reverse waste. System Admin signs with their own PIN.
5. **The ledger door** for every stock movement; the guard's allow-list shrinks (counting leaves it).
6. **Folder layout:** `backend/src/modules/inventory/<sub>/<folder>/` with routes, controller, service, repository, validators, types, tests and a README per folder; `frontend/features/inventory/<sub>/<folder>/` with components, hooks, services, types, a README, and a service-boundary test.

**Proposed capability rows** (each a one-row edit; the client has not approved role names, as with Purchasing):
| Capability | Held by |
|---|---|
| `stock.read` (positions, ledger, stock card; costs follow `catalog.see_costs`) | Store Manager, System Admin, Accountant, Director, Branch Manager. Not the Attendant |
| `counts.read` (every count, expected and variances) | same as `stock.read` |
| `counts.record` (start, count, sign a count; the Attendant's item moves) | Store Manager, Store Attendant, System Admin |
| `counts.resolve` (decide lines, approve and sign with PIN, ask for a recount) | Store Manager, System Admin |
| `counts.setup` (sections, order, items, range settings) | Store Manager, System Admin |
| `counts.acknowledge` ("Mark seen") | Director, System Admin |
| `counts.set_director_alert` | Director, System Admin |
| `waste.read` (every entry; values follow `catalog.see_costs`) | all desktop roles; the Attendant reads own only |
| `waste.log` | Store Manager, Store Attendant, System Admin |
| `waste.reverse_own` (same day) / `waste.reverse_any` | Attendant and Store Manager / Store Manager and System Admin |
Department heads and the Branch Manager's branch-day counting are unchanged and outside this plan.

## 4. How the work runs: four stages, one orchestrator
The owner runs **one orchestrator session** that stays in charge across stages 2 and 4, and opens the other sessions with a brief each. Nothing is pushed by a worker session.

| Stage | Session | Does | Parallel? |
|---|---|---|---|
| **1. Design** | **Design session** (`docs/sessions/stock-count-waste-design-pass.md`) | Draws D1 to D6 and D8, drafts the state copy (D7); the owner reviews and approves the new chapters | No |
| **2. Contract** | **Orchestrator** (fresh session, after design is approved) | Reviews every approved screen; writes what the front end needs, what the back end provides, the API contract (frozen TypeScript contract, front-end mirror, fixtures), the data model and migration plan, the state machine for a count; runs the production read-only check (needs the owner's permission for `ssh`); lands the shared edits (capability rows, route mounts, state-copy rows); writes the two build briefs with a file-ownership list each; opens the integration branch | No |
| **3. Build** | **Back-end session** and **front-end session**, both started by the owner from the orchestrator's briefs, each in its own worktree cut from the integration branch | Back end: schema and migration, counting, stock and waste services, blind rule, access rows, ledger posting through the door, branch-day kept working, tests. Front end: every screen, built to Paper and to the contract, using the shared table component, with the parity manifest and the interactivity and accessibility checklist; its last job is to switch to the real API once the back-end branch is available and test every screen as every role. If the front end is too big for one session it may fan out to sub-agents in their own worktrees | Yes, two at once |
| **4. Release** | **Orchestrator** (same session as stage 2, or a fresh one reading its notes) | Merges the back-end branch first, then the front-end branch; resolves any conflict; runs the combined gates; tests every role together; deletes the old counting, spot count and daily count code; shrinks the ledger guard; moves the sidebar rows to `newHref` area by area; sets the PINs; pushes, opens the PR, merges, watches the deploy, runs the migration, checks production | No |

Rules for the parallel stage: each session owns a listed set of files and edits nothing else; shared files are pre-landed in stage 2; branches are `feat/stock-count-waste-be` and `feat/stock-count-waste-fe`, cut from `feat/stock-count-waste` (the integration branch); workers commit locally and never push; the front end does not merge until the shared table component has.

Every build session follows the Prep slice briefs: read first, settled decisions, verification, the **parity manifest** (one row per Paper artboard and state, checked by eye and by computed styles at the artboard width, never pixel-diff) and the **interactivity and accessibility checklist** (every control works, disabled states real, errors mapped, loading/empty/error/permission states, drawers and dialogs with Escape, focus trap and return, keyboard-only pass, 44px touch targets, reduced motion). "Done" means both.

## 5. Risks
- **Data model change on live tables.** Expand, then contract: new tables first, old tables dropped only after the production check and after the new flow works. Never `prisma migrate dev` on production.
- **Branch-day depends on counting code.** The back end keeps those exports working or moves them to a shared place, with the branch-day tests green.
- **Ledger.** Counting adjustments change stock; every post goes through the door and rolls back with the count approval. A wrong adjustment is a linked correction, never SQL.
- **PINs.** Per the Purchasing production check, almost nobody has a PIN set; counting approval and waste reversal need them, so set them before go-live.
- **Parity drift.** Paper is the source of truth; parts Paper does not draw are built from existing tokens and marked "needs owner decision", never invented silently.
- **Back-end session size.** It replaces about 5,700 lines. If it overruns, split counting from stock and waste without changing the plan.
- **Table component** must merge before the front end does.

## 6. Gates for every session
`pnpm build` and `pnpm test` in `backend`; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` in `frontend`; real requests as Store Manager, Accountant, Director, Branch Manager and Attendant; the browser pass at the artboard widths; zero console errors; capability matrix test (role by endpoint); blind-rule tests on every Attendant-reachable response; README per folder updated; status row in `PROJECT_STATUS.md` updated.
