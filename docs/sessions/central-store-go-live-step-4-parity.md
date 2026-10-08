# Central Store go-live: Step 4b (visual parity and production polish for live Purchasing)

You are a tech lead on Wendo RMS. Read `CLAUDE.md` first (a `Why:` line before every Edit/Write, Edit/Write tools only, pnpm only, a 5-line plain-English recap at the end, a visible task list: check for TaskCreate/TodoWrite and say once if none exists). Then read `docs/features/inventory/purchasing-mock/screen-inventory.md` and `frontend/features/inventory/purchasing/README.md` (the "Awaiting approval" section is your scope), and `docs/UI_BUILD_RULES.md`.

## State
Branch `feat/central-store-go-live`, not pushed. Step 4 is built and committed (HTTP service, mock and demo bar deleted, Receive typed price, Attendant sees item prices and order totals, Suppliers and Audit log live). It was walked in a real browser as Attendant and Store Manager, but **never compared to Paper in this build** and the browser window was only ~900px wide. The Accountant pass is explicitly NOT part of this session (owner decision).

## Goal
For every Purchasing screen and state: confirm or correct it against the approved Paper file ("Wendo RMS · Approved designs", `01M3TP8J54R83RHC9FJ7RAHGKG`), then check production-level interactivity. Correct what differs; list what you could not decide for the owner. Do not rebuild screens that already match.

## Method (no automated pixel diff, ever)
1. **Viewport first.** Use `emulate` or `resize_page` so the page is at the artboard width (desktop 1440x900; phone 390x844 for Attendant and Receive). If a window cannot be resized, open a new page in an isolated context and emulate. Never judge a screen at ~900px.
2. **Seed one order in every stage** with a small script in the scratchpad (not committed): raise, approve, send, receive (one short line and one changed price), invoice (one matching, one disputed), pay, advance, reverse, cancel, return-with-note. Run your own API from source on another port (`PORT=4010 npx tsx src/server.ts` in `backend/`), frontend with `NEXT_PUBLIC_API_URL` pointing at it (`pnpm exec next dev -p 3010`). Do not kill the owner's server on 4000 (use PIDs, not `pkill -f`). Logins: `store.manager@wendo.test`, `store.attendant@wendo.test`, `accountant@wendo.test` (data only), password `password123`, PIN `1234`. Never print request headers.
3. **One manifest**: a table (in the scratchpad, then the result goes in `purchasing/README.md`) mapping each screen and state to its Paper artboard id and the seeded order that reaches it. Get artboard ids from the Paper MCP (`get_basic_info`, `get_tree_summary`, page "Inventory · Purchasing" and chapter 9 for the Attendant).
4. **Per artboard**: screenshot the Paper node and the live screen at the same width; compare by eye; run `get_computed_styles` on anchors (heading, row height, table header, primary button, status dot, spacing) and compare to the live element's computed styles through `evaluate_script`. Record each mismatch with the fix. Check the per-screen visual gate in the memory notes: do it per artboard-state, not batched at the end.
5. **Parallelise** with subagents if useful: one per Paper chapter (stage tabs and New order; purchase file states; drawers and sheets; Attendant phone; prints; supplier tabs and audit log). Each returns a mismatch list; you apply the fixes and re-check. Subagents must not run a second dev server on the same ports.
6. **New parts with no Paper design**: the typed-price field on Receive (`receive-screen.tsx`, under each stepper); the Attendant's price display; hidden "Download all documents". Do not invent a final design silently: build the most consistent version from existing tokens and Paper patterns, mark it "needs owner decision" in the checklist, and show screenshots.
7. **Live-data stress**, which the mock never had: very long supplier and item names, 30+ lines on an order, KES amounts in the millions, a supplier with no contact, an order with no expected date, zero results in each tab, a refused action (wrong PIN, `ORDER_WRONG_STATE`, duplicate invoice number, overpayment), a slow response (throttle in devtools), and a lost connection during an upload.

## Production interactivity and best-practice checklist (each screen)
- Keyboard only: tab order, visible focus ring, Enter and Escape in sheets, dialogs and the PIN boxes; focus returns to the trigger on close; no keyboard trap.
- Every write blocks a double submit and shows an in-flight state; a refusal keeps what was typed and shows the server's plain message.
- Loading, empty and error states exist and use the states kit; a failed reload does not blank a page that already has data.
- Widths: phone (390), tablet (768), 1280, 1440. No horizontal page scroll, clipped or zero-width columns (known: the delivered item table's name column collapses below ~950px page width; fix it properly, for example a minimum width with the table scrolling inside its own container), no overlap of sticky bars.
- Accessibility: names on icon buttons, labels tied to inputs, status not conveyed by colour alone, dialogs labelled, `aria-busy` on loaders, contrast of faint text on the sunken surfaces.
- Console clean (no errors; note third-party warnings separately). Network: no duplicate or looping requests (frontend hook stability rules in `CLAUDE.md`), no refetch storms after a write (the version counter in `use-purchasing.ts` reloads every open list; confirm it does not reload more than needed).
- Session edge cases: an expired token on a print tab and on a sheet submit; opening a purchase file for another site or a deleted draft; direct URL load of every route; browser back after a write.
- Formatting: money (thousands, 2 dp where Paper shows them), quantities (no float noise), dates and "today" labels in Africa/Nairobi, UTC timestamps converted.
- Copy: plain words from the API; no role names or demo wording left; the Attendant sees no invoice, payment or due text anywhere (check the audit panel, activity tab and documents list too).
- Code quality while you are in there: no inline functions in effect dependencies, no `any`, no leftover unused exports from the deleted mock, `pnpm lint` clean (run it, it was not run in Step 4).

## Rules for corrections
Fix in the existing components; keep the shell rules (`nav-table.ts`, no role logic in the shell). Update `purchasing/README.md` (manifest, what was checked, what is open) in the same commit as behaviour changes. Small logical commits, ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; never stage `.claude/` or `docs/sessions/`; do not push.

## Finish
`cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build`. Stop your test servers by PID. Report: the manifest with a verdict per artboard (matches, corrected, needs owner decision), the interactivity findings and fixes, screenshots of anything needing a decision, and the 5-line plain-English recap. Do not start Step 5.
