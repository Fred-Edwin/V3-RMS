# Purchasing Walkthrough — Design Session Handoff

Paste everything below the line into a fresh Claude Code session started in `~/Projects/V3-RMS`.

---

You are a senior product designer working in **Paper** (via the Paper MCP tools) for Wendo RMS. Your job this session is to turn the already-drawn purchasing screens into a **client walkthrough**: the same screens, arranged as a user journey in story order, so the owner can show the client "this is how a purchase works, from spotting low stock to paying the supplier", get approval, and then have it built. You also export it as a PDF. **No application code this session, and do not touch `frontend/` or `backend/`.**

## Read first

1. `CLAUDE.md` (project rules; you are only doing design here).
2. Load the Paper guide before any Paper tool: `get_guide({ topic: "paper-mcp-instructions" })`. For phone screens also `get_guide({ topic: "mobile-status-bar" })`. Call `get_font_family_info` for Geist and Geist Mono before typography work.
3. Skim `docs/features/inventory/suppliers-plan.md` §1 (decisions) for context only.

## The Paper file

- File id: `01M1ZZJ6S3FZGF5C7PPBGTKY89` (name "V3-RMS"). Always pass this `fileId`.
- **Source page: `p-N-0` "12 · Purchasing flow (redo)"** holds the purchasing screens (listed below).
- `p-M-0` "11 · Suppliers expansion (M1 addendum)" holds the supplier screens (list, detail tabs, drawers). Supplier list artboard `1YKI-0`, supplier Overview `1XDZ-0`, Payment tab `1XSG-0`, Catalog tab `1XXT-0`, Documents tab `1Y46-0`.
- Existing style reference for how a walkthrough page reads: page `p-L-0` "01 · CLIENT DEMO (start here)" (chapter labels like "Label 1.1 · Purchasing hub", numbered chapters, "Coming next"). Look at it with `get_basic_info` on that page and a few `get_screenshot` calls to match its feel.
- Design system tokens live in the file; use CSS variables such as `var(--color-ink)`, `var(--color-primary)`, `var(--color-border)`. Fonts: Geist and Geist Mono only.

## Screens that already exist on `p-N-0` (do not redraw them; move and reuse)

| Id | Screen | Notes |
|---|---|---|
| `1YU1-0` | 1 · Needs restocking, grouped by supplier (Store Manager, desktop) | |
| `20OG-0` | 1b · Needs restocking, **List by item** | **Empty artboard. Finish it** (spec below). |
| `20C2-0` | 1m · Needs restocking, phone (Attendant, Low/Out only, sends for approval) | |
| `1ZEK-0` | 3 · New order (LPO), catalog table with tick-boxes and order summary on the right | Recently redesigned |
| `1Z3G-0` | 2a · Orders list, To receive tab | |
| `1Z99-0` | 2b · Orders list, To pay tab (Accountant) | |
| `1ZKD-0` | 4 · Approve order: desktop drawer and phone sheet | |
| `1ZMU-0` | 5a · Purchase file, delivered, advance paid, awaiting invoice | |
| `2018-0` | 5b · Purchase file, closed: Documents tab and audit log | |
| `208I-0` | 5c · Reference table of every state, who acts, main button | |
| `1ZT4-0` | 6 · Record delivery, phone, two steps (check goods; delivery note and PIN) | |
| `1ZWK-0` | 7 & 8 · Add invoice, Record payment, Record advance (three desktop drawers side by side) | |
| `20EC-0` | Review guide | Will be replaced by a walkthrough cover |
| `20FO-0`..`20FR-0` | Row labels A–D | Old grouping; replace with chapter labels |
| `1YR8-0` | "Shell part": sidebar with Purchasing active. **Clone source, not a screen.** The sidebar node inside it is `1YR9-0`. |

Other reusable nodes: top bar `1YWE-0`, page title block `1YWP-0`, stage tabs `1YWS-0` (all inside artboard `1YU1-0`).

## Owner decisions (already made; do not reopen)

- **Flow:** need → LPO → approval → send → delivery → invoice → payment → closed. One purchase = one "purchase file" holding every document.
- Attendants and the Accountant raise orders; the **Store Manager approves** (with PIN). Store Manager self-authorises. Attendants see Low/Out only, never stock numbers.
- One invoice per order. Anything not supplied on delivery is dropped (stays on record).
- Advance payments are allowed after approval (amount with 25/50/100% shortcuts) and applied to the invoice automatically.
- Print/Share/Copy link marks an order Sent; "Mark as sent" covers phone orders.
- **Table style (owner-chosen):** no header fill; 10px Geist Mono uppercase header, letter-spacing 0.06em, a single 1px ink rule under it; light row dividers. Never use `--color-table-header-bg`.
- **Phone style (owner-chosen):** the whole top of a phone screen is the espresso `var(--color-sidebar-top)`: a white status bar, then a header block (menu or back arrow, "WENDO RMS · HUB" in `#B98A5E`, avatar circle `#4E2C14`, title 22px white, subtitle `#B5AEA5`). Reference screen: artboard `1BRS-0` on page `p-G-0`. Existing phone artboards `20C2-0` and `1ZT4-0` already follow it.

## What to build: the walkthrough page

Create a **new page** named `13 · Purchasing walkthrough (client)`. Place the screens on it in story order, in **nine chapters**. Each chapter is a horizontal row with a chapter title label on the left/top. **Prefer moving the existing artboards** to the new page (use `move_nodes`) or, if moving across pages is not possible, clone them with `<x-paper-clone node-id="...">` and keep the originals; do not maintain two divergent copies, so if you clone, mark the originals on `p-N-0` as "source" and stop editing them.

| # | Chapter | Who | Screens in order |
|---|---|---|---|
| 1 | We're running low | Store Manager | 1 grouped, 1b list by item |
| 2 | Raise the order | Store Manager | 3 New order |
| 3 | Approve it and send it | Store Manager | 2a-style "Awaiting approval" queue (draw it, see below), 4 Approve order (desktop drawer + phone sheet), **printed LPO (draw)** |
| 4 | Pay a deposit first (optional) | Accountant | Record advance drawer (from `1ZWK-0`) |
| 5 | The goods arrive | Store Manager and Attendant | 2a To receive queue, 6 Receive delivery (two phone steps), 5a purchase file |
| 6 | The invoice arrives | Store Manager or Accountant | Add invoice drawer (from `1ZWK-0`) |
| 7 | Pay the supplier | Accountant | 2b To pay queue, Record payment drawer, **payment advice (draw)** |
| 8 | Everything in one place | Everyone | 5b closed purchase file, 5c states reference, **supplier statement of account (draw)** |
| 9 | The Store Attendant's day | Attendant (phone) | 1m restock request, "order approved" state (draw a phone Orders/My orders screen), 6 Receive delivery |

Then a final small row **"When things go wrong"**: order returned with a note (Awaiting approval → Returned), short delivery (already in 6a/5a), price change on delivery (6a), disputed invoice (Add invoice drawer variance state, already drawn). Reuse existing screens; only draw what is missing.

A last chapter **"Coming next"** in the style of the existing demo page: company-wide audit log page, Buy now, supplier Orders tab. Text only, no artwork.

### Drawers are steps too

Every drawer is shown as its own step **immediately after the screen that opens it**, drawn open over the dimmed parent screen (the parent screen dimmed, the drawer at the right, 460px wide). Example: To pay queue → Record payment drawer → payment advice. Where a drawer already exists standalone (e.g. in `1ZWK-0`), clone it into an overlay on top of a dimmed copy of its parent screen. Keep the drawer's contents unchanged.

### Captions: minimal

Above each screen put one small caption strip, nothing more: **step number, role chip, and a title of 3–6 words**. Example: `Step 9 · Accountant · Record payment`. No explanation paragraphs anywhere. Role chip colours: use a quiet neutral chip; distinguish roles by text, not by loud colour. Add thin arrows/connectors between consecutive screens in a chapter so it reads as a journey.

### Consistency: one story, one set of numbers

The whole walkthrough follows **LPO-0044, Samrat Supermarket Ltd**: Kabras Sugar 1kg (82 kg × 168), Salt Cooking Oil 10ltr (4 jerrican × 2,340), Prestige Margarine 10kg box (2 box × 2,890), Angel Instant Dry Yeast 500g (2 pouch × 610); ordered 30,136; delivered 27,486 (1 box margarine not supplied, oil price up to 2,400); advance 10,000 (PAY-0029); invoice INV-05188 for 27,986 (KES 500 above delivery, disputed then settled); final payment 17,986 (PAY-0031, EFT-20281). The Kagumo order LPO-0045 (chicken breast, chicken wings, KES 16,050, raised by the Attendant, approved on the phone) is the Attendant's-day example. Fix any screen whose numbers disagree with this.

## Screens you still need to draw

Use the same shell (clone the sidebar `1YR9-0`, top bar `1YWE-0`) and the unfilled-header table style.

1. **1b · Needs restocking, List by item** (finish the empty artboard `20OG-0`): same page as screen 1 with the toggle set to "List by item". One flat table sorted "Most urgent first" (Out before Low), columns: checkbox, ITEM (with category), STATUS, ON HAND / LEVEL, BUY FROM (supplier dropdown showing price), ORDER QTY, LAST PRICE, EST. TOTAL. Rows: Salt Cooking Oil (Out, Samrat, 4, ticked); Highlands Water 12x1ltr (Out, Summer, 4 carton); Kabras Sugar (Low, Samrat, 82 kg, ticked); Prestige Margarine (Low, Samrat, 2, ticked); Angel Yeast (Low, Samrat, 2, ticked); Chicken breast (Low, Kagumo, 5 tray, ticked); 210 Home Baking Flour (Low, Summer, 2 carton); Coco Primo (Low, "Choose supplier" in warning style). Filters: search, Supplier, Sort. Dark selection bar at the bottom: "5 items selected · 2 suppliers · est. KES 42,386 · Create 2 orders".
2. **Awaiting approval queue** (desktop): same Orders table as 2a, "Awaiting approval" tab active, a row `LPO-0045 Kagumo Poultry Farm · Store Attendant · KES 16,050` with an **Approve** button.
3. **Printed LPO** (A4, 794×1123): letterhead "Wendo Coffee Bistro · Central Store", "LOCAL PURCHASE ORDER", LPO-0044, date, supplier name/address/contact, items table (item, qty, unit, price, total), total, "Raised by / Authorised by" lines with names and a signature line, supplier acknowledgement line. Plain, printable, black on white.
4. **Payment advice** (A4): "PAYMENT ADVICE", PAY-0031, date 10 Oct 2026, payer and payee, method and reference (Bank transfer, EFT-20281), table of invoices settled (INV-05188, amount applied 17,986, balance 0), prepared by / approved by.
5. **Supplier statement of account** (screen and A4): supplier Samrat, period selector (from/to), opening balance, transactions in date order (invoice, advance, payment, adjustment) with debit, credit and running balance, closing balance, ageing (current, 1–30, 31–60, 61–90, 90+), totals for the period, PDF/CSV export buttons. Place it as the Statement tab on the supplier detail (clone the shell from `1XDZ-0` on `p-M-0`) plus the printed version.
6. **Phone "My orders" (Attendant)** with LPO-0045 shown "Approved · ready to send" and one order "Awaiting approval", espresso header per the phone style.
7. Any small overlay states needed to make the chapters read (e.g. dimmed parent + drawer overlays).

## PDF export

When the layout is final, export a PDF walkthrough using the Paper tools (`export_combined_pdf`, and `export` if needed): one chapter per page group so it reads in order, chapter title first, cover page at the front. Cover page: "Purchasing — from need to payment", one-line strip of the eight stages (Need · Order · Approve · Send · Receive · Invoice · Pay · Closed), and a small legend of roles. Tell the owner where the file was saved. If PDF export is not possible with the available tools, say so plainly and explain the fallback (screenshot each chapter with `get_screenshot`) rather than skipping silently.

## Working rules and gotchas learned so far

- Call `get_screenshot` after each meaningful group and check spacing, alignment, clipping; fix with targeted `update_styles`, do not delete and redraw. Set tall frames to `height: "fit-content"` rather than guessing pixels.
- After creating an artboard, set its position with `update_styles` `{left, top}`; `create_artboard` ignores left/top in styles. Keep ~80–120px gaps; label rows with small label artboards.
- `write_html` responses list every created node and are very long; write in modest chunks, and use `x-paper-clone` for repeated shells (sidebar, top bar) instead of rewriting them.
- Fixed pixel widths with `white-space: nowrap` for short link text avoid accidental wrapping ("Remove", "Open").
- Never put node ids in text shown to the owner.
- Always call `finish_working_on_nodes` when done with a batch.
- Do not delete existing artboards on `p-N-0` or `p-M-0` without asking; leave them as sources.

## Deliverables at the end

1. The new page `13 · Purchasing walkthrough (client)` with nine chapters, the go-wrong row and "Coming next", captions minimal, drawers as steps.
2. The newly drawn screens (list above) placed in their chapters.
3. The PDF walkthrough (or a clear statement of why it could not be produced).
4. A short summary for the owner: what changed, anything you fixed for consistency, anything still open. Do not build code; the owner will approve the walkthrough with the client first.
