# Design pass — addendum: Thresholds drawers + confirmed decisions

Paste everything below the line into the **running** design-pass session.
It adds to the original prompt; don't restart anything.

---

Addendum from the owner, 2026-09-24. Everything in your original prompt still
applies. Two updates:

## 1. Confirmed decisions (no change to your work, just certainty)

Plan §7 findings are now **owner-confirmed**, not defaults:
- **Q-A:** the Store Attendant sees **no on-hand quantities anywhere**. That's
  your fix A1 as written, and the waste hint shows cost only (A2).
- **Q-B:** a queried line sends the count back, and the Attendant recounts
  **only the queried lines**, still blind. That's your B6 + B7 as written.
- **Q-C:** daily-count tabs are **top-level categories**. That's your A10 as
  written.

## 2. New: Thresholds drawers (add as Part E, after Part C)

Thresholds are no longer hard-coded. Each is set by whoever owns it. Read
`docs/features/inventory/milestone-6-plan.md` **§1.9** first (it has the
fields, who sets what, defaults and rules).

Draw a small **"Thresholds"** settings surface. Match the existing Restock
levels drawer (`18ZV-0`) and its mobile screen (`1BV6-0`) exactly for shell,
header, spacing, input style and footer. Don't invent a new drawer style.

| # | Based on | Artboard |
|---|---|---|
| E1 | `18ZV-0` | **Thresholds · Store Manager · drawer.** One editable field: "Reason required from" (KES, default 500), with a one-line explanation and a worked example in the existing info-note style ("A −9 kg chicken variance at KES 90/kg = KES 810 → reason required"). Below it, read-only: "Director alerts from KES 5,000 · set by the Director". Footer: Cancel + Save thresholds. Show "Last changed by Joseph Mwangi · 12 Sep" in muted caption text |
| E2 | `1BV6-0` | **Thresholds · Store Manager · mobile**, the same content |
| E3 | E1 | **Thresholds · Branch Manager · drawer** over Today's day (`19C8-0` as the dimmed background). Two editable fields: "Reason required from" (default 1,000) and "Overnight variance alerts me from" (default 500), each with its explanation. Director amount read-only as in E1 |
| E4 | E2 | **Thresholds · Branch Manager · mobile**, the same content |
| E5 | E1 | **Save error** state inside the drawer (one desktop artboard covers both roles) |

**Entry points (also draw these):**
- Store Manager: add a **"Thresholds"** secondary button to the Stock & counts
  top-bar action set. The set becomes Thresholds · Restock levels · Log
  waste · Spot count. Apply it on every Stock & counts desktop page as part of
  your A8 consistency fix, and add a matching entry on the SM mobile screens
  where the Restock levels entry lives.
- Branch Manager: a **"Thresholds"** secondary action on Today's day, desktop
  (`19C8-0` header area) and mobile (`1CDC-0` header, next to "History").
  Keep it quiet: it's a rarely used setting, not a primary action.

When you hand off, fill in the E1–E5 node IDs in plan §0. That's the two
"Thresholds · …" rows marked "(DP addendum)" in Sessions 2 and 3. Include
Part E in your summary to the owner.
