# Branch waste: Paper spec for the front-end build (Block 3)

Extracted 9 Oct 2026 on branch `docs/block3-paper-spec`. Read this before building any Branch waste screen. It writes no product code and edits no Paper.

**Source.** Paper file "Wendo RMS · Approved designs", page "Inventory · Branch waste" (steps W1 to W9, chapters 1 and 2, plus the cover and screens index) and step 55 on page "Inventory · Counting redesign (Oct 7)" (Chapter 11, "Kitchen waste, today and earlier"). Flow and rules: [branch-waste-flow.md](branch-waste-flow.md). **Paper wins** over any document, and this file is only a reading of Paper.

**How the numbers were taken.** Every size, colour, weight, spacing and string below came from `get_jsx`, `get_computed_styles` or `get_node_info` calls on the drawn nodes. No value was read from a screenshot (screenshots were used only to check I had found the right frame). Where a number is **derived** (for example a chip height = padding + line height + border), it is marked "derived" and is arithmetic on tool values. Node ids are deliberately not shown; refer to a screen by its step name.

**How to read the token column.** Class names are the `wds-` Tailwind classes from `frontend/tailwind.wds.preset.ts` and `frontend/app/tokens.wds.css`; "ui2" means `frontend/components/ui2/`; "shared" means `frontend/features/inventory/_shared/components/`. The words **"no token: use exact value"** mean the preset has nothing that produces it. Paper's own token file (`--color-*`, `--text-*`) is the source of truth ([UI_BUILD_RULES §6](../../UI_BUILD_RULES.md): a Paper-versus-token mismatch is fixed at the token, not hard-coded around), so every mismatch is listed in section 2 as a decision for the owner.

**Spacing tokens.** The 4px scale is `wds-1`=4, `wds-1.5`=6, `wds-2`=8, `wds-2.5`=10, `wds-3`=12, `wds-3.5`=14, `wds-4`=16, `wds-4.5`=18, `wds-5`=20, `wds-6`=24, `wds-8`=32, `wds-10`=40, `wds-12`=48. A px value with no token above (2, 3, 9, 28, 34, 38, 44, 46, 50, 56, 60, 62, 64 and so on) is "no token: use exact value" for spacing and sizes.

---

## 0. Contents and what is drawn

| Step | Screen | Device and width | Role | Frame | Drawn states |
|---|---|---|---|---|---|
| W1 | Pick what was wasted | Phone 390 | Department head or member | 390 × 844 | One state: one item already added |
| W2 | How much, and why | Phone sheet over W1, 390 | same | 390 × 844 | One state: Kachumbari mix, quantity "2" with caret, reason "Spoiled" chosen |
| W3 | Check, then log | Phone 390 | same | 390 × 844 | One state: two lines, empty note |
| W4 | My department's waste today (superseded by step 55) | Phone 390 | Anyone in the department | 390 × 844 | One state: success banner, two active entries, one reversed |
| W5 | Reverse a wrong entry | Phone sheet over W4, 390 | same | 390 × 844 | One state: "Logged the wrong item" chosen |
| 55 | Kitchen waste, today and earlier (supersedes W4) | Phone 390 | Department head or member | 390 × 844 | One state: two day groups, own and others' entries |
| W6 | Branch waste: every entry, with values | Desktop 1440 | Branch Manager (read by all desktop roles) | 1440 × 900 | One state: 9 entries, one reversed |
| W7 | Reverse any entry, with a reason | Desktop dialog over W6, 1440 | Branch Manager | 1440 × 900 | One state: "Logged the wrong item" chosen |
| W8 | Waste for any branch, read only | Desktop 1440 | Director, Accountant, Store Manager, System Admin | 1440 × 900 | One state: page 1 of 2, 10 of 14 entries |
| W9 | The wording of Branch waste | Reference table | Everyone | 1120 wide | Reference only, not a screen to build |

The page also has a **Cover** (1440 × 900) and a **Screens index** (1808 wide). Neither is a product screen. The index repeats this table ("9 screens in 2 chapters"; W8 was added during the design; "Waste is never PIN-signed").

Heights of 844 and 900 are the artboard's canvas, not a design requirement: the real screens scroll (section 1.9).

---

## 1. Shared pieces

### 1.1 Colours used, and the token for each

| Paper value | Where | Token |
|---|---|---|
| `#FCFCFC` | Screen background (phone and desktop) | `bg-wds-canvas` (neutral-0) |
| `#FFFFFF` | Cards, inputs, sheets, dialog, white text | `bg-wds-surface`; text on dark: `text-white` |
| `#171512` | Ink text, header rule, selected chip fill, current page | `text-wds-text-ink` / `bg-wds-text-ink` (neutral-950) |
| `#635E57` | Secondary text, labels, captions | `text-wds-text-secondary` (neutral-600). Paper calls it `--color-text-muted`. Not `wds-text-muted` (that is neutral-500) |
| `#47433D` | Note text, reversed chip text | `text-wds-neutral-700` |
| `#847E76` | Input placeholder (phone) | `text-wds-neutral-500` (`wds-text-muted`) |
| `#8D8982` | Desktop search placeholder, reversed-row text, disabled arrows | **no token: use exact value** (Paper `--color-text-faint`). Code `wds-text-faint` is `#A8A39B`, `wds-text-copy-faint` is `#756E66`. See decision D12 |
| `#A8A39B` | Unselected radio ring | `border-wds-neutral-400` |
| `#D2CFC9` | Chip, input, button borders, grabber | `border-wds-border-strong` / `bg-wds-border-strong` |
| `#E4E2DE` | Card, KPI, table borders | `border-wds-border` |
| `#EEEDEA` | Row dividers, keypad panel, reversed chip fill | `border-wds-neutral-100` / `bg-wds-neutral-100` |
| `#F6F5F3` | Note card, reversed row fill | `bg-wds-neutral-50` (`wds-surface-sunken`) |
| `#B0610F` | Selected edge, caret, Edit link, KPI accent edge | `wds-selected-edge` (= `wds-primary-btn-start`) |
| `#F8F2EC` | Selected radio row fill | `bg-wds-espresso-50` |
| `#2E1806` | Phone header ground | `bg-wds-sidebar-top` |
| `#B98A5E` | Phone header label | `text-wds-espresso-400` |
| `#4E2C14` | Avatar disc | `bg-wds-espresso-800` |
| `#EBDFD6` | Avatar initials | `text-wds-sidebar-badge-fg` |
| `#B5AEA5` | Phone header subtitle | `text-wds-sidebar-fg-item` |
| `#4A1D00` | Primary gradient end | `wds-primary-btn-end` |
| `#FBF2E4` / `#E7D3AC` / `#8A5A16` | Warning note fill / border / dot, KPI label | `bg-wds-warning-bg` / `border-wds-warning-border` / `wds-warning-fg` |
| `#EEF4EC` / `#CADFC6` / `#2F6438` | Success banner | `wds-success-bg` / `-border` / `-fg` |
| `#ECF2F5` / `#C1D4DF` / `#2C5670` | Info note (step 55) | `wds-info-bg` / `-border` / `-fg` |

### 1.2 Type styles used (named once, referred to as T-codes)

| Code | Family | Size / line | Weight | Tracking | Colour | Token |
|---|---|---|---|---|---|---|
| T1 | Geist Mono | 11 / 14 | 400 | 0.08em | `#B98A5E` | no token: use exact value (shared `PhoneHeader` hard-codes it) |
| T2 | Geist Mono | 11 / 14 | 400 | none | `#EBDFD6` | `font-wds-mono` + `text-[11px] leading-[14px]` (as `PhoneHeader`) |
| T3 | Geist | 22 / 28 | 600 | none | `#FFFFFF` | no token: use exact value (as `PhoneHeader`) |
| T4 | Geist | 13 / 18 | 400 | none | `#B5AEA5` | no token: `wds-body-sm` is 13/19, Paper 13/18 |
| T5 | Geist Mono | 10 / 12 | 400 | 0.06em | `#635E57` | no token: use exact value (as `PhoneFieldLabel`, `SectionLabel`). `wds-kpi-label-sm` is 10/12 at 0.04em, not a match |
| T6 | Geist | 14 / 18 | 400 | none | `#171512` | `text-wds-body` is 14/20, Paper 14/18 (decision D12) |
| T7 | Geist | 14 / 18 | 400 | none | `#847E76` (phone) | as T6, colour `text-wds-neutral-500` |
| T8 | Geist | 15 / 18 | 400 | none | `#171512` | no token: use exact value. `wds-section` is 15/20 600 |
| T9 | Geist | 12 / 16 | 400 | none | `#635E57` | `text-wds-caption` + `text-wds-text-secondary` |
| T10 | Geist Mono | 16 / 20 | 400 | none | `#171512` | no token: use exact value |
| T11 | Geist | 12 / 16 | 500 | none | `#B0610F` | `text-wds-caption font-medium text-wds-selected-edge` |
| T12 | Geist | 16 / 20 | 600 | none | `#FFFFFF` | `text-wds-drawer-title` (16/20/600) gives the same size |
| T13 | Geist | 14 / 18 | 500 | none | `#171512` | as T6, `font-medium` |
| T14 | Geist | 13 / 16 | 400 | none | `#171512` | `text-[13px] leading-4` (as the kit's table cells and `ChoiceChips`) |
| T15 | Geist | 20 / 26 | 600 | none (phone), -0.01em (W7 dialog title) | `#171512` | `text-wds-h2` is 20/26 600 at -0.015em; close, tracking differs |
| T16 | Geist | 13 / 16 | 400 | none | `#635E57` | as T14, `text-wds-text-secondary` |
| T17 | Geist | 12 / 17 | 400 | none | `#47433D` | no token: use exact value |
| T18 | Geist | 13 / 18 | 400 | none | `#2F6438` | as T4 geometry, `text-wds-success-fg` |
| T19 | Geist | 12 / 16 | 400 | none | `#8D8982` (reversed row) | see decision D12 |
| T20 | Geist Mono | 26 / 32 | 400 | none | `#171512` | no token: use exact value |
| T21 | Geist | 22 / 28 | 400 | none | `#171512` | no token (the kit's `Keypad` hard-codes it) |
| T22 | Geist | 17 / 22 | 600 | none | `#FFFFFF` | no token (the kit's `Keypad` hard-codes it) |
| T23 | Geist | 24 / 30 | 600 | -0.01em | `#171512` | Paper `--text-title` / `--leading-title` / `--tracking-tight`. Nearest: `wds-mobile-title` (24/30/600, no tracking) |
| T24 | Geist | 13 / 18 | 400 | none | `#635E57` | as T4 geometry, `text-wds-text-secondary` |
| T25 | Geist Mono | 28 / 34 | 400 | none | `#171512` | `wds-kpi` is 28/34 at weight 500 and -0.01em: differs (D12) |
| T26 | Geist | 22 / 34 | 400 | none | `#171512` | no token: use exact value |
| T27 | Geist Mono | 12 / 16 | 400 | none | `#171512` | no token: use exact value (the kit's pager hard-codes `text-[12px] leading-4` mono) |
| T28 | Geist | 13 / 16 | 500 | none | `#171512` | `text-wds-body-sm` with `font-medium` and 16 line |
| T29 | Geist Mono | 13 / 16 | 400 | none | `#171512` | no token: `wds-mono` is 13/18 |
| T30 | Geist | 12 / 16 | 400 | none | `#171512` | `text-wds-caption` ink |
| T31 | Geist | 13 / 16 | 400 | none | `#8D8982` | placeholder on desktop search (D12) |
| T32 | Geist Mono | 10 / 12 | 400 | 0.06em | `#635E57` | table header; same as T5 |

### 1.3 Radii, shadows, borders

- **Radius: 0 on every box in all ten screens** (cards, chips, buttons, inputs, sheet, dialog, KPI strip, table, pager). The only rounded things are the avatar disc (15px on a 30×30), the radio circles (8px on 16×16) and the 6×6 warning dot (3px). Tokens: `rounded-wds-none` for boxes, `rounded-wds-full` for discs. The kit's `Button` is `rounded-wds-sm` (2px) and `KpiStrip` is `rounded-wds-md` (4px), which Paper does not draw: decision D2.
- **Shadows: none drawn anywhere.** Sheet and dialog rely on the scrim and a 1px border only.
- **Borders:** 1px solid everywhere, 1.5px on the quantity box, the selected radio row and the unselected radio ring, 2px on the KPI cell top edge, 4px on the selected radio ring.

### 1.4 Phone header (W1 to W5 and step 55), same on all six

| Part | Value | Token |
|---|---|---|
| Ground | full width, `#2E1806`, padding-top 20 then inner block padding-top 4, bottom 18, sides 16, gap 10 between the top row and the title block. **Derived height: 20+4+30+10+28+2+18+18 = 130** | `bg-wds-sidebar-top`; shared `PhoneHeader` (see D6: it is 8px shorter) |
| Top row | flex, centre, gap 12 | |
| Back chevron | SVG 22×22, stroke `#FFFFFF` 2px, round caps (`M15 5l-7 7 7 7`) | `PhoneHeader leading="back"` |
| Label | "WENDO RMS · NYERI TOWN", T1, grows | `PhoneHeader` builds `WENDO RMS · {organisation name}` |
| Avatar | 30×30 disc, `#4E2C14`, initials "GW" in T2 | `PhoneHeader` (initials from the signed-in user) |
| Title | T3, gap 2 to the subtitle | `<h1>` |
| Subtitle | T4 | |

There is **no status bar** (the rule, UI_BUILD_RULES §7a): the 20px at the top is plain spacing.

### 1.5 Phone primary button (the full-width action at the foot of every phone screen)

Height **50**, full width (358 inside the 16px gutters), flex-centre, **no radius, no border, no shadow**. Fill: vertical gradient in oklab. Label T12.

- On W1, W2 (the Add key), W3, W4, W5 the gradient is `oklab(44% 0.056 0.077)` to `oklab(29.3% 0.052 0.059)`, which converts to **`#7A4217` to `#4A1D00`** (calculated from the Paper values).
- On step 55 and in the W7 dialog the start is `oklab(57.3% 0.069 0.112)`, which is **`#B0610F`** (the token `wds-gradient-primary`); the end is `#4A1D00` in both.
- Kit match: `PhonePrimaryButton` is 52 high and uses `wds-gradient-primary` plus a top sheen. Conflict C1 and decision D1.
- Margin below: 20 (W1, W3, W4, W5 inside a column with `padding-bottom: 20`; step 55 uses `margin-bottom: 20`).

### 1.6 Phone secondary button

Height **44**, full width, flex-centre, background `#FFFFFF`, 1px `#D2CFC9`, no radius, no shadow, no gradient. Label T13 ("Back to edit", "Keep it"). Kit match: `Button variant="secondary"` draws a neutral gradient and a 2px radius (D1), height 32/36.

### 1.7 Section label

T5 in capitals as typed, for example "ADDED · 1". Kit: `PhoneFieldLabel` (phone-parts), `SectionLabel` (block2-phone-parts).

### 1.8 Bottom sheet (W2 and W5) and its scrim

| Part | Value | Token |
|---|---|---|
| Scrim | full screen 390×844, `#17151285` (neutral-950 at **52%**) | `BottomSheet scrim={52}` (the kit offers 45 or 52; 52 is right) |
| Sheet | pinned to bottom, 390 wide, `#FFFFFF`, padding 10 top, 20 bottom, 16 sides, gap 14, no radius, no border, no shadow | `BottomSheet` (max width 480, so it stays aligned) |
| Grabber | 36×4, `#D2CFC9`, centred | `SheetGrabber` (36×4, border-strong) |

### 1.9 Scroll and sticky behaviour (interpretation, not drawn)

Paper draws each phone screen at exactly 844 high with a flexible spacer (`flex-grow`) pushing the primary button to the bottom. It does not draw a screen longer than the frame. Build as: header fixed at the top, body scrolls, **the foot (buttons) sticks to the bottom** with the 20px bottom padding and a top hairline only if content scrolls under it (none drawn; propose none). Marked as a proposal in the gaps list (G20).

### 1.10 Desktop frame (W6, W7, W8)

- Page 1440×900, `#FCFCFC`. Sidebar 236 wide; content column **1204** wide.
- Sidebar (shell-owned; do not rebuild). Drawn geometry: header 56 high, padding 0 18, gap 10, bottom border `#38302A`; logo 22×22; "Wendo RMS" 13/16 600, tracking -0.01em, `#F5F3EF`; branch tag "NYERI TOWN" (W6, W7) or "ALL BRANCHES" (W8) Geist Mono 11/14 at 0.04em `#8A7F76`; group labels Geist Mono 11/14 600 at 0.06em `#8A7F76`; sub-links 13/16 400 `#B5AEA5`; the active link (Waste) 13/16 500 `#F5F3EF`, 32 high, radius 2, fill `#D9A65E` at 9% (alpha `17` in the value), a 2×32 left marker `#D9A65E`, and the curved connector rail (1px caramel-600 at 70%, a 5×5 node, an 8×1 branch); footer 52 high, avatar 24×24 radius 2 `#38302A`, name 12/16 500 `#F0EEE9`, role 11/14 `#8A7F76`. The whole sidebar uses the shell's tokens (`wds-sidebar-*`).
- Top bar 56 high, `#FFFFFF`, bottom border 1px `#E4E2DE`, padding 0 20 0 24 (`bg-wds-surface`, `border-wds-border`). Breadcrumb: "Branch" 13/16 400 `#635E57`, "/" same, current "Waste" 13/16 500 `#171512`, gap 6.
- Page body: padding-top 28, sides 32, gap 20.
- **Nav rows (nav-table.ts, not drawn by me):** Branch Manager: Branch › Waste (below Requisitions and Day). Director, Accountant, Store Manager, System Admin: Branches › Waste (below Day). I found no such rows in `frontend/components/app/shell/nav-table.ts` (a search for "waste" finds only the Central Store "Waste" sub-link and the department-head "Waste" row at `/app/branch/waste/new`). Add them there; do not touch the shell.

---

## 2. Decisions for the owner: where the shared kit differs from Paper

Numbers are Paper (left) against the code (right). Each is a decision, not a build instruction. The "default I would take" is the lean-to-Paper option, per the rule that Paper wins, except where Paper breaks another rule.

| # | What | Paper | Code today | Default |
|---|---|---|---|---|
| D1 | Primary button | Phone H50; start `#7A4217` on W1 to W5, start `#B0610F` on step 55 and in W7; end `#4A1D00`; square; no sheen; label 16/20 600 (phone), 13/16 600 (W7, 38 high, 130 wide) | `PhonePrimaryButton` H52, `wds-gradient-primary` (`#B0610F` to `#4A1D00`), 2px radius, sheen | One gradient: take the token (`#B0610F`) everywhere, because Paper itself uses it on step 55 and in W7, and the `#7A4217` start appears only on the five W-series phone screens (C1). Heights as Paper (50 and 38) |
| D2 | Radius | 0 on all boxes | Buttons 2px, `KpiStrip` 4px, cards 4px | Follow Paper (0) on these ten screens; a global change is for the owner |
| D3 | Secondary button | White, 1px `#D2CFC9`, no gradient; 44 phone, 38 dialog; 14/18 500 phone, 13/16 500 dialog | Gradient neutral-0 to neutral-200, border-strong, 32/36 high | Paper (flat white), new size variants |
| D4 | Desktop dialog scrim | `#17151299` = 60% | `bg-wds-scrim` = `rgb(23 21 18 / 0.35)` | Paper (60%), W7 only; phone sheets use `scrim={52}` |
| D5 | Reverse dialog | 500 wide, padding 24, gap 16, 1px `--color-border`, no header divider, title 20/26 600 -0.01em, ink rule above the facts table | `DecisionDialog` 600 wide (580 with eyebrow), header band with bottom border, padding 24/22 | Build W7 on `DecisionDialog`'s behaviour (focus trap, busy, returnFocus) but at Paper's 500 and layout; it needs a width prop |
| D5b | Reason chips in W7 | H34, padding 14, selected = ink fill, 13/16 600 white, no border; unselected = white, 1px `#D2CFC9`, 13/16 400; "Other, add a note" | `ChoiceChips` H32, padding 12, selected = 1.5px espresso border on espresso-50, 500 | Paper (ink fill); add a `size`/`tone` prop to `ChoiceChips` |
| D6 | Phone header height | 130 (20+4 top) | `PhoneHeader` 122 (padding-top 16 only) | Paper (130) |
| D7 | Keypad | Keys H46, panel `#EEEDEA` padding 10/12, no top border, "Delete" is the word (14/18 400), Add key 104 wide, start `#7A4217` (44%) | `Keypad` keys H48, top border border-strong, panel padding-bottom 14, Delete is an icon, Add key start mixed at 67% (about 47.8%) | Paper's 46 and the word "Delete" as drawn (keep `aria-label="Delete the last digit"` on the key) |
| D8 | KPI strip | Flat white, square, 1px outer border, per-cell: padding 14/16, gap 3, **2px top edge** (`#E4E2DE`, `#B0610F` on the "Most wasted" cell), 1px right divider; label 10/12 mono 0.06em; value mono 28/34 weight 400, no tracking | `KpiStrip`: rounded 4px, surface-raise gradient, padding 16, gap 6, no top edge, label `wds-field-label` (11/14, 0.04em), value `wds-kpi` (500, -0.01em) | Paper; extend `KpiStrip` with an `edge` accent, or write a `WasteKpiStrip`. Cannot reuse as is |
| D9 | Table toolbar (W6, W8) | Search 300×32, border `#D2CFC9`, no icon, placeholder 13/16 `#8D8982`; filters are **"Department: All ▾"** buttons H32 padding 10, 12/16, border `#D2CFC9`, **left-aligned next to the search**, Status is a dropdown, no chips | `TableToolbar`: search 240, border `wds-border`, magnifier 13px, **"Name · All" dropdowns at the right**, status as chips with counts | §4a (kit) wins on layout (it is the owner's 8 Oct rule); keep Paper's 300 search width if the owner prefers; label wording "Department · All" |
| D10 | Date filter | "Date: Today ▾", H32 padding 10, 12/16 | `DateRangePicker` trigger H32 padding 12, 13/16, `defaultPreset: 'today'` | Kit (it is the approved picker) |
| D11 | Table head and rows | Header H34, top rule 1px ink then bottom 1px `#E4E2DE`, label colour `#635E57`; rows H46 (W6) or H42 (W8), `#EEEDEA` dividers, cell text 13/16, time 12/16 mono | `Table`: `th` 34 high, one ink rule under the header, label colour **ink**, row H46, cell 13/19 | Keep the kit's header rule; use `#635E57` (T32) for header text as Paper; rows 46 on both W6 and W8 (C3) |
| D12 | Type tokens | body 14/**18**, body-sm 13/**18 or 16** (Paper token `--leading-body` = 18); KPI mono weight **400**, no tracking; text-faint `#8D8982`; sizes 15/18, 17/22, 22/28, 22/34, 26/32 | `wds-body` 14/**20**, `wds-body-sm` 13/**19**, `wds-kpi` 500 and -0.01em, `wds-text-faint` `#A8A39B`; no 15/18 or 17/22 | Fix at the token (UI_BUILD_RULES §6): body line 18, kpi weight 400; for `#8D8982` text on `#F6F5F3` the contrast is about 3.2:1, so use `text-wds-text-copy-faint` (`#756E66`) as step 54's `my-waste-screen` already does (its README says so) |
| D13 | Pager | Footer H48 on the page, no fill; 28×28 cells in Geist 12/16 (not mono); current ink fill; the other pages and arrows have a 1px `#D2CFC9` border; disabled arrow `#8D8982`; rows-per-page select H28 "10 ▾"; text "Showing 1 to 9 of 9 entries today" | `TablePager`: min-height 40 on a neutral-50 strip, 26×26 cells in Geist Mono, arrows borderless in `wds-selected-edge`, options 25/50/100 default 50, text "Showing 1–9 of 9" | Kit (UI_BUILD_RULES §4a says Paper is not redrawn for the old footer; this page's footer is the old one) |
| D14 | Touch targets on the phone | Chip H40 (W1) and H38 (W2); Reverse H34; "Edit" is text only 12/16 | The rule is 44px; the kit's toolbar chips use `max-sm:min-h-11` | Keep the drawn look, give each a 44px hit area (min-height 44 or an invisible padded hit area) |
| D15 | Success banner (W4) | 16px check icon, one line 13/18 `#2F6438`, padding 12/14, gap 10, centred | `PhoneSuccessNote`: 8px dot, bold title 14 plus 12/17 body | Build as drawn (icon plus one line); the kit note does not match |
| D16 | Sidebar active row | `#D9A65E` at 9% | `wds-sidebar-active-bg` = white at 6% | Shell's call; reported only |

---

## 3. Phone screens

### W1: Pick what was wasted (phone, 390 × 844)

Route in the nav table today: `department-waste` → `/app/branch/waste/new`. Reuse: `features/inventory/waste/department/` already holds the head's branch log (README: "moved unchanged"); the Central Store log lives in `waste/log/`. Build W1 to W3 from Paper, not from the old head screen.

**Layout, top to bottom** (all values px, from computed styles):

| Region | Values |
|---|---|
| Phone header | Section 1.4. Title "Log waste". Subtitle "What was thrown away · Kitchen" (T3, T4) |
| Body | Column, flex-grow, padding 16 top, 16 sides, **gap 14**, background canvas |
| Search | H44, padding 0 12, gap 8, white, 1px `#E4E2DE`, no radius. Glyph: a 12×12 ring (1.5px `#847E76`, radius 6) is drawn as a placeholder; use the kit's magnifier (the `SearchInput` comment states it does the same). Placeholder "Find an item" in T7. Kit: `SearchInput` is H32 with a ⌘K hint; build at 44 and pass `shortcutHint=""` |
| "YOU OFTEN LOG" | Group: gap 8. Label T5. Chip row: wrap, gap 8 |
| Chip | Padding 10 14, white, 1px `#D2CFC9`, no radius. Text T6. **Derived height 40.** Chips drawn: "Marinated chicken", "Kachumbari mix", "Milk", "Beef stew", "Pilau", "Bread rolls" |
| "ADDED · 1" | Group: padding-top 6, gap 8. Label T5 |
| Added line | H56, padding 0 14, gap 12, white, 1px `#E4E2DE`. Left column (grows): item name T8, reason T9 below it. Right: quantity and unit "3 kg" T10 |
| Spacer | flex-grow |
| Foot | Padding-bottom 20, gap 8. Primary button (1.5) H50, label "Review 1 item" |

**Strings (exact):** "Log waste" · "What was thrown away · Kitchen" · "Find an item" · "YOU OFTEN LOG" · "ADDED · 1" · "Marinated chicken" · "Expired" · "3 kg" · "Review 1 item".

**Interaction.**
- Focus order: Back, Find an item, each usual chip in reading order, each added line (if it is a button), Review. Visible focus ring `shadow-wds-ring` on every control.
- Tap a usual chip or a search result: opens the W2 sheet for that item. Typing in the search narrows results (the flow doc says grouped by category).
- The added line is the running list; its count in the label ("ADDED · 1") and in the button ("Review 1 item") follow the number of items. Plural wording ("Review 2 items") is not drawn (G2).
- "Review n items" goes to W3. The back chevron leaves the screen (nothing logged yet; ask before discarding added lines: not drawn, G2).
- Touch: chips 40 high (D14).

### W2: How much, and why (phone sheet over W1)

The sheet is open over W1 (W1 sits behind the scrim, unchanged).

| Region | Values |
|---|---|
| Scrim and sheet | Section 1.8 |
| Heading row | Flex, `align-items: end`, space-between. Left column: item name T15 ("Kachumbari mix"), unit under it T9 ("kg"). Right: **quantity box 120×52**, padding 0 12, justify end, gap 2, **1.5px `#B0610F` border**, no fill specified (white from the sheet). Value T20 ("2") and a **2×28 caret** `#B0610F` |
| "WHY?" | Group gap 8. Label T5. Chip row wrap, gap 8 |
| Reason chip | Padding 9 14, 1px border. **Derived height 38.** Unselected: white, `#D2CFC9`, T6. **Selected: fill `#171512`, border `#171512`, text 14/18 600 white** ("Spoiled" is drawn selected). Chips: "Expired", "Spoiled", "Damaged in store", "Prep error" |
| Keypad panel | Flex, padding 10 12, gap 8, fill `#EEEDEA`. Left: 4 rows × 3 keys, row gap 8, key gap 8. Right: Add key |
| Key | Grows equally (`flex 1 1 0`), **H46**, white, 1px `#E4E2DE`, flex-centre. Digits "1" to "9", ".", "0" in T21. The last key reads **"Delete"** in 14/18 400 `#171512` (a word, not an icon) |
| Add key | **104 wide**, full height of the 4 key rows (derived 4×46 + 3×8 = 208), gradient (1.5, W1 to W5 variant). Label "Add" in T22 |

**Strings:** "Kachumbari mix" · "kg" · "2" · "WHY?" · "Expired" · "Spoiled" · "Damaged in store" · "Prep error" · "1" … "9" · "." · "0" · "Delete" · "Add".

**Interaction.**
- Opens with focus on the quantity box. Keys write into it; "." allows a decimal; Delete removes the last digit.
- Choosing a reason chip selects exactly one (radio behaviour; "One per item" in W9). "Add" puts the line on W1's ADDED list and closes the sheet.
- Add should not be pressable until there is a quantity above zero and one reason chosen (not drawn, G3).
- Touch: keys 46 (above 44, fine); chips 38 (D14).
- Kit: `BottomSheet` + `SheetGrabber` + `Keypad` (with the differences in D7).

### W3: Check, then log (phone)

| Region | Values |
|---|---|
| Phone header | Title "Check and log"; subtitle "2 items · nothing has moved yet" |
| Body | Column, padding 16 top, 16 sides, **gap 14** |
| Warning note | Flex, padding 12 14, gap 10, `#FBF2E4`, 1px `#E7D3AC`. Dot 6×6, radius 3, `#8A5A16`, margin-top 5. Text T17 |
| Lines card | Column, white, 1px `#E4E2DE`. Each line: H60, padding 0 14, gap 12; the first has a 1px `#EEEDEA` bottom border. Name T8, reason T9, quantity T10, then "Edit" in T11 |
| "NOTE · OPTIONAL" | Group gap 6. Label T5. Field: H44, padding 0 12, white, 1px `#D2CFC9`; placeholder T7 |
| Spacer | flex-grow |
| Foot | Padding-bottom 20, gap 8. Primary H50 "Confirm and log waste"; secondary H44 "Back to edit" (1.6) |

**Strings:** "Check and log" · "2 items · nothing has moved yet" · "Stock goes down only when you confirm. Nothing is deleted later; a wrong entry can be reversed." · "Marinated chicken" · "Expired" · "3 kg" · "Edit" · "Kachumbari mix" · "Spoiled" · "2 kg" · "NOTE · OPTIONAL" · "Anything the Branch Manager should know?" · "Confirm and log waste" · "Back to edit".

**Interaction.** "Edit" on a line reopens W2 for it (not specified, G5). The note is optional. "Confirm and log waste" is the one step that moves stock (no PIN: W3 caption says "1 TAP · NO PIN"; the flow doc and W9 agree). "Back to edit" returns to W1. After success go to W4/step 55 with the banner (W4 shows "2 items logged at 14:20…").

### W4: My department's waste today (phone) (superseded by step 55)

Kept for the **success banner, the reversed row and the "Log more waste" button**, which step 55 does not draw. The list itself is built to step 55.

| Region | Values |
|---|---|
| Phone header | Title "Kitchen waste today"; subtitle "Wed 7 Oct 2026 · Kitchen" |
| Body | Column, padding 16 top, 16 sides, **gap 12** |
| Success banner | Flex, centre, padding 12 14, gap 10, `#EEF4EC`, 1px `#CADFC6`. Check icon SVG 16×16, stroke `#2F6438` 3px (`M5 12l5 5 9-10`). Text T18 |
| Section label | "WASTE TODAY · 3 ENTRIES" T5 |
| List card | White, 1px `#E4E2DE`. Rows **H64**, padding 0 14, gap 12, `#EEEDEA` bottom border except the last |
| Active row | Name T8, meta T9 ("2 kg · Spoiled · 14:20"), **Reverse button H34**, padding 0 14, 1px `#D2CFC9`, no fill, label 13/16 400 `#171512` |
| Reversed row | Name T8 geometry in `#8D8982` with a **1px line-through**; meta T19; right: chip "Reversed 09:12", padding 2 8, `#EEEDEA` fill, 1px `#D2CFC9`, 12/16 `#635E57`. No Reverse button |
| Foot | Padding-bottom 20. Primary "Log more waste" H50 |

**Strings:** "Kitchen waste today" · "Wed 7 Oct 2026 · Kitchen" · "2 items logged at 14:20. You can reverse your own entries today." · "WASTE TODAY · 3 ENTRIES" · "Kachumbari mix" · "2 kg · Spoiled · 14:20" · "Reverse" · "Marinated chicken" · "3 kg · Expired · 14:20" · "Milk" · "6 L · Spoiled · 09:05" · "Reversed 09:12" · "Log more waste".

**Interaction.** "Reverse" opens W5 for that row. "Log more waste" returns to W1. Banner is the post-log confirmation (its persistence is not drawn, G8).

### W5: Reverse a wrong entry (phone sheet over W4)

| Region | Values |
|---|---|
| Scrim and sheet | Section 1.8; the list behind is W4 unchanged |
| Heading | Gap 2. Title T15 "Reverse this entry?"; sub 13/16 400 `#635E57` "Kachumbari mix · 2 kg · Spoiled · 14:20" |
| "WHY? · REQUIRED" | Group gap 8. Label T5. Three radio rows, gap 8 |
| Radio row (selected) | H48, padding 0 14, gap 12, fill `#F8F2EC`, **1.5px `#B0610F` border**. Radio: 16×16, radius 8, **4px `#B0610F` border** (a filled-looking dot). Label T6 |
| Radio row (not selected) | H48, same padding and gap, white, 1px `#D2CFC9`. Radio: 16×16, radius 8, **1.5px `#A8A39B` border**, no fill. Label T6 |
| Note | Padding 10 12, `#F6F5F3`, 1px `#E4E2DE`, text T17 |
| Foot | Gap 8: primary H50 "Reverse entry"; secondary H44 "Keep it" |

**Strings:** "Reverse this entry?" · "Kachumbari mix · 2 kg · Spoiled · 14:20" · "WHY? · REQUIRED" · "Logged the wrong item" · "Wrong quantity" · "Other" · "The entry stays on record, marked reversed. The 2 kg goes back into stock." · "Reverse entry" · "Keep it".

**Interaction.** Radio group with arrow-key movement; one reason is required (W9). Reverse entry posts a linked reversal; the original stays visible, struck through with the "Reversed" chip (W4). "Keep it" or the scrim closes. Focus goes to the first radio on open and returns to the Reverse button on close. Touch: rows 48 (fine).

### Step 55: Kitchen waste, today and earlier (phone) (supersedes W4's list)

| Region | Values |
|---|---|
| Phone header | Title "Kitchen waste"; subtitle "Thu 8 Oct 2026 · Kitchen" |
| Body | Column, flex-grow, **padding 16 on all sides, gap 12** |
| Date control | A "Date: Last 7 days ▾" button, **H34, padding 0 12**, white, 1px `#D2CFC9`, label 13/16 400 `#171512` |
| Day label | "TODAY · THU 8 OCT · 3 ENTRIES" and "WED 7 OCT · 2 ENTRIES", T5 |
| Day card | White, 1px `#E4E2DE`. Rows **H62**, padding 0 14, gap 12, `#EEEDEA` between rows |
| Row | Name T8; meta T9 "2 kg · Spoiled · 14:20 · you" or "… · Joseph M." (own entries say "you", others the first name and initial). **Reverse button** (as W4, H34) only on own entries logged today; none on other people's entries or on earlier days |
| Info note | Padding 10 12, `#ECF2F5`, 1px `#C1D4DF`, text 12/16 400 `#2C5670`, 320 wide |
| Foot | Spacer, then primary "Log more waste" H50 with margin-bottom 20; **start `#B0610F`** (1.5) |

**Strings:** "Kitchen waste" · "Thu 8 Oct 2026 · Kitchen" · "Date: Last 7 days ▾" · "TODAY · THU 8 OCT · 3 ENTRIES" · "Kachumbari mix" · "2 kg · Spoiled · 14:20 · you" · "Reverse" · "Marinated chicken" · "3 kg · Expired · 14:20 · you" · "Beef stew" · "2 kg · Expired · 11:05 · Joseph M." · "WED 7 OCT · 2 ENTRIES" · "Fries portions" · "5 pcs · Prep error · 08:40 · you" · "Samosas" · "12 pcs · Expired · 17:05 · Joseph M." · "Everyone in the department sees these entries. You can reverse only your own, on the day you logged them." · "Log more waste".

**Interaction.** The date button opens a range picker; the starting range is the last 7 days and lives in the URL (UI_BUILD_RULES §4a). Days group by the day logged, newest first. Reverse opens the W5 sheet. Existing code to mirror: `features/inventory/waste/entries/components/my-waste-screen.tsx` (step 54, the same pattern for the Central Store: groups by Nairobi day, Reverse only where the server says `can.reverse`, fifty entries a page, struck-through reversed entries).

---

## 4. Desktop screens

### W6: Branch waste: every entry, with values (Branch Manager, 1440 × 900)

| Region | Values |
|---|---|
| Frame | Sidebar (1.10) plus content 1204 wide. Page title block: gap 4. Title "Waste" T23. Subtitle T24 |
| KPI strip | 1140 wide (1204 − 64). Flex, white, 1px `#E4E2DE` outer border |
| KPI cell | Flex-grow equal (285 each, derived), padding 14 16, gap 3, **2px top border `#E4E2DE`** (the third cell `#B0610F`), **1px right border `#E4E2DE`** (not on the last cell). Label T5 (the third cell's label is `#8A5A16`, `text-wds-warning-fg`); value T25 (the third cell's value is a name in T26); caption T9 |
| Toolbar | Row, bottom padding 10, gap 8: search 300×32 (padding 0 10, white, 1px `#D2CFC9`, placeholder T31), then four buttons H32, padding 0 10, white, 1px `#D2CFC9`, text T30 |
| Table header | H34, padding 0 16, white; **top 1px `#171512`, bottom 1px `#E4E2DE`**; labels T32. Columns below |
| Rows | **H46**, padding 0 16, white, 1px `#EEEDEA` bottom |
| Footer | H48, no fill, flex space-between; left text 12/16 400 `#635E57`; right group gap 16: "Rows per page" 12/16 `#635E57`, a select H28 padding 0 8 white 1px `#D2CFC9` "10 ▾" 12/16 ink; page cells 28×28, gap 4 |

**Columns (Paper):**

| Column | Width | Align | Cell type | Notes |
|---|---|---|---|---|
| TIME | 64 | left | T27 | "17:40", 24-hour |
| ITEM | 190 | left | T28 | text 13/16 weight 500 |
| QTY | 90 | **right** | T29 | "2 kg", "6 pcs", "3 L" |
| DEPARTMENT | 150 | left, **padding-left 28** | T14 | Kitchen, Pastry, Barista, Service |
| REASON | 150 | left | T14 | Expired, Spoiled, Damaged in store, Prep error |
| LOGGED BY | 120 | left | T14 | "Grace W." (first name and a last initial) |
| VALUE (KES) | 100 | **right** | T29 | "1,260", "0" for a reversed entry |
| STATUS | flex (derived 244) | **right** | 12/16 400 `#635E57` | "Reverse" for an active entry |

Derived: 64+190+90+150+150+120+100 = 864, row inner width 1108 → STATUS 244.

**Reversed row.** Fill `#F6F5F3`, 1px `#EEEDEA` bottom, all text `#8D8982` (decision D12), item name struck through with a 1px line, value "0", and in STATUS a chip: padding 2 8, `#EEEDEA`, 1px `#D2CFC9`, text 12/16 400 `#47433D`, content "Reversed 09:12 · wrong item", right-aligned.

**Active row "Reverse".** Plain text 12/16 `#635E57`, no border, right-aligned. No hover or pressed state is drawn (G7). Build it as a ghost text button with a 32px high hit area and the kit's focus ring.

**Pager (drawn: 1 page).** "‹" disabled, "1" current (28×28 fill `#171512`, text 12/16 600 white), "›" disabled. Disabled arrows: white, 1px `#D2CFC9`, `#8D8982`.

**Strings:**
- Breadcrumb: "Branch" / "Waste".
- Title "Waste"; subtitle "Everything thrown away at Nyeri Town, Wednesday 7 October. Entries are never deleted; a wrong one is reversed."
- KPI 1: "TODAY" · "4,080" · "KES · 9 entries". KPI 2: "LAST 7 DAYS" · "21,480" · "KES · 41 entries". KPI 3: "MOST WASTED · 7 DAYS" · "Marinated chicken" · "KES 3,600 · Kitchen · mostly expired". KPI 4: "REVERSED · 7 DAYS" · "2" · "Both by their own department".
- Toolbar: "Search an item or a person" · "Department: All ▾" · "Reason: All ▾" · "Status: All ▾" · "Date: Today ▾".
- Header: "TIME" · "ITEM" · "QTY" · "DEPARTMENT" · "REASON" · "LOGGED BY" · "VALUE (KES)" · "STATUS".
- Footer: "Showing 1 to 9 of 9 entries today" · "Rows per page" · "10 ▾" · "‹" · "1" · "›".
- Row status: "Reverse" · "Reversed 09:12 · wrong item".

**Example data (mock, for tests only):** 17:40 Beef stew 2 kg Kitchen Expired Grace W. 640 · 16:15 Croissants 6 pcs Pastry Expired Ann K. 480 · 15:30 Milk 3 L Barista Spoiled David M. 450 · 14:20 Marinated chicken 3 kg Kitchen Expired Grace W. 1,260 · 14:20 Kachumbari mix 2 kg Kitchen Spoiled Grace W. 360 · 11:05 Cake slices 4 pcs Pastry Damaged in store Ann K. 520 · 10:10 Sugar sachets 40 pcs Service Damaged in store John M. 120 · 08:40 Fries portions 5 pcs Kitchen Prep error Grace W. 250 · 09:05 Milk 6 L Barista Spoiled David M. 0 (reversed). The rows sort newest first by time, except the reversed row (09:05) which sits last, below 08:40. That is out of time order, so Paper puts the reversed entry at the bottom (C11).

**Interaction.**
- Search as you type, no Enter (§4a); filters and the date range live in the URL; changing any returns to page 1.
- Tab order: search, Department, Reason, Status, Date, table rows' Reverse links in reading order, rows-per-page, pager.
- "Reverse" opens W7 for that row. Only the Branch Manager sees it (W9: "hidden, not greyed, for everyone else").
- The KPI strip uses fixed periods ("Today", "Last 7 days") and does not change with the Date filter (the Central Store waste README states the same).
- Widths: Paper draws 1440 only. At 1024 the table content column is 1024 − 236 − 64 = 724 (derived) against 864 of fixed columns, so the table must scroll horizontally inside its own container (UI_BUILD_RULES §4 point 3 and §7). Wrap the KPI strip below 1024 (G16).

### W7: Reverse any entry, with a reason (desktop dialog over W6)

W6 is drawn unchanged behind a full-screen scrim 1440×900 `#17151299` (60%).

| Part | Value |
|---|---|
| Dialog | **500 wide**, position left 470, top 230 (centred; derived), padding 24, gap 16, fill `--color-surface`, 1px `--color-border`, no radius, no shadow |
| Heading | Gap 4. Title 20/26 600 -0.01em ink "Reverse this waste entry?" (T15). Sub 13/16 400 `--color-text-muted` "The original stays on record. A linked reversal is added." (T16) |
| Facts table | Top rule 1px ink. Rows: flex space-between, padding 10 0, 1px `--color-border` bottom. Label 13/16 400 `#635E57`; value 13/16 400 ink; "Value" value in mono 13/16 |
| Effect row | Gap 24, label does not shrink; value box **300 wide**, right-aligned, 13/18 400 ink, wraps |
| "WHY? · REQUIRED" | Gap 8. Label T5 (colour `--color-text-muted`). Chips row gap 8 |
| Reason chips | H34, padding 0 14. Selected: fill `--color-ink`, text 13/16 **600 white**, no border. Others: white, 1px `#D2CFC9`, text 13/16 400 ink |
| Buttons | Right-aligned, gap 10. Cancel **84×38** white, 1px `#D2CFC9`, 13/16 500 ink. Reverse entry **130×38**, gradient start **`#B0610F`** end `#4A1D00`, label 13/16 600 white |

**Strings:** "Reverse this waste entry?" · "The original stays on record. A linked reversal is added." · "Entry" · "Kachumbari mix · 2 kg · Spoiled" · "Logged by" · "Grace W. · Kitchen · 7 Oct 14:20" · "Value" · "KES 360" · "Effect" · "Kitchen stock goes up by 2 kg. The waste total drops by KES 360." · "WHY? · REQUIRED" · "Logged the wrong item" · "Wrong quantity" · "Other, add a note" · "Cancel" · "Reverse entry".

**Interaction.** Dialog traps focus, Escape and Cancel close, focus returns to the Reverse link that opened it. One reason is required before Reverse entry works (W9; the caption says "2 TAPS · NO PIN"). "Other, add a note" implies a note field that is not drawn (G14). Kit: build on `DecisionDialog` behaviour (D5, D5b).

### W8: Waste for any branch, read only (Director, Accountant, Store Manager, System Admin, 1440 × 900)

Same frame as W6 with these differences (everything not listed is as W6):

| Part | Paper (W8) |
|---|---|
| Sidebar | Tag "ALL BRANCHES"; groups OVERVIEW, BRANCHES (Day, Waste active), OPERATIONS, CENTRAL STORE, PROCUREMENT; footer "Samuel Gitau" / "Director" |
| Breadcrumb | "Branches" / "Waste" |
| Title row | Flex, `align-items: start`, space-between: left title and subtitle; right the **Branch picker**, H32, padding 0 12, white, **1px `--color-ink` border**, label 13/16 400 ink "Branch: All branches ▾" |
| Subtitle | "Everything thrown away at every branch, Wednesday 7 October. Read only: a wrong entry is reversed by its Branch Manager." |
| KPI strip | Same geometry. "TODAY" · "6,520" · "KES · 14 entries · 2 branches"; "LAST 7 DAYS" · "34,960" · "KES · 68 entries"; "MOST WASTED · 7 DAYS" · "Marinated chicken" · "KES 5,200 · mostly expired" (accent edge `#B0610F`); "REVERSED · 7 DAYS" · "3" · "Each by its own department" |
| Columns | TIME **56**, ITEM **160**, QTY **80** (right), **BRANCH 130 (padding-left 24)**, DEPARTMENT **110**, REASON **140**, LOGGED BY **100**, VALUE (KES) 100 (right), STATUS flex |
| Rows | **H42** (not 46); an active row's STATUS cell is **empty** (no Reverse link) |
| Reversed row | As W6, chip "Reversed 09:12 · wrong item" |
| Pager | "Showing 1 to 10 of 14 entries today"; "‹" disabled (`#8D8982`), "1" current, "2" white with ink text, "›" white with ink text (enabled) |

**Strings (additions to W6):** "BRANCH" header · branch names "Nyeri Town", "Karatina" in cells · "Branch: All branches ▾" · "Read only" wording above.

**Interaction.** The Branch picker narrows the table and the four figures to one branch (the KPI "2 branches" caption follows). The Branch column and filter exist only on this view. No Reverse link for anyone here (W9). A single-branch view is not drawn (G15).

### W9: The wording of Branch waste (reference table)

Not a screen to build. It is the wording source. Layout (for the record): panel padding 28, gap 48, white, 1px `--color-border`; left column 520 wide (term 170 + meaning 350), right column 480 wide (term 190 + meaning 290); headings T5 with an ink rule; terms 13/16 600 ink, meanings 13/16 400 `--color-text-muted`; row padding 9 0 with a 1px `--color-border` bottom. The text:

**THE WORDS**
- "Waste": "Something thrown away, spoiled, expired or broken. Every entry takes stock down once it is confirmed"
- "Expired · Spoiled · Damaged in store · Prep error": "The four reasons for waste. One per item"
- "Reverse": "Puts the stock back with a new linked entry. The wrong entry stays on record, struck through"
- "Logged the wrong item · Wrong quantity · Other, add a note": "The three reasons for a reversal. One is required"
- "Reversed 09:12 · wrong item": "The status of a reversed entry: the time and the reason"
- "Value (KES)": "What the waste cost. Heads and members never see it; a reversed entry shows 0"
- "Most wasted · Reversed": "Two of the four figures on the waste page, both for the last 7 days"

**BUTTONS AND MESSAGES**
- "Review 1 item · Confirm and log waste · Back to edit · Log more waste": "The phone buttons, in order. No PIN"
- "Reverse entry · Keep it · Cancel": "The reversal sheet on the phone and the dialog on desktop"
- "Stock goes down only when you confirm. Nothing is deleted later; a wrong entry can be reversed."
- "2 items logged at 14:20. You can reverse your own entries today."

**WHO DOES WHAT**
- "Department head or member": "Logs waste for their own department and reverses their own entry on the same day"
- "Branch Manager": "Reads the branch's waste with values and reverses any entry with a reason. The Reverse link is hidden, not greyed, for everyone else"
- "Director, Accountant, Store Manager, System Admin": "Read every branch's waste, with a Branch column and filter"

Its caption says "NO PER-SCREEN STATES (THE STATES KIT IS IN GROUP R)": the loading, empty and error screens come from the states kit (`shell-states.tsx`, `mobile-states.tsx`) with a per-screen wording table. That table for Branch waste is not drawn; see G12.

---

## 5. Conflicts inside Paper (two drawn places that disagree)

| # | Conflict | Where | Proposed resolution |
|---|---|---|---|
| C1 | Primary button gradient start: **`#7A4217`** on W1 to W5 vs **`#B0610F`** on step 55, W7 and the token | W1 to W5 vs 55 and W7 | One gradient, the token (D1). Ask the owner to confirm |
| C2 | Scrim: **52%** (W2, W5) vs **60%** (W7) vs token 35% | | Phone 52, desktop 60 as drawn (D4); not a conflict if both are kept |
| C3 | Row height and widths: W6 rows **46** with TIME 64 / ITEM 190 / DEPARTMENT 150 / REASON 150 / LOGGED BY 120 vs W8 rows **42** with 56 / 160 / 110 / 140 / 100 | W6 vs W8 | Build one table component with 46 rows (the kit's height) and per-view column widths: W6 as W6, W8 as W8 widths. Row height 46 on both |
| C4 | Reversed chip text: **"Reversed 09:12"** (W4, W5 behind-sheet list) vs **"Reversed 09:12 · wrong item"** (W6, W8, W9) | phone vs desktop | Use the longer text on desktop; on the phone keep "Reversed 09:12" (room), with the reason one tap away in the entry detail (G9). W9 says "the time and the reason" |
| C5 | Third reversal reason: **"Other"** (W5 phone) vs **"Other, add a note"** (W7, W9). No note field is drawn on either | | Use "Other, add a note" on both, and add the note field (G14) |
| C6 | Dates: W4, W6, W7, W8 say **Wed 7 Oct 2026**; step 55 says **Thu 8 Oct 2026** | | Mock-data dates only; show today's date |
| C7 | Header title and meta: W4 "Kitchen waste today" with meta "2 kg · Spoiled · 14:20" vs step 55 "Kitchen waste" with meta "… · you" or a name | W4 vs 55 | Step 55 supersedes (flow doc); take 55 |
| C8 | Row height: W4 rows **64**, step 55 rows **62** (same pattern) | | Take step 55 (62) |
| C9 | Who may reverse: W4 shows Reverse on every active entry; step 55 and W9 show it only on own entries logged that day | | Take step 55 and W9 |
| C10 | Reason is **required** ("WHY? · REQUIRED") but "Logged the wrong item" is drawn already selected on W5 and W7 | | Start with none selected and keep the button disabled until one is chosen (G13). The drawn selection shows the selected style, not a default |
| C11 | W6 sorts newest first but draws the reversed 09:05 entry **last**, below 08:40 | W6, W8 | Sort strictly newest first; the reversed row stays in its time position |
| C12 | Table toolbar and footer on W6 and W8 do not follow UI_BUILD_RULES §4a (dropdowns left and "Name: All ▾" vs right and "Name · All"; status as a dropdown, not chips; "Showing 1 to 9 of 9 entries today"; 10 rows per page) | W6, W8 | Decision D9 and D13: the kit's §4a layout wins, wording and fields from Paper |
| C13 | Phone sheet title "Reverse this entry?" (W5) vs desktop "Reverse this waste entry?" (W7) | | Keep both; different devices |
| C14 | In W5 the reversed chip's text is positioned absolutely inside the chip (a drawing artefact, text is `position: absolute`) | W5 | Build the chip as normal inline text |

**Paper against the flow document** (Paper wins; the document is the thing to correct):
- The flow doc says "an optional photo" and "a short summary … the effect on stock ('−3 kg Tomatoes'), then **Log it**". Paper draws **no photo control** and **no stock effect line** on W1 to W3, and the button reads **"Confirm and log waste"**. The W9 table lists no photo either.
- The flow doc says each entry "opens to show who logged it, when, reason, photo and its ledger entry". No such screen is drawn (G10).
- The flow doc says step 55 supersedes W4: confirmed by the Paper step 55 title; W4 is kept only for the banner, the reversed row and "Log more waste".

---

## 6. Gaps (not drawn) and the proposed build, built in the same style and reported, not omitted

Each is a proposal for the front-end session to build and report. None is Paper.

| # | Gap | Proposed build |
|---|---|---|
| G1 | **W1 empty list**: nothing added yet | Hide the "ADDED" group; show the primary button disabled with the label "Review items" (`disabled:opacity-60`). |
| G2 | **W1 plural and discard**: "Review 2 items"; back with items added | Label is "Review {n} item" / "Review {n} items". On back with lines, ask with the kit's confirm dialog: title "Discard these items?", buttons "Discard" and "Keep editing" (wording proposed). |
| G3 | **W2 validation**: empty or zero quantity, decimals, no reason chosen | Quantity box shows "0" muted until a digit; Add key disabled (`disabled:opacity-50`) until quantity > 0 and a reason is chosen. Error line under the box in `wds-error-fg` 12/16 for an unreadable number: "Could not read that number. Check it and try again." (the Central Store copy). |
| G4 | **Negative stock** ("allowed and flagged, never blocked", flow doc) | On W3, a line whose item would go below zero gets a warning chip "Below zero after this" in the warning style (12/16, `wds-warning-*`); never blocks. |
| G5 | **W3 per-line effect, photo, Edit behaviour, remove a line** | Effect on stock is not drawn; the Paper line shows quantity only. Edit reopens W2 prefilled. Add a "Remove" text action in the W2 sheet when editing a line (T11 style). No photo on the phone (Paper draws none). |
| G6 | **W3 saving and error** | While posting: primary shows "Logging waste" (the existing copy), disabled; on failure a `PhoneErrorNote` at the top ("Could not log it. Nothing was recorded. Try again.") with the lines kept. Idempotency key on the write. |
| G7 | **Desktop hover, focus and pressed states** for the Reverse link, rows, chips, buttons | Reuse the kit's: row hover `bg-wds-surface-sunken`, focus `shadow-wds-ring`, pressed `active:scale-[0.98]`; chips `hover:bg-wds-neutral-50`. |
| G8 | **W4 and step 55 states**: empty, loading, error, banner persistence, reversing in flight, more than a page of entries | Empty "You have logged no waste in this period." Loading "Getting your waste" (screen-mirroring skeleton, 3 rows of H62). Error "Could not load your waste. Try again." with Retry (all existing step 54 copy). The banner shows only straight after logging and clears on refresh. While reversing, the row's button shows "Reversing…" disabled. More than one page of entries: fifty a page (as step 54), with the numbered pager and never infinite scroll. |
| G9 | **Entry detail on the phone** (why a chip carries no reason) | Tapping a reversed chip opens a small sheet with "Reversed 09:12" and the reason, in the W5 sheet style. |
| G10 | **Entry detail on the desktop** ("who logged it, when, reason, photo and its ledger entry") | A right drawer (`drawer-shell`, width 480, shadow `wds-drawer`) opening from a row click or Enter, in the W7 facts-table style: Entry, Logged by, Reason, Value, Note, Ledger entry (a link), and the reversal link if reversed. Rows take focus and open on Enter or Space (kit `onRowActivate`). |
| G11 | **W6 filter options** | Department: All plus each branch department. Reason: All plus the four reasons. Status: All, Active, Reversed. Date: the kit picker with "Today" start. |
| G12 | **Loading, empty, error, filtered-empty, permission-denied for W6 and W8** | The kit `DataTable` states with a Branch waste copy table. Proposed lines (owner may edit): Loading "Getting waste"; Empty "No waste logged in this period."; Filtered-empty "No entries match. Clear filters."; Error "Could not load waste. Try again."; Permission "You can read all waste. Reversing is for the Branch Manager." Loading skeleton: the real header, toolbar and KPI strip with skeleton cells (UI_BUILD_RULES §2). |
| G13 | **W5 and W7 gating, pending and error** | Reverse entry disabled until a reason is chosen. Pending: "Reversing" (phone) and "Reversing and returning the stock" (desktop). Error: "Could not reverse it. The entry stays. Try again." / "Could not reverse it. Nothing changed. Try again." Server codes (not yours, already reversed) show the matching line inside the sheet or dialog in `wds-error-fg`. |
| G14 | **"Other, add a note" note field** (W7, W9) | When "Other, add a note" is chosen, show a one-line field below the chips: H34, 1px `#D2CFC9`, placeholder "Add a note" (13/16 `#8D8982`), required for that reason. Same field on the W5 sheet. |
| G15 | **W8 single branch, picker panel, page 2** | The Branch picker is a `Select` (H32, 1px ink border as drawn) with "All branches" and each branch; page 2 is the pager's second page. |
| G16 | **Widths between 390 and 1440** | W6 and W8 at 768 and 1024: the table scrolls horizontally in its own container; the KPI strip wraps to 2×2 below 1024. Phone screens use the 480 max-width phone column (`PhoneColumn`) above 480. |
| G17 | **Nav rows** | Branch Manager row Branch › Waste and desktop-role rows Branches › Waste in `nav-table.ts` (1.10). |
| G18 | **Reduced motion, focus order, live regions** | Sheet and dialog entrance skipped under `prefers-reduced-motion` (the kit already does this). The pager's "Showing …" is `aria-live="polite"` (the kit). Announce "Reversed" status changes with `role="status"`. |
| G19 | **W3 note growth** | The note field is drawn at one line (44). Make it a textarea that starts at 44 and grows to a 4-line cap, max 200 characters (the cap is a proposal). |
| G20 | **Phone scroll and sticky foot** | Header fixed, body scrolls, the buttons stick at the bottom with 20px padding (1.9). |
| G21 | **W6 subtitle date** | The subtitle reads "Wednesday 7 October" with the Date filter on Today; when the range changes it reads the range, for example "Everything thrown away at Nyeri Town, 1 to 7 October. Entries …". (wording proposed). |
| G22 | **Search results on W1** | Rows in the "ADDED" card style (H56), grouped under T5 category labels, with the matching letters bold (as the kit's `HighlightMatch`). No match: "No item matches. Check the spelling." (proposed). |

---

## 7. Check yourself

**Every drawn screen and state appears.** W1, W2, W3, W4, W5, step 55, W6, W7, W8 and W9 each have a section above; the cover and index are noted as non-product. Every drawn state is covered: W1 (one added line), W2 (sheet, "Spoiled" selected, "2" typed), W3 (two lines), W4 (banner, active and reversed rows), W5 (sheet, first reason selected), step 55 (own and others' entries, two days), W6 (9 rows, one reversed), W7 (dialog), W8 (page 1 of 2, no Reverse), W9 (reference). No other state is drawn; the rest are listed as gaps.

**Every number came from a tool call.** Values come from `get_computed_styles` on the drawn nodes (and `get_jsx` for token variable names and structure). Derived numbers are marked "derived" with their arithmetic. Hex values for the two oklab gradient starts and the scrim opacities were converted from the Paper values by calculation (Paper `oklab(44% 0.056 0.077)` → `#7A4217`; `oklab(57.3% 0.069 0.112)` → `#B0610F`; `#17151285` is 0x85/255 = 52%; `#17151299` is 0x99/255 = 60%).

**Not verified, honestly.** I did not look at the Paper "Group R" states kit (the generic loading, empty, error cards) directly, so the states in G8 and G12 use the existing code copy and the kit components, not a Paper drawing. I did not open the Central Store waste chapters (steps 16 to 23) to compare the clone; the branch screens were read on their own. Fonts are Geist and Geist Mono as returned by the tool; I did not run `get_font_family_info` because no Paper typography was written.
