# Wendo RMS: where we are

**The one page to read for the state of the refactor.** Plain English, owner-facing. Last updated 6 Oct 2026 (stale merge notes fixed). Whoever finishes a piece of work updates the matching row here in the same change (see "Keeping this current" at the bottom). Details live in the linked docs; this page only says what is done, what is next and what is waiting on whom.

## The shape of the work

The product is being rebuilt one feature at a time into 10 modules plus Inventory (plan: [ROADMAP.md](ROADMAP.md), process: [FEATURE_REDO_PLAYBOOK.md](FEATURE_REDO_PLAYBOOK.md)). Every module goes: **design in Paper, owner approves, build.** Work runs in lanes: one design lane runs ahead, up to two code lanes build.

| Lane | What it is doing now | Status |
|---|---|---|
| **Shared table (code)** | One table component for every table, built to UI_BUILD_RULES §4a | Built and tested; Stock items, Stock ledger, Catalog, Suppliers, Audit log, Prep history, Discrepancies and Requisition history are on it (branch `feat/shared-table-component`, not pushed). Purchasing tabs and Team still to move; list in [features/inventory/table-audit.md](features/inventory/table-audit.md) |
| **Inventory (code)** | Purchasing and Receiving on a mock-data front-end, then the rest of the Central Store | Mock Sessions 1 and 2 merged and deployed (#81), and the one shell is merged and deployed (#83). Mock is complete and the client approved it at the demo (6 Oct 2026). Now building the approved Central Store parts live, front-end and back-end (see "Go-live sequence" below) |
| **Workforce (design)** | Drawing screens in Paper, group by group (branch `docs/workforce-design`, worktree lane-3) | Groups A and B approved. Group C in progress |
| **Platform (code)** | Access and Organisation, Notifications and Audit | Not started. Workforce code depends on it |

## Inventory (code lane)

Where each sub-module stands. Design is what the owner approved in Paper; code is what is built.

| Sub-module | Design | Code |
|---|---|---|
| Catalog, Restock levels, Suppliers, Audit log | Approved | **Rebuilt** (on the one access table) |
| Purchasing and Receiving | Approved | **Mock-data front-end complete** (5 Oct 2026): order to delivery, invoice, payment, closed file, statement, audit log, the Attendant's phone views and every exception, all on demo data kept in the browser. The old supplier "record invoice/payment" drawers are gone. Real back-end waits for client approval; its brief is `purchasing-mock/backend-rules.md` |
| Prep | Approved | **Rebuilt** (PR #89, #90) |
| Stock, Counting, Waste | Approved (Paper chapters 1 to 10) | **Rebuilt on branch `feat/stock-count-waste`** (8 Oct 2026) |
| Requisitions | Approved (8 Oct 2026, Paper chapters 1 to 4, 24 screens) | Old flow, rebuild pending |
| Dispatch, Branch day | **Not approved** | Old flow. Needs Paper design first (final design pass: Dispatch next) |

**Next, in the owner's order:**
1. ~~Purchasing mock Session 2~~ merged (the demo script is [features/inventory/purchasing-mock/demo-script.md](features/inventory/purchasing-mock/demo-script.md)).
2. ~~One shell and one navigation table for every role~~ merged and deployed (#83, 5 Oct 2026) (brief: [sessions/one-shell-navigation.md](sessions/one-shell-navigation.md)). Every desktop role and the Store Attendant now see the new sidebar (a menu drawer on phones, no bottom tabs); the links live in `frontend/components/app/shell/nav-table.ts`. The floor staff stay on the legacy bottom tabs until their screens are rebuilt (owner decision, 5 Oct 2026).
3. **Client demo** of Purchasing (after 1 and 2). Feedback is applied to the screens, then the real back-end is built in one go.
4. Prep, then Stock and counts, then Waste rebuilds.
5. Design, then rebuild, Requisitions, Dispatch and Branch day.
6. Dashboard and Reports (moved to the Reporting module), then phone versions for the desktop roles.

### Go-live sequence (set 6 Oct 2026, after the client approved the Purchasing demo)

Goal: the approved Central Store parts (Purchasing and Receiving, Prep, Stock, Counting, Waste) built properly, front-end and back-end, and live in production. Requisitions, Dispatch and Branch day are not in this run (no approved design). One PR per step, merged to `main` so each step deploys and is checked in production before the next starts.

**Decisions from the demo:**
- **No prices on the LPO document sent to the supplier.** Only that document: the printed or shared LPO drops the price, total and amount-in-words columns, so a supplier cannot hold us to a quoted price if prices fall. Every internal screen (needs restocking estimates, new order, approval, order list, purchase file, receiving) keeps its prices and totals. The back-end LPO output (step 3) follows the same rule.
- **Store Attendant gets desktop screens** as well as the phone ones (every other role keeps its primary desktop version; phone versions for the desktop roles come later). *Amended 8 Oct 2026 for Counting and Waste: the Attendant keeps the phone screens as a centred phone-width column inside the same shell at every width; there is no Attendant desktop layout there.* No separate Paper design pass: the screens are the same set, built from the approved phone design where the Attendant's layout differs (receiving, blind count, my orders, waste), and the owner approves the built screen. The Attendant sees item costs and prices (decision of 6 Oct 2026) but stays blind to stock figures and financial data, enforced by the server.
- **Production checks.** Before any migration, the agent gives the owner the SSH command to read the production database and waits for the go-ahead. Read-only queries only.

| # | Step | Status |
|---|---|---|
| 1 | Front-end change: remove prices from the LPO document sent to the supplier (mock) | **Done 6 Oct 2026, not yet committed.** Only the printed LPO changed (no price, total or amount in words; the acknowledgement no longer mentions prices). All internal screens are unchanged |
| 2 | Access table: order and advance capabilities, Attendant desktop read capabilities, one shared "blind" rule for responses | **Done 6 Oct 2026** (order and advance capabilities already existed). Attendant now holds `catalog.see_costs` and `orders.read`; one helper `_shared/blind-rule.ts` hides only stock figures and financial data; the catalog uses it; item history moved to its own `catalog.read_history`. Other sub-modules adopt the helper when rebuilt |
| 3 | Purchasing and Receiving back-end (schema, migration, services, routes, tests; receiving through the ledger door; old code deleted) | **Done 6 Oct 2026 on branch `feat/central-store-go-live`, not pushed.** Six folders under `modules/inventory/purchasing/`, mounted at `/inventory/purchasing`; Suppliers and the Audit log read the new tables; old receiving code and old tables dropped (migration `drop_old_purchasing`). Not a blocker: users without a PIN set one the first time they sign (the PIN dialog asks), or under Profile |
| 4 | Purchasing front-end live: mock swapped for the real API, demo bar removed, Attendant desktop screens | **Done and approved by the owner (7 Oct 2026, Paper parity pass finished).** The PIN dialog now offers "Set your signing PIN" to a signer who has none, so first use needs no trip to Profile. HTTP service behind the same interface; mock, demo bar and demo "view as" deleted; Receive has the typed delivery price; Attendant sees item prices and order totals but no money (screen chosen from capabilities); Suppliers and Audit log read live data. Walked end to end in a real browser: raise, approve, receive, invoice, pay, closed |
| 5 | Prep rebuild (back-end, front-end, Attendant desktop, ledger writes onto the door) | **In progress: Slice 0 done (7 Oct 2026, branch `feat/prep-rebuild`, not pushed).** Plan and frozen contract approved; migration written and tested on old-shape rows; seven Prep capabilities; the stock ledger can now reverse a prep row and the old Prep code posts through it; the sidebar has Prep with Runs, Usual recipes and History (active square marker, count badge ready). **Slices 1 (Usual recipes) and 2 (Record a run) built in parallel and merged (8 Oct 2026):** recipes list, edit drawer and catalog recipe line; Attendant and manager record flow, numbered runs, old Prep back end deleted. Repeat warning now looks back 2 hours only (owner decision). **Slices 3 (Fix a slip) and 4 (Oversight) built in parallel and merged (7 Oct 2026):** correct and cancel with reversing ledger rows and the 24-hour rule; manager Runs home with KPI strip, Needs a look band, run drawer (correct and cancel wired inside it), History with CSV export, live sidebar badge, run entries in the Audit log. **Slice 5 (hardening) done (7 Oct 2026):** full migration chain applied to an empty database with no schema drift; all Prep and ledger tests pass including the database ones (run them one file at a time, see the Prep README); the Attendant checked at 390, 820 and 1440 and the manager at 1440; docs closed out (API_CONTRACT §33 marked built, DATA_MODEL, READMEs; the plan is kept as the design record). **Ready for the PR; not pushed.** Before go-live: an Attendant and a Store Manager account must exist on the hub site in production |
| 6 | Stock rebuild (Overview, All items, Stock ledger, Stock card) | **Built, not pushed (8 Oct 2026, branch `feat/stock-count-waste`).** Five endpoints on the one access table; the old stock routes are deleted; the sidebar now points at the rebuilt screens. Walked in a real browser as the Manager, Accountant, Director and Attendant (the Attendant is refused every Stock read). API: [API_CONTRACT.md §34](API_CONTRACT.md) |
| 7 | Counting rebuild (sections, many counts a day, review, Count setup, settings, Director, prints) | **Built, not pushed (8 Oct 2026, branch `feat/stock-count-waste`).** 30 endpoints; Attendant phone count, the Manager's own count, review and approve with PIN, Count setup with moves and undo, settings, the Director's flagged lines and alert amount, both printed pages. Daily count and Spot count are gone; the old count tables are dropped by a guarded migration (they were empty in production). A first-time signer sets a PIN in the sign dialog, so PINs are not a go-live blocker |
| 8 | Waste rebuild (log, my waste, reverse, desktop list) | **Built, not pushed (8 Oct 2026, branch `feat/stock-count-waste`).** Four endpoints; no PIN on reversal; the Attendant reverses their own entry the same day and the Manager any entry; the Department Head's branch waste is unchanged (moved to `waste/department/`). Known gap: no date range on the Waste list (needs a Paper step and `from`/`to` on W3) |
| 6 to 8 follow-ups | Small items logged during the build | Read-only roles see "Waiting for you" on the Counts list (Paper draws the Manager's wording); branch day still imports a few old counting files, kept and marked for its own refactor; a Department Head's old `/inventory/waste` routes keep their old role lists |
| 9 | After each step: build and tests on both sides, merge, watch the deploy and migration, smoke-test production, tick the step here | Every step |

Rules that apply to all of it: [features/inventory/README.md](features/inventory/README.md) and [features/inventory/decisions.md](features/inventory/decisions.md). Full step list: [features/inventory/roadmap.md](features/inventory/roadmap.md).

**Known gaps in Inventory code:** the access table already has the order capabilities, but the old purchasing routes still use old role lists (moved in the Purchasing back-end session); Requisitions, Dispatch and Branch day (and a Department Head's branch waste) still use old `requireRole` lists until each is rebuilt; Stock, Counting, Waste and Prep are on the access table. The code sidebar matches the "geometric" Paper master (checked 5 Oct 2026); the one known difference is the round footer avatar, an owner decision of 15 Sep 2026.

## Workforce (design lane)

You approve as the designer; the client has not approved yet. No Workforce code is written. Workforce docs live on the `docs/workforce-design` branch in `~/Projects/V3-RMS-lanes/lane-3/docs/features/workforce/` until that branch is merged.

| Group | Chapters | Status |
|---|---|---|
| A. The people | 1 Role homes, 2 Hire, 3 Departments and heads, 4 Employee file | Approved |
| B. Schedule and time | 5 Build the rota, 6 A day at work, 7 Today board and fixing time, 8 Timesheets and overtime, 9 My time and Report a problem, plus the shared Notifications kit | Approved |
| C. Leave and conduct | 10 Leave, 11 Conduct | Chapter 10: 7 steps drawn in Paper, not yet reviewed. Chapter 11 not started |
| D. Pay | 12 Payroll, 13 Rules | Not started |
| E. Trust and shared parts | 14 Audit and security, 15 Waiting for you, 16 When things go wrong, Signed documents index | Not started |
| Module-wide | Interaction spec, states kit, wording table | Not started |

**After the designs are approved:** the Workforce build starts in a code lane, on top of the Platform (Access and Organisation) work. Open questions for the owner and the client (petty cash for casuals, holiday rules, overtime multipliers and deduction limits to be confirmed by the accountant or lawyer, statutory deductions) are listed in the Workforce README.

## The other modules

Not started: Menu and Pricing, Communications, Finance and Receivables, Reporting, Orders, Fulfilment, Assistant (AI). Order and reasons: [ROADMAP.md](ROADMAP.md), "Order".

## Waiting on the owner

- ~~Run the client demo~~ done 6 Oct 2026. Client feedback: remove prices and estimates from the LPO; the Store Attendant also needs desktop screens.
- Confirm with the client which of these demo choices they settled (list in the demo script; any not recorded stay open): whether a payment bigger than the invoice is allowed, whether the Attendant may see prices, whether the Receiving sidebar link stays next to Purchasing, whether the Branch Manager and Director should be able to settle disputes.
- Two open Inventory decisions: what a miscount correction does to the ledger, and whether the attendant sees on-hand figures when fulfilling a dispatch ([decisions.md](features/inventory/decisions.md)).
- Workforce Group C review, as the designer.
- Client approval of Central Store role names (not yet given).

## Keeping this current

When a session finishes, its agent changes the matching row above, moves finished items out of "Next", and updates the date at the top. Detail goes in the feature README, never here. If this page and a feature README disagree, the README wins for detail and this page gets fixed.
