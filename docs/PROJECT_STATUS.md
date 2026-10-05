# Wendo RMS: where we are

**The one page to read for the state of the refactor.** Plain English, owner-facing. Last updated 5 Oct 2026 (Purchasing mock Session 2). Whoever finishes a piece of work updates the matching row here in the same change (see "Keeping this current" at the bottom). Details live in the linked docs; this page only says what is done, what is next and what is waiting on whom.

## The shape of the work

The product is being rebuilt one feature at a time into 10 modules plus Inventory (plan: [ROADMAP.md](ROADMAP.md), process: [FEATURE_REDO_PLAYBOOK.md](FEATURE_REDO_PLAYBOOK.md)). Every module goes: **design in Paper, owner approves, build.** Work runs in lanes: one design lane runs ahead, up to two code lanes build.

| Lane | What it is doing now | Status |
|---|---|---|
| **Inventory (code)** | Purchasing and Receiving on a mock-data front-end, then the rest of the Central Store | Sessions 1 and 2 built (Session 2 on branch `feat/purchasing-mock-2`, waiting for your "merge"). Mock is complete; next is the shell session, then the client demo |
| **Workforce (design)** | Drawing screens in Paper, group by group (branch `docs/workforce-design`, worktree lane-3) | Groups A and B approved. Group C in progress |
| **Platform (code)** | Access and Organisation, Notifications and Audit | Not started. Workforce code depends on it |

## Inventory (code lane)

Where each sub-module stands. Design is what the owner approved in Paper; code is what is built.

| Sub-module | Design | Code |
|---|---|---|
| Catalog, Restock levels, Suppliers, Audit log | Approved | **Rebuilt** (on the one access table) |
| Purchasing and Receiving | Approved | **Mock-data front-end complete** (5 Oct 2026): order to delivery, invoice, payment, closed file, statement, audit log, the Attendant's phone views and every exception, all on demo data kept in the browser. The old supplier "record invoice/payment" drawers are gone. Real back-end waits for client approval; its brief is `purchasing-mock/backend-rules.md` |
| Prep, Stock, Waste, Counting | Approved | Old flow, rebuild pending |
| Requisitions, Dispatch, Branch day | **Not approved** | Old flow. Needs Paper design first |

**Next, in the owner's order:**
1. ~~Purchasing mock Session 2~~ built; waiting for your "merge" (the demo script is [features/inventory/purchasing-mock/demo-script.md](features/inventory/purchasing-mock/demo-script.md)).
2. One shell and one navigation table for every role (brief: [sessions/one-shell-navigation.md](sessions/one-shell-navigation.md)).
3. **Client demo** of Purchasing (after 1 and 2). Feedback is applied to the screens, then the real back-end is built in one go.
4. Prep, then Stock and counts, then Waste rebuilds.
5. Design, then rebuild, Requisitions, Dispatch and Branch day.
6. Dashboard and Reports (moved to the Reporting module), then phone versions for the desktop roles.

Rules that apply to all of it: [features/inventory/README.md](features/inventory/README.md) and [features/inventory/decisions.md](features/inventory/decisions.md). Full step list: [features/inventory/roadmap.md](features/inventory/roadmap.md).

**Known gaps in Inventory code:** the access table has no purchase-order capabilities yet (those routes still use old role lists; fixed in the Purchasing back-end session); Stock, Waste, Counting, Prep, Requisitions, Dispatch and Branch day still use old `requireRole` lists until each is rebuilt; the code sidebar does not yet match the "geometric" Paper master.

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

- Say "merge" for Purchasing mock Session 2, then the shell session, then the client demo and feedback.
- Small choices for the client at the demo (list in the demo script): whether a payment bigger than the invoice is allowed, whether the Attendant may see prices, whether the Receiving sidebar link stays next to Purchasing, whether the Branch Manager and Director should be able to settle disputes.
- Two open Inventory decisions: what a miscount correction does to the ledger, and whether the attendant sees on-hand figures when fulfilling a dispatch ([decisions.md](features/inventory/decisions.md)).
- Workforce Group C review, as the designer.
- Client approval of Central Store role names (not yet given).

## Keeping this current

When a session finishes, its agent changes the matching row above, moves finished items out of "Next", and updates the date at the top. Detail goes in the feature README, never here. If this page and a feature README disagree, the README wins for detail and this page gets fixed.
