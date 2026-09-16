# S5 — Frontend: Purchasing hub, New purchase, Receiving worklist, Milestone Two

Paste everything below the line to the agent running this session. This is a
**Step 7 frontend build session** against the frozen contract
(`docs/API_CONTRACT.md` §22) and **the real S3 backend endpoints** — this
milestone is being built sequentially, not in parallel, so build against the
real API, not a mock. Stop at this session's stated scope — do not start the
Goods Receipt entry screen or any Supplier AP screen.

---

You are running **S5** of Inventory Milestone Two's Step 7 session breakdown
(`docs/features/inventory/milestone-2-plan.md` §5). S3 (backend: expected
deliveries + Purchasing hub reads) is done and its endpoints are live. Your
job is the first of three frontend slices: the three screens whose data S3
now serves for real.

## Read first, in this order

1. `docs/features/inventory/milestone-2-plan.md` §0 (scope table — screens 1,
   2, 3 and their artboard IDs), §3.1 (role table — the Attendant's screen has
   no money columns), §3a (states table — rows for screens 1 and 3: screen 1
   has bespoke loading/error artboards, screen 3 does not and needs the
   generic default).
2. `frontend/features/inventory/types/receiving.ts` — the frontend mirror of
   the frozen contract. Your API calls' response shapes must match this
   exactly.
3. `docs/features/inventory/04-components.md`'s Milestone Two section
   (written by S0 — confirm S0 is far enough along that the composites you
   need exist; if S0 hasn't reached the KPI Strip / mixed-type row items yet,
   check with the owner before proceeding rather than building your own
   version of something S0 owns).
4. `docs/DESIGN_SYSTEM.md`, `docs/CODING_STANDARDS.md` §9 (frontend structure).

## What to build

Three screens in `frontend/features/inventory/components/screens/`, wired
into their `app/` route shells (thin — routing only, per playbook §9):

1. **Purchasing hub** (`U7V-0` desktop, `WUL-0` mobile) — the 3-tile KPI strip
   (not 4 — `IN TRANSIT` is dropped, plan §7 Q1), the Inbound band (mixed
   `ExpectedDelivery`/`GoodsReceipt` rows — this session only has
   `ExpectedDelivery` rows to render for real, since S4 hasn't shipped yet;
   render the band correctly for the data that exists, don't fabricate
   `GoodsReceipt` rows to fill the layout), the History band. Loading
   (`WK4-0`) and error (`WPL-0`) states are bespoke — build to those
   artboards, not the generic fallback.
2. **New purchase** (`UEP-0` drawer, `X1O-0` mobile full-screen) — supplier
   picker with the "Last purchase …" reference (from
   `GET /inventory/items/:id/last-price`, live from S3), payment-terms toggle
   (display labels "Invoice" / "Paid on delivery" — the enum stays
   `INVOICE_TO_FOLLOW`/`PAY_NOW`, plan §7 Q3(a)), line entry, `POST
   /expected-deliveries` on save.
3. **Receiving worklist** (`UMS-0` desktop, `WSO-0` mobile, Attendant-only) —
   **no money columns at all**, confirmed by reading the Attendant's own
   artboard against the Manager's Purchasing hub row for the same data (plan
   §3.1). This isn't a client-side filter of the same response — the backend
   already sends `estimatedTotal: null` to this role; render conditionally on
   the field being present, don't add your own role check to hide it (that
   would duplicate a rule the backend already enforces, and drift from it
   over time). No bespoke loading/error artboards exist for this screen (plan
   §3a) — build the generic screen-mirroring skeleton default.

**Terminology:** every label says "what we owe" / "how overdue" where the
copy touches money-owed concepts, never "AP" / "aging" — this doesn't come up
much on these three screens (that's mostly S8's problem) but the Purchasing
hub's `owed` KPI tile is one place it does.

## Non-negotiables (restating — don't violate these)

- New code in `frontend/features/inventory/components/`, imports from
  `components/ui2/`, never `components/ui/`.
- Frontend Hook Stability Rules (`CLAUDE.md`) — any hook returning an action
  used in a `useEffect`/`useCallback` dependency must be stable; prefer
  Zustand selectors over destructuring the whole store.
- A screen group sharing one sidebar needs a route-group `layout.tsx`, not
  each screen mounting its own shell (`04-components.md` placement rules).
- Visual-diff each screen against its Paper artboard (`get_screenshot` vs. a
  screenshot of the running app) before marking it done — not optional for UI
  work, per `CLAUDE.md`'s "use the feature in a browser" rule. Use the
  Playwright/chrome-devtools MCP to drive the real running page.

## Stop condition

All three screens built, visually verified against Paper, hooked up to S3's
real endpoints (no mocks left in the code path), and manually exercised in a
browser. Do not start the Goods Receipt entry screen (S6) — that's next, not
a continuation of this session.
