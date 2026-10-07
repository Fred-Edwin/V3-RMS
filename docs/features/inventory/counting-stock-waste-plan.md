# Stock, Counting and Waste rebuild: implementation plan

Written 8 Oct 2026, revised the same day. Status: **Stage 1 (design) done and owner-approved. Stage 2 (contract) done on 8 Oct 2026 and awaiting the owner's approval of the three build briefs: needs document, frozen contract (Zod, fixtures, front-end mirror), capability rows, route mounts and state copy landed on `feat/stock-count-waste`; production checked (nothing to convert). Stage 3 (build) not started; nothing in the feature is built yet.** Goal: build the back end and front end for the approved redesign and push it to production, with screens that match Paper exactly, are fully interactive and accessible, and follow the Purchasing and Prep pattern for who may read and who may write. Sources: Paper page "Inventory · Counting redesign (Oct 7)" (`p-G-0`, steps 1 to 29 plus 24B, 24C), `counting-redesign.md`, `decisions.md`, `purchasing-plan.md`, `prep-plan.md`, `central-store-access.ts`, `UI_BUILD_RULES.md` (§4a tables), the current code.

**Settled by the owner, 8 Oct 2026:** real back end from the start, no mock-data front end. The shared table component is **merged to `main`** (PR #91, `frontend/components/ui2/data-table/`, README inside); the build sessions use it. **The Attendant keeps the phone screens as a centred phone-width column inside the same shell at every width; there is no Attendant desktop layout** (this reverses the earlier answer to Q1 and drops the old D1b, steps 30 to 39). The defaults in section 1 are accepted.

**Settled on 8 Oct 2026 in Stage 2** (details in `stock-count-waste-needs.md` §8): the Manager's own count applies every line at signing; no PIN on waste reversal (as drawn; the index and state copy said PIN); "Log a missing movement" and "Ask for a recount" write nothing; the migration seeds sections from suppliers with the rest in "Others" and an empty "Packaging"; the Director has flagged lines (Mark seen) and an alert that is a push only (no inbox row); one open count per person and a section in only one open count; the four design defaults (a Reorder link on step 1, the Director opens Count settings from their Counts page, no checkbox column on a signed count, routes as proposed). Open and defaulted: N1 to N12 in the needs document (N11: Paper's `DSP-nnnn` references do not exist in the database yet).

## 1. What is left to design in Paper, and the decisions
### New screens designed (Stage 1, done; the brief was `docs/sessions/stock-count-waste-design-pass.md`)
Step numbers are the ones on the Paper page "Inventory · Counting redesign (Oct 7)" (`p-G-0`); the Screens index (chapter 10) maps every step to its route, roles and owner.
| # | Screen | Paper | Status |
|---|---|---|---|
| D1 | Attendant: reorder sections for today, move an item (phone) | steps **40** and **41** (chapter 7) | Drawn. The entry points are not drawn: a "Reorder" link on step 1 and a "Move" action on an item row (design defaults, confirmed) |
| ~~D1b~~ | ~~Attendant on desktop~~ | ~~steps 30 to 39~~ | **Dropped (owner, 8 Oct 2026).** The Attendant keeps the phone screens as a centred column inside the same shell at every width |
| D2 | Overview (stock hub), desktop | step **42** | Drawn |
| D3 | Printed blank count sheet and printed count record (A4) | steps **43** (pages 1 to 4) and **44** | Drawn |
| D4 | Director: set the alert amount, and the alert | steps **45** and **46** | Drawn. Step 45 shows the Manager's page behind the drawer; the Director opens it from a Count settings control on their Counts page (confirmed). The alert is a **push only**: step 46's inbox row is not built (no host for it: the Inbox is chat only) |
| D5 | Recount of a signed count | steps **47** (Count again), **48** (Counts with a recount), **49** (Start a count, item picked) | Drawn. Step 47 keeps bulk-select checkboxes on a signed count; the build has none (confirmed) |
| D6 | Small gaps in the Count setup set | steps **50** (no matches), **51** (In other sections); 24B and 24C carry type-ahead; "Unsectioned 3" on steps 24 and 48 | Drawn |
| D7 | State copy rows | `states-copy-stock-count-waste.md` | Written; landed as three typed `states-copy.ts` files |
| D8 | Screens index | chapter 10 | Drawn |

### Decisions (defaults accepted by the owner, 8 Oct 2026)
| # | Question | Decision |
|---|---|---|
| Q1 | The Attendant on a desktop-width screen | **Reversed (owner, 8 Oct 2026): no desktop version.** The phone screens as a centred phone-width column inside the same shell at every width. The Attendant's waste flow (steps 16 to 20) was checked: it covers log, check before it is logged, my waste today and reverse own same day; nothing the Attendant needs is missing |
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
- **New data model needed:** a count becomes its own record with any scope (sections or items), one counter at a time, many a day; spot count and "accept/query" go; per-line cause chips; per-item "short three counts running" flag; Director acknowledgement; Attendant item moves with undo; section order and layout owned in Count setup; range settings (KES and %). Production data in the old tables is **empty** (checked 8 Oct 2026); the data model is in `stock-count-waste-contract.md` §2.

## 3. The reference: how Purchasing does read and write (applied here)
1. **One table, `central-store-access.ts`.** A rebuild adds capability rows and a line per role. Routes use `requireCapability(...)`; services call `requireHubReader` (any desktop role may read hub data) and `requireHubActor` (writes need the hub org, except the System Admin). Never a new `requireRole(...)` list.
2. **Read for all desktop roles, write by job.** The same screen shows to every desktop role; write buttons appear only when the server says the person can (`can` flags on each record and `usePermissions()` from `GET /inventory/permissions/me`). Buttons are hidden, not greyed. No role names in the front end.
3. **Blind rule in one helper** (`_shared/blind-rule.ts`): the Attendant sees item costs and prices, never stock figures, and for counting never expected stock. Every response goes through one view builder, as `order-view.ts` does in purchasing.
4. **PIN-signed actions:** signing a count (the counter's own PIN) and approving a count. **Not waste reversal** (owner, 8 Oct 2026: the drawn dialog has no PIN). System Admin signs with their own PIN.
5. **The ledger door** for every stock movement; the guard's allow-list shrinks (counting leaves it).
6. **Folder layout:** `backend/src/modules/inventory/<sub>/<folder>/` with routes, controller, service, repository, validators, types, tests and a README per folder; `frontend/features/inventory/<sub>/<folder>/` with components, hooks, services, types, a README, and a service-boundary test.

**Capability rows, landed on `feat/stock-count-waste` (8 Oct 2026; each a one-row edit; the client has not approved role names, as with Purchasing).** The Store Manager does **not** inherit `counts.acknowledge` and `counts.set_director_alert` (a named list in the table); the grid test is `_shared/stock-count-waste-access.test.ts`:
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
| **1. Design** | **Design session** (`docs/sessions/stock-count-waste-design-pass.md`) | **Done, approved.** Drew D1 to D6 and D8, drafted the state copy (D7) | No |
| **2. Contract** | **Orchestrator** (fresh session, after design is approved). **Done 8 Oct 2026**, awaiting the owner's approval of the briefs | Reviews every approved screen; writes what the front end needs, what the back end provides, the API contract (frozen TypeScript contract, front-end mirror, fixtures), the data model and migration plan, the state machine for a count; runs the production read-only check (needs the owner's permission for `ssh`); lands the shared edits (capability rows, route mounts, state-copy rows); writes the two build briefs with a file-ownership list each; opens the integration branch | No |
| **3. Build** | **Two back-end sessions and one front-end session** (the split is decided below), each started by the owner from the orchestrator's briefs, each in its own worktree cut from the integration branch | **Back end A (Counting):** schema and migration, the door changes, counting services, blind rule, thresholds, branch-day kept working. **Back end B (Stock and Waste):** the ledger summary, All items, Overview, waste log, list and reversal. Front end: every screen, built to Paper and to the contract, using the shared table component, with the parity manifest and the interactivity and accessibility checklist; its last job is to switch to the real API once both back-end branches are merged and test every screen as every role. It may fan out to sub-agents in their own worktrees | Yes: A and the front end at once; B starts when A's foundation commit is merged |
| **4. Release** | **Orchestrator** (same session as stage 2, or a fresh one reading its notes) | Merges the back-end branch first, then the front-end branch; resolves any conflict; runs the combined gates; tests every role together; deletes the old counting, spot count and daily count code; shrinks the ledger guard; moves the sidebar rows to `newHref` area by area; sets the PINs; pushes, opens the PR, merges, watches the deploy, runs the migration, checks production | No |

Rules for the parallel stage: each session owns a listed set of files and edits nothing else; shared files are pre-landed in stage 2; branches are `feat/stock-count-waste-be-counting`, `feat/stock-count-waste-be-stock-waste` and `feat/stock-count-waste-fe`, cut from `feat/stock-count-waste` (the integration branch), in worktrees `V3-RMS-scw-be-counting`, `V3-RMS-scw-be-stock-waste` and `V3-RMS-scw-fe`; workers commit locally and never push. The shared table component is already merged. The briefs: `docs/sessions/stock-count-waste-be-counting.md`, `stock-count-waste-be-stock-waste.md`, `stock-count-waste-fe.md`.

### The back-end split (decided in Stage 2): two sessions
**Yes, split, counting versus stock and waste.** Reasoning: (1) Counting alone is six folders (30 endpoints), the schema and migration, the state machine, the PIN and push work and the door changes, which is already a full session; Stock (5 read endpoints with aggregate SQL) and Waste (4 endpoints and a ledger reversal) are a second full session with a different shape. (2) The two halves share almost no files once the shared layer is pre-landed. (3) Splitting lets the front end see real endpoints for one half early.
**Owns, A (Counting):** everything in `counting/`, the schema and the one migration, the door's two additive changes (`countLineId`, WASTE reversal), the shared variance and thresholds helpers, the branch-day import repoints, `count-reads.ts`. **Owns, B (Stock and Waste):** `stock/` (except the door), `waste/`, `department-label.ts`, the Prep import repoint.
**Order:** A's first commit is the **foundation** (schema, migration, door, helpers, branch-day repoints); the owner merges that single commit into `feat/stock-count-waste` and then starts B. A's second deliverable is `count-reads.ts` (five read functions Overview and All items need); B builds waste and the ledger first and Overview and All items last, after `count-reads.ts` is merged. The front end starts at once, on fixtures.

Every build session follows the Prep slice briefs: read first, settled decisions, verification, the **parity manifest** (one row per Paper artboard and state, checked by eye and by computed styles at the artboard width, never pixel-diff) and the **interactivity and accessibility checklist** (every control works, disabled states real, errors mapped, loading/empty/error/permission states, drawers and dialogs with Escape, focus trap and return, keyboard-only pass, 44px touch targets, reduced motion). "Done" means both.

## 5. Risks
- **Data model change on live tables.** Expand, then contract: new tables first, old tables dropped only after the production check and after the new flow works. Never `prisma migrate dev` on production.
- **Branch-day depends on counting code.** The back end keeps those exports working or moves them to a shared place, with the branch-day tests green.
- **Ledger.** Counting adjustments change stock; every post goes through the door and rolls back with the count approval. A wrong adjustment is a linked correction, never SQL.
- **PINs.** Confirmed by the 8 Oct production check: **nobody who counts or approves has a PIN** (Store Manager 0 of 1, Attendants 0 of 3, System Admin 0 of 1, Directors 0 of 6, Accountants 1 of 2). Signing and approving a count need one, so set them before go-live. Waste needs none.
- **Parity drift.** Paper is the source of truth; parts Paper does not draw are built from existing tokens and marked "needs owner decision", never invented silently.
- **Back-end session size.** It replaces about 5,700 lines; **split into two sessions** (see above).
- **Production data (checked 8 Oct 2026, read only).** The old count and waste tables are empty in production and there are no count or waste ledger rows, so there is nothing to convert; the old tables are dropped by the Stage 4 contract migration.
- **Dispatch references.** Paper's `DSP-nnnn` do not exist in the database (needs-doc N11); screens show the dispatch label until the Dispatch rebuild numbers them.
- **Table component** is merged (PR #91).

## 6. Gates for every session
`pnpm build` and `pnpm test` in `backend`; `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` in `frontend`; real requests as Store Manager, Accountant, Director, Branch Manager and Attendant; the browser pass at the artboard widths; zero console errors; capability matrix test (role by endpoint); blind-rule tests on every Attendant-reachable response; README per folder updated; status row in `PROJECT_STATUS.md` updated.
