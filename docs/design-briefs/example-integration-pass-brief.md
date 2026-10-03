# Inventory — Integration Walkthrough (Milestone 6 close-out) — Session Handoff

Paste everything below the line into a fresh Claude Code session started in `~/Projects/V3-RMS`.

---

You are a senior full-stack engineer and tech lead on Wendo RMS. Your job this session is the **local rehearsal walkthrough and integration pass** for the Inventory & Procurement redo, so the owner can demo the whole feature to the client. Read CLAUDE.md first (non-negotiables, pnpm only, build/test before any push). Do not read whole docs; read only the sections named here.

## Where things stand (verified 2026-09-30)
- Milestones 1–5 shipped. **Milestone 6 Sessions 1–4 are all merged to `main`** (S4 = PR #46, `aed016a`, deployed). `docs/features/inventory/MILESTONES.md`, `milestone-6-plan.md` §8 and the memory note `project_inventory_milestone_status.md` still say S4 is "built on a branch, unpushed" — that is stale; fix it in step 1.
- What remains for M6 (plan §6 Session 4 + Verification): the **cross-role integration pass** (Flows 4, 5, 5a, 6, 12, 12a, 12b, 12c, 13, 19, 20, 21 in a real browser with real data, Postgres confirming ledger effects) plus a regression click-through of M2–M5 ledger screens (receiving, prep, dispatch, branch receiving) confirming on-hand still reconciles. Then docs closed out.
- The owner will demo in **production** with the client's real catalog seeded and a real day run by each role. Your job is the **local rehearsal only**. Never touch production, never run seeds with `ALLOW_PRODUCTION_SEED`, never push or open a PR unless asked.

## Owner decisions already made
1. You MAY wipe and reseed the **local** database (`docker compose down -v` then up). Local dev data only.
2. **Log bugs first, fix in one pass** after ranking by severity. Do not fix as you go.
3. The rehearsal dataset is reference data only, seeded by one idempotent ordered script. The **day itself is walked live through the UI** so the ledger is real. Do not fake transactions with seeds (the existing `seed-*-dev-fixtures.ts` write fake transactions; local only, do not use them for this).

## Step-by-step plan
0. **Setup:** confirm on `main`, up to date. Bring up `docker compose up -d postgres redis api worker`, check `curl localhost:4000/api/v1/health`, start `cd frontend && pnpm dev`. Ask the owner only if something is ambiguous.
1. **Fix the stale docs/memory** noted above (S4 merged as PR #46).
2. **Dataset gap check:** compare `backend/src/scripts/seed-demo-inventory.ts` (categories, suppliers, items, opening stock, restock levels; needs `provision-branch-departments.ts` first), `seed-inventory-catalog.ts`, `seed-dev.ts` against the target dataset below. Report gaps before writing anything.
3. **Write the rehearsal seed** (reference data only) as one idempotent script, e.g. `backend/src/scripts/seed-rehearsal-reference.ts`.
4. **Walk the day** in the browser (chrome-devtools MCP; load the `run-frontend-browser` skill first), in the demo order below. After each role's part, verify with the Postgres MCP.
5. **Findings table** (severity must-fix / can-wait, evidence, screenshot), then one fix pass, re-walk only affected steps, run `pnpm build && pnpm test` in backend and `pnpm build` in frontend.
6. **Close out:** write the production run sheet (below), update `MILESTONES.md`, `milestone-6-plan.md` §8, mark M6 done, refresh memory. Commit on a branch only if the owner asks.

## Target rehearsal dataset (reference data)
- Hub org (Central Store) + 2 branches, with department locations (Kitchen, Barista, Service, Housekeeping).
- People, one per role, all with signing PINs set: Store Manager, Store Attendant, Branch Manager, Department Heads (Kitchen, Barista, + one at the second branch), Accountant, Director.
- Catalog ~40–60 real Wendo items: raw purchased (chicken, beef, milk, eggs, coffee beans, flour), prepped (marinated chicken, syrups), direct-use stocked (cups, napkins, cleaning). Kitchen category hierarchy ("Prep Kitchen Items" > Chicken/Beef/Pork/Fish, "Market Items", "Dry Items"). Include at least one item where purchase-unit → usage-unit conversion matters, and standard buying prices on some items so a price change can trigger an alert.
- Suppliers: one PAY_NOW, one INVOICE_TO_FOLLOW/14 days, one INVOICE_TO_FOLLOW/30 days.
- Restock levels per department per item; counting thresholds set so scripted variances cross them (SM reason threshold; BM reason + overnight; Director company-wide).
- Opening stock at the Central Store as ledger entries, plus an opening balance in one branch department.

## Demo order and edge cases to walk (mirror the Paper page)
Chapters: 00 Set up · 01 Buy, receive, pay · 02 Prep · 03 Count the Central Store · 04 Request and approve · 05 Dispatch and receive · 06 Close the branch day · 07 Next morning. Flows: 1, 2 (2a/2b/2d/2e), 14–16; 3 (3a); 4, 5, 5a, 6; 7, 8; 9 (9a/9b), 10, 11, 20; 12, 12a, 12b, 13; 12c; 21.
Deliberately include: a price-change alert; an over-delivery vs invoice; one normal prep run and one off-norm yield; a blind count with 3–4 variances, one over threshold needing a reason; one queried line and recount (only queried lines return); a spot count; waste at store and branch; a requisition from Kitchen and Barista and one department that skips; BM edits/deletes/adds a line; a short dispatch and a substitution; one dispatch confirmed and one left IN_TRANSIT (blocks the close); an 18-of-20 delivery resolved (found / transit loss / miscount); a branch close with a non-reconciling gap; a reopen then re-close (linked reversals); the next-morning opening with an overnight variance; one negative-stock attempt (Flow 21).

## Verification after each role's part (Postgres MCP, local `wendo_rms` on localhost:5433)
- Σ ledger per item equals what the screen shows.
- Every row scoped to the right `organizationId` (hub vs branch); no cross-org leaks.
- Every `ADJUSTMENT` has an `ADJ-####` reference and exactly one source link; reversals point at their originals; Σ ledger equals the counted/accepted figure after re-close.
- The attendant never receives expected/on-hand/variance/cost on the wire in any count or waste response.

## Known gotchas
- Repeated test logins trip the API rate limiter (429). Minimise role switches; reuse sessions.
- `tsx watch` API may not reload: restart it manually after backend changes.
- `pnpm build` clobbers the dev server's `.next`: `rm -rf .next` and restart `next dev` afterwards; avoid building mid-walk.
- chrome-devtools touch-emulated clicks often miss: use `evaluate_script` with `.click()`.
- Department Head landing is `/app/requisitions`, not `/app/branch/*`.
- Price-change alert (Flow 2d) and yield-vs-average / yield flags (Flow 3a) ARE designed and built, inline, not as separate artboards: the price badge ("38% above last") sits on New goods receipt (Paper `UQE-0`, demo label 1.14); yield shows as the "Yield vs average" strip on the run detail and a "Yield flags" KPI on the Prep list (demo 2.5/2.7). Walk both live to confirm they fire; there is no dedicated low-yield artboard.
- Accepted deviations from Paper to leave alone: amber "Counted" status, editable counts while day open.
- Push notifications need a real phone: leave to the owner.

## Deliverables at the end
1. Findings table (ranked) and what was fixed.
2. The rehearsal seed script, and how to rerun it.
3. **Production run sheet**: who logs in when, what to click, expected on-screen result, for the client demo.
4. Updated `MILESTONES.md`, M6 plan §8, memory. State plainly what was verified and what was not.

## Paper context (design side, already done)
Paper file `V3-RMS` (`01M1ZZJ6S3FZGF5C7PPBGTKY89`). Page `01 · CLIENT DEMO (start here)` (p-L-0) holds the story-ordered screens (chapters 00–07 + "Coming next", two columns). Milestone pages are `02`–`07`; Director/Accountant/Reports are on `98` pages (designed, not built, to be built after go-live); old design on `99` pages. Use the Paper MCP only if you need to compare a built screen to its design; do not edit Paper this session.
