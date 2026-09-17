# S6 — Frontend: Goods Receipt entry + signed detail, Milestone Two

Paste everything below the line to the agent running this session. This is a
**Step 7 frontend build session** against the frozen contract
(`docs/API_CONTRACT.md` §22) and **the real S4 backend endpoints** — build
against the real API, not a mock, since this milestone is sequential.
**Check `04-components.md`'s Milestone Two section before starting** — this
session needs the Sign sheet composite (S0's item #2) and the signature font
token (S0's item #1). If S0 hasn't shipped those yet, stop and tell the owner
rather than building a placeholder sign flow of your own; do not improvise a
substitute signing UI. Stop at this session's stated scope — Supplier AP
screens are S8, not this session.

---

You are running **S6** of Inventory Milestone Two's Step 7 session breakdown
(`docs/features/inventory/milestone-2-plan.md` §5). S4 (backend: goods
receipts, signing, ledger write) is done and its endpoints are live. Your job
is the two screens built on top of it: the entry form and the immutable
signed record.

## Read first, in this order

1. `docs/features/inventory/milestone-2-plan.md` §0 (screens 4 and 5, their
   artboard IDs), §1.2 and §1.6 (so you understand what "Sign & save" actually
   does server-side — the price alert, the unit conversion, the status
   transition — not just what the button says), §3a rows for screens 4 and 5
   (no bespoke states drawn for either beyond what's noted — confirm against
   the artboard list yourself rather than assuming), §6.3 items 1–2 (the Sign
   sheet and font token — read what S0 was asked to build so you know exactly
   what you're consuming).
2. `frontend/features/inventory/types/receiving.ts` —
   `GoodsReceiptDetailSchema`-derived types, especially `priceAlert` and
   `signature`, which are the two fields that make this screen pair different
   from an ordinary form + detail view.
3. `docs/features/inventory/04-components.md`'s Milestone Two section (S0's
   output) — confirm the Sign sheet and Receipt Line Grid composites are
   logged as built and verified by eye against Paper before you start assembling this
   screen from them.

## What to build

1. **New Goods Receipt** (`UQE-0`) — supplier picker, payment-terms toggle
   (defaulted from the supplier, editable per receipt — the helper text on
   the artboard says this explicitly, render it), invoice/delivery-note
   number and date (both nullable per Flow 2a — the receipt still saves
   without them), the Receipt Line Grid (item + buy-unit qty + unit price +
   computed subtotal + inline price-alert badge when the backend flags one).
   **Two distinct save actions**, not one: "Save draft" (`PATCH`/`POST` with
   no signing) and "Sign & save" (opens the Sign sheet, collects a PIN, then
   calls `POST /goods-receipts/:id/sign` with `acceptedPriceAlerts` for every
   alerted line the user has acknowledged). The footer text on the artboard
   states the commit semantics — render it verbatim, don't paraphrase: "On
   sign: stock rises at the Central Store · status becomes Received —
   invoice pending · Store Manager notified."
2. **Goods Receipt detail (signed) + print** (`UVN-0`) — read-only, immutable
   record: lines, receipt total, the price-alert audit line **exactly as the
   backend returns it** ("38% above last price (KES 1,049). Accepted by D.
   Kariuki.") — this is a stored snapshot, never recompute it client-side
   against the item's current cost, which has already moved on. Signature
   block in the signature font (from S0's token). Linked-invoice slot shows
   "Not recorded yet" until S7/S8 exist — that's correct behavior this
   session, not a gap to fill. **Do not render a damaged-goods/supplier-claim
   line** — the artboard you're looking at may still show one; that flow was
   retired 2026-09-15 and the plan (§7 Q2) already flagged the artboard as
   stale. Build with no claim field regardless of what the artboard shows;
   confirm with the owner if you're unsure rather than copying the stale
   design.

**Terminology:** no "AP"/"aging" language appears on either of these two
screens in the first place, so nothing to change here — noting it so you
don't go looking for something that isn't there.

## Non-negotiables (restating — don't violate these)

- New composites you assemble these screens *from* come from S0's output —
  don't rebuild the Sign sheet or the Receipt Line Grid inline in this
  screen's component file. If a genuinely new composite need turns up that
  S0 didn't anticipate, that's a real gap — flag it, don't build it
  ad hoc inside a screen component (`04-components.md`'s placement rules).
- Route-group `layout.tsx` for the shared shell, per the persistent-shell
  rule, if these two screens weren't already covered by S5's route group.
- Compare both screens by eye against Paper before marking done (plus
  `get_computed_styles` for exact values — **never the banned automated
  `pnpm visual-diff`/`pixelmatch` script**, owner decision 2026-09-16),
  including the mid-signature state (pull that artboard from the Store
  Manager page `4-0`, since it isn't cloned onto page `C-0` — S0's prompt
  already had to find it there; reuse whatever S0 recorded rather than
  re-searching).
- **The by-eye comparison is layout fidelity only, not the whole verification.**
  Neither screen here is a paginated list, but `04-components.md`'s "Table
  and list-screen quality bar" still applies to the Receipt Line Grid's
  column widths (item name, qty, unit chip, price, subtotal must hold their
  widths and not reflow as item names vary in length) — check it against a
  receipt with more lines than Paper's mock shows, not just the exact line
  count the artboard happened to draw.
- **Interactive states on every clickable element** — every line's inputs,
  "+ Add line," "Save draft" vs. "Sign & save," the PIN-entry keys/field in
  the Sign sheet, "Print" on the signed detail. `04-components.md`'s
  "Interactive states" section: hover, focus-visible, active/pressed,
  disabled — a submit button mid-request must visibly show disabled/loading,
  not just silently accept a second click.
- **Every write action has a real, verified failure path — this session has
  the most consequential ones in the milestone.** Trigger and confirm visible
  feedback for: a bad PIN (401 on sign — does the Sign sheet show an error
  and let the user retry, per Flow 2a's "signature not applied, receipt stays
  in draft" rule?), signing an already-signed or empty receipt (409), and a
  failed draft save. None of these should fail silently to the console.

## Stop condition

Both screens built, visually verified (including the sign flow, exercised
live in a browser via the Playwright/chrome-devtools MCP — actually sign a
receipt and confirm the ledger/status effects are visible in the running
app), hooked up to S4's real endpoints. Do not start S7/S8 — that's next.
