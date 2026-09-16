# S8 — Frontend: Suppliers screen, Supplier detail, Record invoice/payment, Milestone Two

Paste everything below the line to the agent running this session. This is a
**Step 7 frontend build session** against the frozen contract
(`docs/API_CONTRACT.md` §22) and **the real S7 backend endpoints** — build
against the real API, since this milestone is sequential. This is the last
build session before integration (S9). Stop at this session's stated scope —
do not attempt the Flow 17 reconciliation workspace; it's out of scope for
this milestone (plan §7 Q6), and the "Reconcile statement" button on
`VND-0` stays inert or hidden.

---

You are running **S8** of Inventory Milestone Two's Step 7 session breakdown
(`docs/features/inventory/milestone-2-plan.md` §5) — the third and final
frontend slice. S7 (backend: invoices, payments, what-we-owe reads) is done
and live. Your job is the four screens built on top of it.

## Read first, in this order

1. `docs/features/inventory/milestone-2-plan.md` §0 (screens 6–10, artboards),
   §1.5 (the derive-don't-store rule — you're rendering numbers, not
   recomputing them; if a screen's total doesn't match what the backend sent,
   that's a backend bug to report, not something to patch client-side), §3a
   rows for screens 6–9 (screens 8 and 9 have **no bespoke loading/error
   artboards** — confirmed by reading the full artboard list; build the
   generic default, and screen 8 is the one screen in this milestone where
   permission-denied is not theoretical — a `STORE_ATTENDANT` who somehow
   reaches this route must see the denial card, not an empty list), §7 Q2
   (the stale damaged-goods artboard — irrelevant to this session's screens,
   noting only so you don't confuse it with anything here), Q4 (five-bucket
   how-overdue grouping — the single source of truth; the Supplier detail
   panel's four visible columns are a display merge of the same five
   buckets, never a separate calculation) and Q5 (overpayment has no
   dedicated UI this milestone — render what the backend sends, don't add a
   credit-balance indicator that doesn't exist in the contract).
2. `frontend/features/inventory/types/receiving.ts` — `SupplierApRowSchema`-
   and `SupplierInvoiceSchema`-derived types.
3. `docs/features/inventory/04-components.md`'s Milestone Two section — the
   "how overdue" bucket table and "what we owe" bucket panel composites
   (S0's items #6–7) and the bundling checkbox list (#4) are what these
   screens assemble from.

## What to build

1. **Suppliers screen** (`VGE-0` desktop, `WXO-0` mobile) — KPI strip, the
   five-bucket how-overdue table, filters. Label it **"What we owe"** in
   user-facing copy, not "Supplier AP" (owner decision 2026-09-16 —
   `docs/features/inventory/milestone-2-plan.md`'s terminology note). Build
   the `PermissionDeniedState` path for real and verify it — this is the one
   screen in the milestone that genuinely needs it.
2. **Supplier detail** (`VND-0` desktop, `WZF-0` mobile) — profile, the
   what-we-owe bucket panel (four visible columns, same five-bucket data),
   invoice list, payment list, purchase history. Confirm in the browser that
   the numbers on this screen match the same supplier's row on the Suppliers
   screen — if they don't, that's a bug to report against S7, not something
   to reconcile client-side.
3. **Record supplier invoice** (`UZJ-0` drawer, `X2Y-0` mobile) — the
   bundling checkbox list against `RECEIVED_INVOICE_PENDING` receipts, live-
   recomputing "Our figure" as receipts are (de)selected, the mismatch
   callout with its two real action buttons (**Save invoice** and **Record
   at billed — open dispute**, both calling the same `POST
   /supplier-invoices` with `dispute` set or omitted) plus a third,
   client-side-only **Hold** that calls nothing and just closes the drawer.
4. **Record supplier payment** (`V7Z-0` drawer, `X4O-0` mobile) — invoice
   multi-select with per-invoice age, live-recomputing "Allocated to
   selected," amount/date/method(Bank/Cash/M-Pesa)/reference, `POST
   /supplier-payments`. Overpayment is allowed by the backend — don't add a
   client-side validation that blocks it.
5. **New/edit supplier** — this reuses Milestone One's existing
   `supplier-form.tsx` composite (plan §6.1 — confirmed reusable as-is)
   **plus one new field**: `paymentDays`, added to the `Supplier` model in S1
   (plan §1.3, §7 Q3(b)). Add the field to the existing form; don't rebuild
   the composite.

## Non-negotiables (restating — don't violate these)

- Terminology: "what we owe" / "how overdue" in every label these four
  screens render, never "AP"/"aging" — this is the session where the
  terminology decision actually shows up most, unlike S5/S6.
- Composites come from S0's output (bundling checkbox list, bucket table,
  bucket panel) — confirm each is logged as built and pixel-diff-verified in
  `04-components.md` before assembling a screen from it.
- Route-group `layout.tsx` for the shared shell if not already covered.
- Visual-diff every screen against Paper, including the mismatch callout and
  overpayment states where drawn.

## Stop condition

All four screens built and visually verified, hooked up to S7's real
endpoints, manually exercised in a browser (record a real invoice with a
mismatch, record a real overpayment, confirm the Suppliers-screen row and
the Supplier-detail panel agree for that supplier). Do not start S9
(integration) — that's a dedicated session covering all of S3–S8 together,
not an extension of this one.
