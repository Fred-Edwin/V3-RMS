# Session 7 — Manager Desktop Screens — UI Mockup Generation Prompts

Eleven screens for the Central Store Manager's desktop experience (Wendo Coffee
Bistro's central supply location). Each prompt below states purpose, required content,
exact design-system color/type tokens, and style direction only — no layout, structure,
or composition instructions. The model has full autonomy over hierarchy, structure, and
composition; these are content briefs, not wireframes.

Every "Design tokens" block below is copied verbatim from `docs/DESIGN_SYSTEM.md` §3
(Colour System) and §4 (Typography) — these are the actual hex values and typefaces
this product is built with, not a loose paraphrase, so mockups can be matched against
the real system rather than approximated by eye.

---

## 1. Inventory Dashboard (landing screen)

**Purpose:** The manager's daily operating screen, shown the moment they open the
inventory section. It answers: "what needs restocking, what's currently in flight
(purchase orders, stock counts), and what is my stock actually worth right now?"

**Prompt:**

> Design a premium, enterprise-grade inventory management dashboard for a Central Store
> manager at Wendo Coffee Bistro, a coffee bistro chain expanding from 2 to 10 branches.
>
> Purpose: the daily operating screen for the person responsible for all raw ingredient
> and prepped-stock inventory at the chain's central supply location. It answers: "what
> needs restocking, what's currently in flight, and what is my stock actually worth right
> now?"
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Total value of stock currently held
> - How many items are running low and need reordering
> - Purchase orders that have been sent to suppliers and are awaiting delivery
> - Recent stock counts and their status (scheduled, submitted for approval, approved)
> - Total amount currently owed to suppliers (accounts payable), and how much of that is
>   significantly overdue
> - Recent waste cost
> - A searchable table of every inventory item: name, category, item type, quantity on
>   hand, value, and whether it's healthy or running low
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour, deep and authoritative, used for key
>   interactive elements and critical numbers. Never as a large background fill.
> - Espresso Light #4A2C1A — hover state for Espresso elements.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for cards and panels, slightly deeper than
>   Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly (one or two touches per
>   screen) for highlights, key numbers, and emphasis. Amber Light #F0C97A for tag/badge
>   backgrounds behind amber elements.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text/labels), Stone 500 #78716C (muted text,
>   captions), Stone 300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (light borders),
>   Stone 100 #F4F2EF (hover/subtle fills).
> - Semantic colours for status, each warm-toned except Ready/Success (the one
>   intentional cool note in the system): low-stock/attention items use Warning
>   (BG #FFFBEB, Text #92400E, Border #FCD34D); healthy/paid/approved status uses
>   Ready/Success (BG #EDFAF1, Text #1A6B3C, Border #86EFAC — muted sage green); badly
>   overdue payables use Error (BG #FEF2F2, Text #991B1B, Border #FCA5A5 — warm red, not
>   alarming).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only — nothing else. Inter for all other text: labels, table data, body
>   copy, and every number. All numeric figures set in Inter, semibold, tabular
>   figures — numbers are data and must be instantly comparable.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 2. Stock on Hand

**Purpose:** A dedicated, read-only screen for scanning current stock levels across the
entire catalog and drilling into any single item's movement history. Distinct from the
Item Catalog screen (#3), which is for editing an item's identity/setup, not checking
how much of it exists right now.

**Prompt:**

> Design a premium, enterprise-grade "Stock on Hand" screen for a Central Store manager
> at Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: a screen checked constantly through the day to know exactly what's in stock
> right now, spot anything running low, and review how any single item's stock has moved
> over time. Purely a stock-level view — no item creation or editing happens here.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - A searchable, filterable list of every stockable item, each showing: item name, item
>   type (Raw Ingredient / Prepped / Pass-Through), current on-hand quantity in its usage
>   unit (e.g. "4.2 kg", "18 L"), current cost per unit, total value, and a clear
>   indicator on any item at or below its reorder level
> - A way to filter by item type
> - Drilling into a single item reveals its movement history — a chronological record of
>   every stock change (deliveries received, prep consumption/production, waste,
>   adjustments), with quantities and running balance
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour, deep and authoritative. Never as a
>   large background fill. Espresso Light #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for cards/panels, slightly deeper than
>   Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly (one or two touches per
>   screen) for highlights and key numbers.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text), Stone 500 #78716C (muted text/captions),
>   Stone 300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (light borders), Stone 100
>   #F4F2EF (hover/subtle fills).
> - Semantic colour for the low-stock indicator: Warning (BG #FFFBEB, Text #92400E,
>   Border #FCD34D — warm amber, not alarming).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text — labels, table data, body copy. All numeric
>   figures set in Inter, semibold, tabular figures.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 3. Item Catalog — CRUD

**Purpose:** The administrative counterpart to Stock on Hand — where the manager defines
what an item *is* (identity, units of measure, reorder level, which departments will
eventually order it), rather than how much of it currently exists. Used rarely
(setup-time, onboarding a new item), not throughout the day.

**Prompt:**

> Design a premium, enterprise-grade "Item Catalog" management screen for a Central
> Store manager at Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: the manager maintains the master list of every stockable item the business
> deals with — its identity, how it's bought and used, when it needs reordering, and
> which parts of the business will eventually need it. This is precise, administrative
> setup work, not a daily operational task.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - A searchable list of every catalog item: name, item type (Raw Ingredient / Prepped /
>   Pass-Through), buy unit, usage unit, reorder level, current cost (system-computed,
>   not editable), default supplier
> - The ability to create a new item and edit an existing one, capturing: name, item
>   type, buy unit and usage unit with their conversion factor, reorder level, which
>   store departments (Kitchen, Pastry, Barista, Service, Housekeeping) will eventually
>   order this item, and default supplier
> - A way to assign department tags to many items at once, rather than one at a time
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour for buttons and key interactive
>   elements, deep and authoritative. Never as a large background fill. Espresso Light
>   #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for cards, panels, and input fields,
>   slightly deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly (one or two touches per
>   screen) for emphasis and primary actions.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text/labels), Stone 500 #78716C (muted
>   text/placeholders), Stone 300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (input
>   outlines, light borders), Stone 100 #F4F2EF (hover fills).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text — labels, table data, form fields, body copy.
>   All numeric figures set in Inter, semibold, tabular figures.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 4. Suppliers — CRUD + price history

**Purpose:** Supplier directory with per-item price history over time, so the manager
can catch creeping cost increases early and manage which supplier is the default source
for a given item.

**Prompt:**

> Design a premium, enterprise-grade "Suppliers" screen for a Central Store manager at
> Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: the manager manages the directory of supplier companies the business buys
> from, what each one supplies, which supplier is the default source for a given item,
> and reviews how a supplier's prices have moved over time to catch cost creep early.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - A directory of suppliers: name, contact information, number of items they supply
> - The ability to create/edit a supplier
> - For a selected supplier: the list of items they provide with current price per item,
>   an action to assign them as the default supplier for a given item, and a price
>   history over time for a chosen item — shown as a trend so a rising cost is
>   immediately visible, with the current/latest price called out clearly
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour and the price-trend line's primary
>   colour, deep and authoritative. Never as a large background fill. Espresso Light
>   #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for cards and the detail panel, slightly
>   deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for the current-price
>   callout figure.
> - Stone neutrals for text, structure, and chart gridlines: Stone 900 #1C1917 (primary
>   text, never pure black), Stone 700 #44403C (secondary text), Stone 500 #78716C
>   (muted text/captions), Stone 300 #D6D3D1 (dividers/borders/gridlines), Stone 200
>   #E8E5E1 (light borders), Stone 100 #F4F2EF (hover fills).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text — labels, table data, chart axis labels. All
>   numeric figures, including the price callout, set in Inter, semibold, tabular
>   figures.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density. The price trend should read as a serious financial chart, not a
> playful or decorative one.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 5. Supplier Invoices / AP

**Purpose:** Manager-only accounts-payable tracking — what the business owes each
supplier, status per invoice, and an aging view so a debt outstanding 45 days reads
differently from one outstanding 3 days.

**Prompt:**

> Design a premium, enterprise-grade "Supplier Invoices" screen for a Central Store
> manager at Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: manager-only financial visibility into outstanding supplier debt. The manager
> needs to answer "how much do we owe, to whom, and how overdue is it" at a glance, then
> record new invoices and payments as money changes hands with suppliers.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Total amount currently outstanding across all suppliers
> - An aging breakdown of outstanding invoices into three bands: 0–7 days, 8–30 days, and
>   31+ days outstanding — the 31+ band should read as the one needing attention
> - Per-supplier totals: total invoiced, total paid, total outstanding
> - A list of individual invoices: supplier, linked purchase order reference, invoice
>   amount, payment status (Unpaid / Partially Paid / Paid), days outstanding
> - The ability to record a new supplier invoice (supplier, linked PO, amount, reference
>   number) and to record a payment against an existing invoice (amount, method, date)
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour, deep and authoritative. Never as a
>   large background fill. Espresso Light #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for cards and modals, slightly deeper than
>   Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for emphasis on
>   headline figures.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text), Stone 500 #78716C (muted text), Stone
>   300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (light borders), Stone 100 #F4F2EF
>   (hover fills).
> - Semantic colours for invoice status: Unpaid/overdue in the 31+ day band uses Error
>   (BG #FEF2F2, Text #991B1B, Border #FCA5A5 — warm red, not alarming); invoices in the
>   0–7/8–30 day bands use Pending (BG #FDF3DC, Text #92650A, Border #F0D080 — soft warm
>   sand) or Warning (BG #FFFBEB, Text #92400E, Border #FCD34D) as appropriate for
>   escalating urgency; Paid status uses Ready/Success (BG #EDFAF1, Text #1A6B3C, Border
>   #86EFAC — muted sage green, the one intentional cool note in the system).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text. All numeric/currency figures set in Inter,
>   semibold, tabular figures — this is a financial ledger, numbers must align and
>   compare precisely.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density. Should feel trustworthy and precise, like a financial ledger.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 6. Purchase Orders — list + create + send/cancel

**Purpose:** Full purchase order lifecycle management from the manager's desk —
browsing by status, creating new orders (often prefilled from low-stock suggestions),
and sending or cancelling an order — actions only the manager can perform.

**Prompt:**

> Design a premium, enterprise-grade "Purchase Orders" screen for a Central Store
> manager at Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: the manager oversees every purchase order's full lifecycle — creating new
> orders, often prefilled from low-stock suggestions, and being the only person who can
> actually send an order to a supplier or cancel one outright.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - A list of purchase orders: order number, supplier, status (Draft / Sent / Partially
>   Received / Closed / Cancelled), total value, date — filterable by status
> - The ability to create a new order, including a "suggest order" option that prefills
>   line items from currently low-stock items
> - A single order's full detail: supplier, line items with ordered quantity and unit
>   price, order total
> - Two clear actions available only to the manager on an open order: send it to the
>   supplier, or cancel it outright
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour and the "Send to Supplier" button's
>   colour, deep and authoritative. Never as a large background fill. Espresso Light
>   #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for cards and detail panels, slightly
>   deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for emphasis on order
>   totals and key figures.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text), Stone 500 #78716C (muted text), Stone
>   300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (light borders), Stone 100 #F4F2EF
>   (hover fills).
> - Semantic colours for order status: Draft/Sent use Pending (BG #FDF3DC, Text
>   #92650A, Border #F0D080) or InProgress (BG #FEF0E0, Text #A04F0A, Border #F5B87A)
>   as appropriate; Partially Received uses InProgress; Closed uses the neutral Closed
>   token (BG #F4F4F5, Text #71717A, Border #D4D4D8 — cool grey, archived/complete); the
>   Cancel action and Cancelled status use Cancelled (BG #FDF2F0, Text #9B3A2A, Border
>   #F5A898 — muted terracotta, a soft alert rather than an alarming red).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text. All numeric/currency figures set in Inter,
>   semibold, tabular figures.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density. Actions like send/cancel should feel confident and decisive.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 7. Prep Entry — Manager variant (with running cost panel)

**Purpose:** The manager's desktop variant of the daily prep-logging task (recording raw
ingredients used and actual yield produced) — used for review or backfilling rather than
as the primary daily surface, distinguished by a live running-cost calculation.

**Prompt:**

> Design a premium, enterprise-grade "Prep Entry" screen for a Central Store manager at
> Wendo Coffee Bistro, a coffee bistro chain's central supply location, for logging or
> reviewing a Prep Record — the process of turning raw ingredients into a prepped item
> (e.g. marinated chicken, beef patties).
>
> Purpose: records what was actually used and actually produced during a prep run, with
> no predefined recipe required — the manager (or attendant) works from experience, not a
> plan. This screen's distinguishing feature over the operational floor version is a live
> cost calculation that helps the manager see the resulting per-unit cost before
> confirming.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Selecting the output item being prepped (e.g. "Marinated Chicken Breast")
> - A repeatable set of input lines: ingredient and quantity actually used
> - The actual yield produced
> - A live running cost calculation: total input cost, and the resulting cost per unit of
>   output once yield is entered
> - A gentle, clearly informational reference showing typical past results for this
>   output item (e.g. "Typical: ~6kg input → ~5.6kg output") — never a validation rule or
>   requirement
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour, deep and authoritative. Never as a
>   large background fill. Espresso Light #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for the running-cost panel, slightly
>   deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for the computed cost
>   figures — the visual payoff of this screen.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text), Stone 500 #78716C (muted text — used for
>   the informational rolling-average hint, which should read as secondary/muted, never
>   as a warning), Stone 300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (input
>   outlines), Stone 100 #F4F2EF (hover fills).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text. All numeric figures, especially the computed
>   cost figures, set in Inter, semibold, tabular figures.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density. The cost calculation should feel like the payoff of the screen.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 8. Prep Recipe Editor (desktop-only)

**Purpose:** An optional, occasional authoring task — the manager takes a representative
past Prep Record and saves it as a standing recipe for future training/soft-reference
use. Desktop-only; there is no mobile create/edit for this screen.

**Prompt:**

> Design a premium, enterprise-grade "Prep Recipe" editor screen for a Central Store
> manager at Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: deliberate, occasional authoring work, not a daily task. The manager takes a
> real past prep record and turns it into a named, saved recipe used later purely as
> training material and a soft reference — never a requirement for future prepping.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Recipe name/label and a batch label
> - Input lines with quantities, carried over from the source prep record and editable
> - An expected yield figure
> - Space for instructions or notes, for training context
> - A clear action to save the recipe
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour and the "Save Recipe" button's colour,
>   deep and authoritative. Never as a large background fill. Espresso Light #4A2C1A
>   for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for the editor's card/section grouping,
>   slightly deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for emphasis.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text/labels), Stone 500 #78716C (muted text),
>   Stone 300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (input outlines), Stone 100
>   #F4F2EF (hover fills).
> - Typography: Cormorant Garamond (weights 400/500/600) — this screen is reflective,
>   document-like authoring work, so Cormorant may appropriately appear a little more
>   than usual for the recipe title/name, while still following the rule that it never
>   carries data or numeric figures. Inter for all operational text, labels, form
>   fields, and every number (semibold, tabular figures).
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft. Should read as
> considered, reflective authoring work — more spacious and document-like than the
> product's faster operational screens.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 9. Stock Count — session creation + approval

**Purpose:** Two manager-only moments bookending the count workflow: planning a count
session, and later approving a submitted count's variance (valued in KES) before it
posts as a permanent inventory adjustment. This is the one screen where the manager
sees numbers the attendant who did the counting never saw.

**Prompt:**

> Design a premium, enterprise-grade "Stock Count" screen for a Central Store manager at
> Wendo Coffee Bistro, a coffee bistro chain's central supply location, covering both
> planning a new count session and approving a submitted one.
>
> Purpose: the manager plans physical stock count sessions (deciding what to count) and
> later reviews the results, approving the count so any variance between expected and
> counted quantity posts as a permanent inventory adjustment. This is the one place the
> manager sees numbers the attendant who did the counting was never shown.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Creating a new count session: a label, a scheduled date, and which items are included
> - Reviewing a submitted count: for each item, the expected quantity, the counted
>   quantity, and the gap between them, valued in Kenyan Shillings (KES) — with a clear
>   distinction between items that matched cleanly and items with a real variance
> - A total variance value summed across the session
> - A clear action to approve the count, understood to post the variance as inventory
>   adjustments
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour and the "Approve" button's colour,
>   deep and authoritative. Never as a large background fill. Espresso Light #4A2C1A
>   for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for cards and the variance table,
>   slightly deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for the total variance
>   figure.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text), Stone 500 #78716C (muted text, used for
>   clean/zero-gap rows so they recede visually), Stone 300 #D6D3D1 (dividers/borders),
>   Stone 200 #E8E5E1 (light borders), Stone 100 #F4F2EF (hover fills).
> - Semantic colours for the variance view: shortfalls (counted less than expected) use
>   Error (BG #FEF2F2, Text #991B1B, Border #FCA5A5 — warm red, not alarming); overages
>   (counted more than expected) use Ready/Success (BG #EDFAF1, Text #1A6B3C, Border
>   #86EFAC — muted sage green, the one intentional cool note in the system).
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text. All numeric and KES-currency figures set in
>   Inter, semibold, tabular figures — this is a financial reconciliation moment, values
>   must align and compare precisely.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density. The approval moment should feel like a precise financial
> reconciliation.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 10. Waste Log — Review

**Purpose:** A filterable historical view across every logged waste entry, feeding
waste-cost analysis. A slower, analytical review surface, in contrast to the fast 3-tap
entry screen used on the floor.

**Prompt:**

> Design a premium, enterprise-grade "Waste Log" review screen for a Central Store
> manager at Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: the manager audits and reviews waste trends over time — which items are
> wasted most, for what reason, and by whom — rather than logging waste themselves (that
> happens quickly on the floor). This is a slower, analytical review, not an operational
> task.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - A filterable list of waste entries: item, quantity, reason (Spoiled, Prep Error,
>   Dropped, Expired, Other), optional note, who logged it, date/time
> - Filters by date range and by reason
> - Total waste value over the selected range, to make the cost impact legible at a
>   glance
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour, deep and authoritative. Never as a
>   large background fill. Espresso Light #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for the summary strip and table row cards,
>   slightly deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for the total waste
>   value figure.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text), Stone 500 #78716C (muted text/notes),
>   Stone 300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (light borders), Stone 100
>   #F4F2EF (hover fills).
> - Semantic colour for the reason tags: Cancelled (BG #FDF2F0, Text #9B3A2A, Border
>   #F5A898 — muted terracotta) is the correct restrained-red tone for this "waste"
>   subject matter, deliberately softer than the Error token so the screen reads as
>   calm and analytical, not alarming.
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text. All numeric/currency figures set in Inter,
>   semibold, tabular figures.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density. Calm and analytical, not urgent.
>
> High-fidelity UI mockup, desktop web application, no photography.

---

## 11. Reports Dashboard

**Purpose:** The full manager-only reporting surface — stock valuation, low-stock
alerts, price history, prep yield, count discrepancy, true cost per prepped item, and
supplier AP aging — reached deliberately from navigation, distinct from the Inventory
Dashboard (screen #1), which is a simpler at-a-glance summary shown on entry. This
screen is the deep, per-report drill-down and export destination.

**Prompt:**

> Design a premium, enterprise-grade "Inventory Reports" screen for a Central Store
> manager at Wendo Coffee Bistro, a coffee bistro chain's central supply location.
>
> Purpose: the manager's destination for business intelligence about the store —
> stock valuation, low-stock alerts, cost trends, prep efficiency, count discrepancies,
> true prepped-item cost, and money owed to suppliers. Used for periodic review and
> decision-making, not daily operational work, and distinct from the simpler
> at-a-glance dashboard shown when first entering the inventory section — this is the
> deep-dive destination with full data and export options.
>
> Content it needs to convey (not a layout spec — use your own judgment on structure,
> hierarchy, and composition):
> - Access to seven distinct reports: Stock Valuation, Low-Stock Alerts, Price History,
>   Prep Yield, Count Discrepancy, True Cost per Prepped Item, and Supplier AP Aging
> - Headline figures summarizing several of these at a glance (e.g. total stock value,
>   number of low-stock items, total supplier AP outstanding)
> - At least one report shown in full detail as a data table (e.g. Stock Valuation or
>   Count Discrepancy), with values clearly presented
> - The ability to export a report as PDF or CSV
>
> Design tokens (Wendo RMS design system — use these exact values, not approximations):
> - Espresso #2C1810 — primary ink/action colour, deep and authoritative. Never as a
>   large background fill. Espresso Light #4A2C1A for hover states.
> - Crema #F5F0E8 — primary background, a warm cream white. Never pure #FFFFFF.
> - Parchment #EDE7DC — secondary background for stat cards and report tables, slightly
>   deeper than Crema for gentle layering.
> - Amber #C4862A — secondary accent, warm gold, used sparingly for the headline
>   figures in the stat cards.
> - Stone neutrals for text and structure: Stone 900 #1C1917 (primary text, never pure
>   black), Stone 700 #44403C (secondary text), Stone 500 #78716C (muted text), Stone
>   300 #D6D3D1 (dividers/borders), Stone 200 #E8E5E1 (light borders), Stone 100 #F4F2EF
>   (hover fills).
> - Semantic colours where a report's data is inherently a shortfall/surplus: Error
>   (BG #FEF2F2, Text #991B1B, Border #FCA5A5) for shortfalls/overdue figures, Ready/
>   Success (BG #EDFAF1, Text #1A6B3C, Border #86EFAC — muted sage green) for
>   healthy/surplus figures.
> - Typography: Cormorant Garamond (weights 400/500/600) for the page's top-level
>   heading only. Inter for all other text — labels, table data, stat card labels. All
>   numeric figures, especially the stat card headline numbers, set in Inter, semibold,
>   tabular figures.
>
> Style direction: premium enterprise software, the caliber of Linear, Stripe Dashboard,
> or a Bloomberg terminal — not a generic admin template. Sophisticated, restrained
> color use, confident typography, strong sense of hierarchy and craft, excellent
> information density.
>
> High-fidelity UI mockup, desktop web application, no photography.
