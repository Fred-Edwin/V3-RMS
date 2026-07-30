# UI/UX Design Audit — Handover Prompt

Paste this into a fresh session to continue the Inventory Phase 1 UI/UX design
audit. Flow 1 (Catalog & Suppliers) and Flow 2 (PO raise/send/receive) are
both fully complete and committed. Flows 3-7 have not started.

---

## Prompt to paste

> You are acting as an expert UI/UX designer specializing in premium,
> top-tier product design, continuing the Inventory Phase 1 UI/UX design
> audit. Read `docs/context/INVENTORY-FEATURE/UI_UX_DESIGN_AUDIT.md` in full
> first — it's the brief, and its Findings & decisions log has the complete
> record of Flow 1+2's work (read that log entry before touching anything,
> it explains several non-obvious root-cause fixes you must not
> re-break). Then read this handover note
> (`docs/context/INVENTORY-FEATURE/UI_UX_AUDIT_HANDOVER.md`) for exactly
> where the previous session left off. Flow 1 and Flow 2 are fully done and
> committed — do not re-audit them. Start with collecting the owner's
> mistakes list for Flow 3 (Prep entry) per the audit's own process, then
> proceed flow-by-flow per the brief's process section.

---

## What's done (Flow 1 + Flow 2 — fully complete, committed)

Committed on `feature/inventory-phase1` as `1c81260`
("feat(inventory): UI/UX audit Flow 1+2 — Stock on Hand, Suppliers,
PO/Catalog fixes"). The full findings log is written up in
`UI_UX_DESIGN_AUDIT.md` itself — read that, not this summary, for the real
detail. Short version of what shipped:

- **Stock on Hand** (desktop + mobile): row numbers, buy-unit quantity
  display, a new "Last Received" price column (distinct from the existing
  weighted-average "Avg. Unit Cost"), department filter, stat cards, help
  tip.
- **Suppliers** (desktop + mobile): default-supplier assignment is now a
  real, working toggle — from both the Suppliers screen's own item list
  *and* Item Catalog's edit panel (which previously only supported setting
  a default supplier at item-*creation* time, never on an existing item —
  a real gap, not by design). Roster rows and the Items & Pricing list were
  redesigned for clearer visual hierarchy (name/count primary, at most one
  status badge, no ambiguous supplier-level "latest price" rollup). The old
  full-size `PriceTrendChart` was replaced with a new, reusable inline
  `Sparkline` component (`frontend/components/inventory/Sparkline.tsx`) —
  no axes/gridlines/tooltip, just a quiet trend line with a soft gradient
  fill, empty/low-data states render a neutral dot rather than a
  misleading line.
- **Two real backend bugs found and fixed at the source** while chasing why
  sparklines looked empty (not papered over in the UI):
  1. Price History only ever read `PurchaseOrderLine.receivedAt` — it was
     structurally blind to ad-hoc `InventoryTransaction` receives (no
     linked PO line), which is how the seed script's real historical
     Samrat/Summer Limited prices were recorded. Affects production, not
     just dev data. Fixed by sourcing from the `InventoryTransaction`
     ledger directly.
  2. `SupplierItem.lastPrice` was never auto-updated by the actual
     receiving flow (`recordReceive`) — it only changed when a Manager
     explicitly picked a default supplier from the UI, so it silently went
     stale system-wide. Fixed at the source so every receive keeps it
     current, for every item going forward.
- New backend surface: `GET /inventory-items/:id/suppliers`, a grouped
  last-received-cost repository query, and a new **separate, explicitly
  synthetic** dev seed script (`backend/src/scripts/seed-price-history-demo.ts`)
  — deliberately isolated from `seed-inventory-demo.ts`'s real
  client-transcribed data, only for giving sparklines enough points to show
  shape in dev/demos.
- Verification: `tsc --noEmit` clean (frontend + backend), `next build`
  clean, backend suite green (681/681, several new tests added for the
  fixes above). Both dev servers were restarted after every build
  throughout the session — keep doing this in the next session too, the
  owner asked for it explicitly.

## Owner decisions on record (don't re-ask these)

1. Avg. Unit Cost and Last Received on Stock on Hand are **both kept as
   separate columns**, not merged, not one replacing the other.
2. Sparklines have **no expand-to-full-chart interaction** — just the
   inline trend line, permanently. A "click for detail chart" option was
   considered and explicitly rejected.
3. Seed data: **never fabricate extra price history into the real
   client-transcribed data**. If more demo data is ever needed, it goes in
   a new, clearly-labeled synthetic script — this is why
   `seed-price-history-demo.ts` exists as its own file.
4. `SupplierItem.lastPrice` **auto-updates on every receive**, permanently
   — not a manual-only field, not a one-off backfill.
5. Restart both dev servers (backend `tsx watch`, frontend `next dev`)
   after every build/verification pass, not just at the end of a session.

## What's left

1. **Flows 3-7** (Prep entry, Stock counting, Waste logging, Supplier AP,
   Reports) — genuinely not started. Per the audit brief's own process,
   collect the owner's mistakes list for the next flow (Flow 3, Prep entry)
   *before* starting an independent audit — don't skip straight to
   auditing solo.
2. No known loose ends within Flow 1+2 — it's fully closed out, verified,
   and committed. If something looks off there, treat it as a *new*
   finding for this pass, not an unfinished task from last time.

## Environment/workflow notes for the next session

- **Playwright was explicitly avoided this session** at the owner's
  request — it was slowing things down. Screenshots/manual checks against
  the running app (localhost:3000 frontend, localhost:4000 backend) were
  used instead, with the owner checking the live app directly and giving
  feedback in the conversation. Keep doing this unless told otherwise.
- **Known gotcha**: the backend dev server (`tsx watch src/server.ts`) can
  end up with stale sibling processes if a previous restart didn't fully
  kill the old lineage — `ps aux | grep -E "tsx watch|server.ts"` and kill
  *all* matching PIDs before starting fresh, not just the one bound to
  port 4000.
- This session did real, non-trivial backend work (new endpoints, a fixed
  ledger query, an auto-update on the core receiving path) that went well
  beyond "frontend polish" — the audit brief describes this as a
  frontend-focused pass, but treat that as a default assumption to check,
  not a hard boundary. When a UI symptom traces back to a genuine backend
  bug (as it did twice this session), fix it at the root and say so, rather
  than working around it superficially in the UI.
