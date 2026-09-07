# Session 6 — Attendant Mobile Screens — UI Mockup Generation Prompts

Shared style block used across all six (matches Wendo DESIGN_SYSTEM.md §1, §3, §12.1):

- Deep espresso brown (#2C1810) as the primary ink/action colour, warm cream (#F5F0E8)
  and parchment (#EDE7DC) backgrounds, muted amber/gold (#C4862A) as the single accent
  for emphasis, sparing red/green only for alerts and discrepancy/positive states.
- Premium, restrained, calm — the caliber of Linear/Stripe, not a generic admin template
  or startup UI kit. Confident typography (geometric sans for operational text), generous
  breathing room, soft shadows, no harsh gradients or loud colour.
- Mobile-first, one thing at a time, big thumb-reachable touch targets (44px min), numeric
  keypad inputs where quantities/prices are entered, bottom navigation bar always visible.
- This is a floor-worker tool used one-handed while standing — legible from an arm's
  length, decisive, no clutter, no unnecessary animation.

---

## 1. Stock on Hand (read-only landing screen)

**Purpose:** The Attendant's default landing tab. Answers "what do we have right now" in
one glance — no edit actions anywhere on this screen.

**Prompt:**

> Design a premium, enterprise-grade mobile screen for a Central Store inventory
> attendant at a coffee bistro chain, viewing "Stock on Hand" — a read-only list of
> every stockable item currently held at the store.
>
> Purpose: the attendant's default landing screen, checked constantly through the day to
> know what's in stock before receiving deliveries, prepping, or logging waste. Purely
> informational — there are no edit actions anywhere on this screen.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - A pinned search bar at the top to find an item quickly
> - A scrollable card list, one item per card, each showing: item name, a type badge
>   (Raw Ingredient / Prepped / Pass-Through), the current on-hand quantity in its usage
>   unit (e.g. "4.2 kg", "18 L"), the current cost per unit, and a prominent low-stock
>   flag on any item at or below its reorder level
> - A lightweight filter/segment control to narrow by item type
> - Tapping a card implies drilling into a full-screen movement history (don't need to
>   design that screen — just make the card feel tappable)
> - Bottom navigation bar with tabs for the attendant's other daily screens (Stock,
>   Purchase Orders, Receiving, Prep, Count, Waste) — Stock tab active
>
> Color palette: warm and coffee-inspired, not generic corporate gray. Deep espresso
> brown as the anchor ink/text color, warm cream and parchment tones for backgrounds
> and cards, a muted amber/gold as the single accent color for emphasis and key
> numbers. Sparing use of red only where meaning requires it (the low-stock flag).
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft.
>
> High-fidelity UI mockup, mobile app screen, portrait orientation, no photography.

---

## 2. Purchase Orders — list + new draft

**Purpose:** Attendant can view every PO and create new draft POs, but never send one.
The list must make "pending send" status obvious so the attendant knows it's waiting on
the Manager, not stuck or broken.

**Prompt:**

> Design a pair of premium, enterprise-grade mobile screens for a Central Store inventory
> attendant at a coffee bistro chain: a "Purchase Orders" list screen and a "New Purchase
> Order" draft-creation screen. Show both as a single composition, side by side or clearly
> separated.
>
> Purpose: the attendant raises draft purchase orders for supplier deliveries but can
> never send them — only a Manager can send a PO. The list screen must make it obvious
> which POs are drafts still waiting on the Manager to send, so the attendant trusts the
> system rather than assuming something is stuck.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
>
> Screen A — PO list:
> - A scrollable list of purchase order cards: PO number, supplier name, a clear status
>   badge (Draft / Pending Send / Sent / Partially Received / Closed), total value, date
> - A prominent, unmistakable visual treatment for "Draft — waiting for manager to send"
>   status specifically, since that's the state the attendant's own drafts sit in
> - A floating "+ New Purchase Order" action, thumb-reachable
> - No send/cancel action visible anywhere on this screen for any PO
>
> Screen B — New draft creation:
> - A step-by-step item picker: search or browse catalog items, tap to add to the order
> - Quantity entry per added line using a numeric stepper or keypad
> - A running order total
> - A single "Save Draft" primary action at the bottom — explicitly no "Send to Supplier"
>   button anywhere on this screen
>
> Color palette: warm and coffee-inspired, not generic corporate gray. Deep espresso
> brown as the anchor ink/text color, warm cream and parchment tones for backgrounds
> and cards, a muted amber/gold as the single accent color for status emphasis and key
> numbers.
>
> Style direction: premium enterprise software, the caliber of Linear or Stripe
> Dashboard — not a generic admin template. Confident typography, generous touch
> targets, calm and restrained, strong information hierarchy.
>
> High-fidelity UI mockup, mobile app screens, portrait orientation, no photography.

---

## 3. Receiving (core daily task)

**Purpose:** Attendant's primary daily task — correcting a PO's prefilled ordered
quantities to actual delivered quantities and entering invoice prices, with discrepancies
flagged inline. Must feel fast: target 15 lines under 3 minutes.

**Prompt:**

> Design a premium, enterprise-grade mobile screen for a Central Store inventory
> attendant at a coffee bistro chain, actively receiving a supplier delivery against an
> open purchase order.
>
> Purpose: this is the attendant's single most frequent daily task, done standing at the
> loading area while a delivery driver waits. It must feel fast and confident — the
> target is checking off 15 delivery lines in under 3 minutes, so every line's
> interaction needs to be minimal-tap and immediately legible.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Header context: supplier name, PO number, delivery date
> - A list of order lines, each prefilled with the ordered quantity, and for each line:
>   an editable "actual quantity received" field (numeric keypad entry) and an editable
>   "invoice price" field (numeric keypad entry)
>   - a portion of the mockup with all lines matching (no color change needed as, its default)
>   - a portion of the mockup with at least one line where the actual quantity differs
>     from the ordered quantity, and that line is unmistakably highlighted (a warm red
>     accent, not the brand's normal palette) so a discrepancy is impossible to miss at a
>     glance while scrolling
> - A running summary (e.g. lines completed / total lines) so the attendant can track
>   progress through a long delivery
> - One clear, full-width "Confirm Receipt" action fixed at the bottom of the screen
>
> Color palette: warm and coffee-inspired, not generic corporate gray. Deep espresso
> brown as the anchor ink/text color, warm cream and parchment tones for backgrounds
> and cards, a muted amber/gold as the accent for emphasis. Reserve red strictly for the
> discrepancy highlight — this is the one screen where that alert color earns its place.
>
> Style direction: premium enterprise software, the caliber of Linear or Stripe
> Dashboard — not a generic admin template. Built for speed under light time pressure:
> large numeric input targets, zero visual clutter, confident typography.
>
> High-fidelity UI mockup, mobile app screen, portrait orientation, no photography.

---

## 4. Prep Entry

**Purpose:** Attendant logs a Prep Record — output item, the raw inputs actually used,
and the actual yield produced. No predefined recipe required (D-12). A rolling-average
soft-reference hint appears but never blocks or validates against the entry.

**Prompt:**

> Design a premium, enterprise-grade mobile screen for a Central Store inventory
> attendant at a coffee bistro chain, logging a "Prep Record" — the process of turning
> raw ingredients into a prepped item (e.g. marinating and portioning chicken).
>
> Purpose: the attendant works from memory/experience, not a predefined recipe — they
> record what they actually used and what they actually produced, after the fact. The
> screen should feel like a simple, honest log entry, not a form enforcing a plan.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - A step at the top to pick the "output" item being prepped (e.g. "Marinated Chicken
>   Breast")
> - A repeatable list of "input" lines below — each an ingredient + quantity used
>   (numeric keypad entry), with a clear "+ Add another input" affordance
> - A single "Actual Yield Produced" field near the bottom (numeric keypad entry) — the
>   headline number of this whole entry
> - Directly above or beside the yield field, a small, clearly secondary/muted piece of
>   informational text showing a rolling-average soft reference, e.g. "Typical for this
>   item: ~6 kg input → ~5.6 kg output" — it must read as a helpful hint, not a
>   validation rule, warning, or required target
> - One full-width "Confirm Prep" action at the bottom
>
> Color palette: warm and coffee-inspired, not generic corporate gray. Deep espresso
> brown as the anchor ink/text color, warm cream and parchment tones for backgrounds
> and cards, a muted amber/gold as the single accent — used for the soft-reference hint
> text so it reads as a gentle nudge, not an alert.
>
> Style direction: premium enterprise software, the caliber of Linear or Stripe
> Dashboard — not a generic admin template. Calm, unhurried, confident typography,
> generous spacing between repeatable input lines so tapping the right one is effortless.
>
> High-fidelity UI mockup, mobile app screen, portrait orientation, no photography.

---

## 5. Stock Count — Execution

**Purpose:** Attendant executes a Manager-created count session, entering counted
quantities per line. Expected quantity is never shown (D-14, permanent blind-count rule
for this role) — this is a hard API/UI contract, not a UI convenience.

**Prompt:**

> Design a premium, enterprise-grade mobile screen for a Central Store inventory
> attendant at a coffee bistro chain, executing a physical stock count session created by
> their manager.
>
> Purpose: the attendant walks the store shelf by shelf, counting each item and entering
> what they physically find. Critically, the system deliberately never shows the
> attendant what quantity the system expects to find — this is a blind count by design,
> so the attendant reports what's actually there rather than what they think they should
> report. There must be no "expected quantity" value anywhere on this screen.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Header context: the count session's label and progress (e.g. "Session: Weekly Count
>   — 8 of 42 items counted")
> - A list of items in shelf-walking order, each with only: the item name, its unit, and
>   an empty "Counted Quantity" field for numeric keypad entry — no expected/system
>   quantity shown or implied anywhere, not even faded or crossed out
> - A clear visual distinction between items already counted this session and items
>   still pending
> - A "Pause" affordance so the attendant can leave and resume later without losing
>   progress
> - One full-width "Submit Count" action at the bottom, reachable once all items are
>   counted (or with a clear indicator of how many remain)
>
> Color palette: warm and coffee-inspired, not generic corporate gray. Deep espresso
> brown as the anchor ink/text color, warm cream and parchment tones for backgrounds
> and cards, a muted amber/gold as the single accent for the progress indicator.
>
> Style direction: premium enterprise software, the caliber of Linear or Stripe
> Dashboard — not a generic admin template. Deliberately spare and focused — this screen
> should visually reinforce that only one number matters per line (what was counted),
> with nothing else to compare it against.
>
> High-fidelity UI mockup, mobile app screen, portrait orientation, no photography.

---

## 6. Waste Log — Entry

**Purpose:** Fastest, lightest screen — 3-tap entry (item, quantity, reason) plus an
optional note.

**Prompt:**

> Design a premium, enterprise-grade mobile screen for a Central Store inventory
> attendant at a coffee bistro chain, logging a waste entry — spoiled, dropped, or
> otherwise lost stock.
>
> Purpose: this needs to be the fastest, lightest screen an attendant uses all day — a
> near-instant 3-tap log entry (pick the item, enter a quantity, pick a reason), used
> the moment something is thrown away so waste stays logged accurately rather than
> forgotten.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - An item picker (search or recent-items shortcut) as the first step
> - A quantity field with numeric keypad entry
> - A reason picker presented as large, tappable chips/buttons rather than a dropdown:
>   Spoiled, Prep Error, Dropped, Expired, Other
> - An optional short note field, visually secondary/collapsed so it never feels
>   required
> - One full-width "Log Waste" confirm action at the bottom
>
> Color palette: warm and coffee-inspired, not generic corporate gray. Deep espresso
> brown as the anchor ink/text color, warm cream and parchment tones for backgrounds
> and cards, a muted amber/gold as the accent for the selected reason chip. A touch of
> muted red is acceptable here given the "waste" subject matter, but keep it restrained,
> not alarming.
>
> Style direction: premium enterprise software, the caliber of Linear or Stripe
> Dashboard — not a generic admin template. Extremely low-friction, minimal fields,
> large tappable targets, confident and calm — logging waste should never feel like
> filling out a form.
>
> High-fidelity UI mockup, mobile app screen, portrait orientation, no photography.
