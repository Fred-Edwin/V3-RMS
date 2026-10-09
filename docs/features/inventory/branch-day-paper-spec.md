# Branch day: Paper spec for the front-end build (Block 4)

Extracted 9 Oct 2026 on branch `docs/block4-paper-spec`. Read this before building any Branch day screen. It writes no product code and edits no Paper.

**Source.** Paper file "Wendo RMS · Approved designs", page "Inventory · Counting and closing": Chapter 1 "Open and count" (steps 0, 1, 2, 2b, 3, 3b, 3c, 4 on the phone, step 5 on desktop), Chapter 2 "Review and close" (6 to 9), Chapter 3 "The record" (10, 10b, 10c, 11, 12, 12b, 13, 13b, 13c, 13d), Chapter 4 "Exceptions and the audit trail" (14 to 18), plus the cover and the screens index. Flow and rules: [branch-day-flow.md](branch-day-flow.md) (the design log lists every batch). **Paper wins** over any document; this file is only a reading of Paper. The step numbers B0 to B18 in the brief are Paper's own step numbers (step 0 = B0, step 2b = B2b, and so on).

**How the numbers were taken.** Every size, colour, weight, spacing and string came from `get_jsx` (inline styles, which also return the Paper token names such as `--color-border`) and `get_computed_styles` / `get_node_info` on the drawn nodes. No value was read from a screenshot. Where a number is **derived** (a row height = padding + line height + border) it is marked "derived" and is arithmetic on tool values. Node ids are deliberately not shown; refer to a screen by its step.

**How to read the token column.** Class names are `wds-` Tailwind classes from `frontend/tailwind.wds.preset.ts` and `frontend/app/tokens.wds.css`; "ui2" means `frontend/components/ui2/`; "shared" means `frontend/features/inventory/_shared/components/`. **"no token: use exact value"** means the preset produces nothing equal. Spacing: the 4px scale is `wds-1`=4 … `wds-5`=20, `wds-6`=24, `wds-8`=32; any other px value (2, 3, 9, 11, 22, 28, 40, 44, 46, 48, 56, 60, 64, 68, 92, 272 and so on) is "no token: use exact value".

**Warning: Paper token names are not code token names.** Paper's `--color-primary` is `#B0610F` (code: `wds-selected-edge` / `wds-primary-btn-start`; the code's `wds-primary` is `#693C1B`, which Paper calls `--color-espresso-700`). Paper's `--color-espresso-600` is also `#B0610F`, but the code's `wds-espresso-600` is `#8B5A32`. Paper's `--color-text-muted` is `#635E57` = code `wds-text-secondary` (the code's `wds-text-muted` is `#847E76`). Always map by hex, as the tables below do.

## Owner rulings that already apply (Block 3, 9 Oct 2026; carried to Block 4 by the brief)

- Paper wins, built as **options** (props, size or tone variants) on the kit pieces **without changing the default look** of any other screen.
- The kit's **table toolbar** (UI_BUILD_RULES §4a) and the kit's **date range picker** win over Paper's drawn versions; Paper's labels and wording still apply.
- **No global token change.** Use Paper's exact values on these screens only.
- **44px hit areas on the phone**: keep the drawn look, give each control a 44px target.
- One primary-button gradient, the token start `#B0610F` (Paper draws it that way on every Block 4 button too; see 1.6, so no new decision is open).
- Gaps are built in the same style and reported, never omitted.

---

## 0. Contents and what is drawn

| Step | Screen | Device and width | Role | Frame | Drawn states |
|---|---|---|---|---|---|
| 0 | Day: where the head starts | Phone 390 | Department head or member | 390 × 844 | One: opening checked, delivery confirmed, evening count due |
| 1 | Opening count | Phone 390 | same | 390 × 844 | One: last night's 8 figures, accept or recount |
| 2 | Check the difference and sign | Phone 390 | same | 390 × 844 | One: after a recount, 7 match, 1 differs, PIN field focused and masked |
| 2b | Overnight difference recorded | Phone 390 | same | 390 × 844 | One: success note, −1 on Milk 1L |
| 3 | Count my department | Phone 390 | same | 390 × 844 | One: 5 of 8 counted, one box focused, send disabled |
| 3b | Check and sign | Phone 390 | same | 390 × 844 | One: 8 items, none blank, PIN field focused |
| 3c | See every figure | Phone 390 | same | 390 × 844 | One: all 8 figures, not sent yet |
| 4 | Count sent | Phone 390 | same | 390 × 844 | One: success note and 4-row tracker |
| 5 | Today: five departments and what blocks the close | Desktop 1440 | Branch Manager (read by all desktop roles) | 1440 × 900 | One: 4 counted, Housekeeping not counted, Close disabled |
| 6 | A department's figures (Pastry) | Desktop 1440 | same | 1440 × 900 | One: Pastry selected, 8 item rows, total row |
| 7 | Today, ready to close | Desktop 1440 | same | 1440 × 900 | One: all five counted, Close the day enabled |
| 8 | Close the day: summary and PIN | Desktop drawer (560) over Today | Branch Manager | 1440 × 900 | One: PIN field focused |
| 9 | The day is closed | Desktop 1440 | same | 1440 × 900 | One: confirmation and 5 of 43 ledger entries |
| 10 | History | Desktop 1440 | Branch Manager | 1440 × 900 | One: 7 days, page 1 of 1 |
| 10b | History across branches | Desktop 1440 | Director; Accountant, Store Manager, System Admin the same | 1440 × 900 | One: page 1 of 2, 8 of 14 |
| 10c | The date range picker open | Popover over 10 | all desktop roles | 1440 × 700 | One: Last 7 days, 2 to 8 Oct |
| 11 | The closed day file, Items tab | Desktop 1440 | Branch Manager; others read | 1440 × 1000 | One: Closed, Pastry selected |
| 12 | Correct a count | Desktop drawer (560) over 11 | Branch Manager | 1440 × 1000 | One: Flour 1 → 2, "Counted wrongly", PIN focused |
| 12b | Activity after a correction | Desktop 1440 | all desktop roles | 1440 × 1000 | One: Corrected, 5 of 10 entries |
| 13 | Documents tab | Desktop 1440 | all desktop roles | 1440 × 700 | One: 2 versions of the day sheet |
| 13b | Day sheet, page 1 of 6 (cover) | A4 portrait | all desktop roles | 794 × 1123 | One |
| 13c | Day sheet, page 4 of 6 (Pastry, corrected) | A4 | same | 794 × 1123 | One |
| 13d | Day sheet, page 6 of 6 (signatures and QR) | A4 | same | 794 × 1123 | One |
| 14 | Blocked by an unconfirmed delivery | Desktop 1440 | Branch Manager | 1440 × 900 | One: Close disabled, red Kitchen row |
| 15 | Count for a department | Desktop drawer (560) over Today | Branch Manager | 1440 × 900 | One: 4 of 6 items, "Check and sign" disabled |
| 16 | Today for any branch, read only | Desktop 1440 | Director, Accountant, Store Manager, System Admin | 1440 × 900 | One: branch picker, no Close button |
| 17 | The Audit log, with the day's actions | Desktop 1440 | Director, Accountant, Store Manager (and the Branch Manager, scoped) | 1440 × 900 | One: "Showing 6 of 38 today" |
| 18 | The wording of Branch day | Reference table, 1120 wide | everyone | 1120 × auto | Reference only, not a screen to build |

The page also has a **Cover** (1440 × 900), a **Screens index** (1808 wide: "28 screens in 4 chapters (Chapters 1 to 4), including the printed day sheet (three of its six pages are drawn). Steps B0, B2b, B3b, B3c, B10b, B10c, B12b and B13b to B13d were added during the design. Branch day has one set of screens for every desktop role: the Branch Manager acts, the other roles read. Printing a document is not an audit event."), a **Chapter 5** (1500 wide, "The Department Head's Day history", steps 19 and 20, added 8 Oct, **not in the 28 screens of the brief or the index**; section 7, decision O1) and three working-parts artboards (sidebars; do not copy). Heights of 844, 900, 1000, 700 and 1123 are the artboard's canvas, not a design requirement: real screens scroll (1.7).

---

## 1. Shared pieces

### 1.1 Colours used, and the token for each

| Paper value (Paper name) | Where | Token |
|---|---|---|
| `#FCFCFC` (`--color-bg`) | Screen background, phone page ground below header, phone header title colour | `bg-wds-canvas` |
| `#FFFFFF` (`--color-surface`) | Cards, bodies, inputs, topbar start, dialog | `bg-wds-surface` |
| `#171512` (`--color-ink`) | Ink text, ink rules, selected fill | `text-wds-text-ink` / `border-wds-text-ink` |
| `#635E57` (`--color-text-muted`) | Secondary text, mono labels | `text-wds-text-secondary` |
| `#8D8982` (`--color-text-faint`) | Placeholders, em-dashes, disabled | **no token: use exact value** (code `wds-text-faint` is `#A8A39B`, `wds-text-copy-faint` is `#756E66`; K12) |
| `#E4E2DE` (`--color-border`) | Row dividers, card hairlines | `border-wds-border` |
| `#D2CFC9` (`--color-border-strong`) | Cards, inputs, buttons | `border-wds-border-strong` |
| `#EEEDEA` (`--color-neutral-100`) | Progress track | `bg-wds-neutral-100` |
| `#F6F5F3` (`--color-neutral-50`) | Read-only field fill, "not counted" chip | `bg-wds-neutral-50` |
| `#B0610F` (`--color-primary`) | Active card edge, focus border, radio ring | `wds-selected-edge` (= `wds-primary-btn-start`) |
| `#FCF2E4` (`--color-caramel-100`) | Selected row fill, PIN focus halo | `bg-wds-caramel-100` |
| `#EFCF9E` / `#D9A65E` / `#B5823E` | Sidebar curve, active marker | `wds-caramel-300` / `-500` / `-600` |
| `#2E1806` (`--color-sidebar-top`) | Phone header ground | `bg-wds-sidebar-top` |
| `#B98A5E` (`--color-espresso-400`) | Phone header label | `text-wds-espresso-400` |
| `#4E2C14` (`--color-espresso-800`) | Avatar disc | `bg-wds-espresso-800` |
| `#EEDDCC` (`--color-espresso-100`) | Avatar initials | `text-wds-espresso-100` |
| `#693C1B` (`--color-espresso-700`) | Sidebar badge fill | `bg-wds-sidebar-badge-bg` |
| `#B5AEA5` | Phone header subtitle | `text-wds-sidebar-fg-item` |
| `#F5F3EF` | Phone header icon stroke | `text-wds-sidebar-fg-active` (stroke) |
| `#FCF7F2` | Label on every primary button | no token: use exact value (code `wds-primary-fg` is `#FCFCFC`, one step lighter; K2) |
| `#4A1D00` | Primary gradient end | `wds-primary-btn-end` |
| `#EEF4EC` / `#CADFC6` / `#2F6438` | Success | `wds-success-bg` / `-border` / `-fg` |
| `#FBF2E4` / `#E7D3AC` / `#8A5A16` | Warning | `wds-warning-bg` / `-border` / `-fg` |
| `#FBEDEB` / `#E6BEB7` / `#97281D` | Error | `wds-error-bg` / `-border` / `-fg` |
| `#1F5BAE` | Document number link (`DAY-NYR-0044`, `DSC-NYR-0007`) | no token: use exact value (the shared `DocNumber` in `block2-phone-parts.tsx` and `req-parts.tsx` already hard-code it; reuse that) |

### 1.2 Phone frame, header and foot (steps 0 to 4)

All eight phone screens are 390 × 844, `--color-bg` ground, 1px `--color-border` outline on the artboard (an artboard frame, not part of the product), `overflow: clip`, a column of: header, (optional sub-header), body (flex-grow, `--color-surface`), foot.

**Header** (`B2Header` in `shared/block2-phone-parts.tsx`; differences in K1 below). Ground `#2E1806`, padding 16 all round, gap 10 between the top row and the title block. **Derived height 116** = 16 + 28 (avatar, the tallest in the row) + 10 + 28 (title) + 2 + 16 (subtitle) + 16.

| Part | Value | Token |
|---|---|---|
| Top row | flex, centre, space-between. Left group: gap 12 | |
| Leading icon | SVG 20 × 20, stroke `#F5F3EF` 2px, round caps. **Menu** (`M4 7h16M4 12h16M4 17h16`) on steps 0, 2b, 4; **Back** (`M19 12H5M11 6L5 12L11 18`, an arrow with a shaft) on steps 1, 2, 3, 3b, 3c | `B2Header leading="menu" | "back"` (K1) |
| Label | "WENDO RMS · NYERI TOWN" Geist 12/16 400, 0.06em, `#B98A5E` | `text-wds-espresso-400` + exact size |
| Avatar | 28 × 28, radius 14, `#4E2C14`, initials Geist 11/14 400 `#EEDDCC` ("DM") | exact |
| Title | Geist 22/28 600, **−0.01em**, `#FCFCFC` | exact |
| Subtitle | **Geist Mono** 12/16 400, 0.02em, `#B5AEA5` | exact |

There is **no status bar** (rule, UI_BUILD_RULES §7a).

**Foot.** `--color-surface`, top border 1px `--color-border`, padding 14 20 20. Children gap 8. **Derived heights:** one button 1+14+48+20 = 83; button + 44 secondary 1+14+48+8+44+20 = 135; button + one 18px caption 1+14+48+8+18+20 = 109.

**Primary button** (all eight screens): full width (350 = 390 − 40), **H48**, no radius, no border, no shadow, `linear-gradient(180deg, oklab(57.3% 0.069 0.112) → oklab(29.3% 0.052 0.059))` = **`#B0610F` → `#4A1D00`** (the token `wds-gradient-primary`; Paper draws the token here, so no conflict), label Geist 15/20 **500** `#FCF7F2`. Disabled = `opacity: 0.45` on the whole button (step 3, step 5 "Close the day"). Kit: `B2PrimaryButton` is the same (H48, 15/500, 45% disabled) with a 2px radius (K2); the older `PhonePrimaryButton` (H52, 16/600, sheen) is not for this block.

**Secondary button:** full width, **H44** on step 1, **H48** on steps 2b and 4 ("Back to Day"): a conflict, C2. White, 1px `#D2CFC9`, no radius, label Geist 15/20 500 ink. Kit: `B2SecondaryButton` (K3).

**Body.** `--color-surface` (white, not the canvas) with padding 20 on steps 0, 2, 2b, 3b, 4; list-style bodies (steps 1, 3, 3c) have no padding and rows that span the full width.

### 1.3 Phone parts used more than once

| Part | Values | Kit |
|---|---|---|
| **Mono label** (L1) | Geist Mono 10/12 400, 0.06em, `#635E57`, capitals as typed ("BARISTA TODAY", "YOU COUNTED", "SIGNED BY", "YOUR PIN", "NEXT") | `SectionLabel` with a 10/12 override (K7) |
| **Count row** (steps 1, 3, 3c) | padding 10 20, gap 12, 1px `--color-border` bottom. Left (grows, gap 1): name Geist 15/20 500 ink; unit/hint Geist 13/18 `#635E57`. Right: see below. **Derived height 60** (10 + 20 + 1 + 18 + 10 + 1 border) on step 1; **61** on steps 3 and 3c because the 40px box is taller than the 39px text (10 + 40 + 10 + 1) | none in the kit (K13); build `CountRow` once for steps 1, 3 and 3c |
| **Value, step 1** (last night's figure, read only) | Geist **Mono** 16/20 400 ink, no box | exact |
| **Value box, steps 3 and 3c** (a count to type) | 64 × 40, 1px `#D2CFC9`, no radius, centred; value Geist (sans) 16/20 **500** ink. The focused box: white fill, 1px `#B0610F`, `0 0 0 3px #FCF2E4` halo, empty value shown as "–" in `#8D8982` 16/20 400; an unfilled box is white with 1px `#D2CFC9` and the same "–" | `CountBox` (K13); the touch target must grow to 44 high (Block 3 ruling: keep the look, 44px hit area) |
| **Focused row** (step 3) | row fill `#FCF2E4`, plus an inset 3px left edge `#B0610F` | `bg-wds-caramel-100` + `shadow-[inset_3px_0_0_0_#B0610F]` (the `wds-selected-edge` token) |
| **Status card** (step 0) | 1px `#D2CFC9`, padding 14 16, gap 12, align start. Done card: icon 18 × 18 green disc `#2F6438` with a white check (`M7.5 12.5l3 3 6-6.5`, 2.2px, margin-top 1); title Geist 15/20 500 ink; sub Geist 13/18 `#635E57`; gap 2 between them. **Active card:** fill `#FCF2E4`, 1px `#B0610F`, inset 3px left edge `#B0610F`, icon is a 16 × 16 ring (1.5px `#B0610F`, radius 8, margin-top 2), title 15/20 **600** | exact |
| **Success note** (steps 2b, 4) | row, gap 10, padding 12 14, `#EEF4EC`, 1px `#CADFC6`, align start. Icon 18 × 18 green disc with white check (2px). Title Geist 14/18 **600** `#2F6438`; body Geist 13/18 `#2F6438`; gap 2 | `B2Banner tone="success"` (K5) |
| **Receipt-style summary card** (steps 2, 3b) | 1px `#D2CFC9` on three sides, **2px `#171512` top border**, no radius. Section 1: padding 14 16 12, row space-between: left L1 + a 24/30 600 −0.01em title; right a chip. Following sections: 1px `--color-border` top border, padding 10 16, gap 2 | none in the kit (K14); new `ReceiptCard` |
| **Chip** | padding 3 9, 1px border, 12/16 400, no radius. Warning: `#FBF2E4` / `#E7D3AC` / `#8A5A16`. Success: `#EEF4EC` / `#CADFC6` / `#2F6438`. **Derived height 24** (3 + 16 + 3 + 2 borders); the step 5 chips are padding 2 8 = 22 | `Chip` (K6) |
| **Read-only field** (step 2/3b "SIGNED BY") | H40, padding 0 12, `#F6F5F3`, 1px `--color-border`, text Geist 14/18 ink | `Input` readOnly |
| **PIN field** | H44, padding 0 12, white, **focused: 1px `#B0610F` + `0 0 0 3px #FCF2E4`**, value "••••" Geist Mono 18/22, letter-spacing 0.3em, ink. Label above (L1), gap 6 | `PinField` (K9) |
| **Tracker row** (step 4) | row, gap 10, centre. Done: 16 × 16 green disc, white check (2.4px); text Geist 14/18 ink (the latest done row 500). Pending: 16 × 16 ring 1.5px `#D2CFC9` radius 8; text Geist 14/18 `#635E57`. Container gap 12 | `B2Tracker` (K10) |

### 1.4 Desktop frame (steps 5 to 9, 14 to 17)

- Page 1440 × 900 (steps 11, 12, 12b, 13 are 1000 high; 10c 1440 × 700), `--color-bg`. Sidebar 236 wide (shell-owned; do not rebuild). Content column 1204 wide.
- **Sidebar geometry as drawn** (identical to Branch waste's, see [branch-waste-paper-spec.md](branch-waste-paper-spec.md) 1.10): header 56, padding 0 18, gap 10, bottom border `#38302A`, logo 22 × 22 radius 11, "Wendo RMS" 13/16 600 −0.01em `#F5F3EF`, branch tag "NYERI TOWN" Geist Mono 11/16 0.04em `#8A7F76`; groups OPERATIONS, MANAGE, OTHER INCOME, **BRANCH** (open), CENTRAL STORE, PROCUREMENT: label Geist Mono 11/16 600 0.06em `#8A7F76`, 24 high, margin-top 16 (8 for the first); sub-links 13/16 400 `#B5AEA5`, 32 high; the active link (Day) 13/16 500 `#F5F3EF`, fill `#D9A65E` at 9% (`#D9A65E17`), radius 2, a 2 × 32 left marker `#D9A65E`; sub-sub links Today (500, `#FCFCFC`) / History (`#EFCF9E` at 85%) 26 high; **Day** has the two sub-links Today and History; Waste is a separate row under Day; footer 52 high, avatar 24 × 24 radius 2 `#38302A`, name 12/16 500 `#F0EEE9`, role 11/16 `#8A7F76`. Branch Manager footer on these screens: "Peter Njoroge" / "Branch Manager". Tokens: `wds-sidebar-*`; this is the shell's job, no page work.
- **The badge** on Today: 18 high, min-width 18, padding 0 5, radius 2, `#693C1B` fill, "1" in Geist Mono 11/16 600 `#EBDFD6` (`wds-sidebar-badge-*`). It shows on step 5 only. Steps 6 and 7 have none (text search of their sidebars), and **step 14 draws none although the day is blocked** (a text search of its sidebar for "1" finds nothing: C31). It counts what blocks the close. Not specified further (G12).
- **Top bar:** 56 high, gradient `#FFFFFF → #FCFBF9` (`wds-gradient-topbar`), 1px `--color-border` bottom, padding 0 24, gap 16. Breadcrumb (gap 8): crumbs Geist 13/16 400 `#635E57`, "/" in system-ui 13/16 `#8D8982`, current Geist 13/16 500 ink. Then a **search box** (grow, max-width 420, H32, padding 0 10, gap 8, white, 1px `--color-border`, radius 2): a 12 × 12 ring glyph (1.5px `#8D8982`), placeholder "Search a day" 13/16 `#8D8982`, "⌘K" Geist Mono 11/14 `#8D8982` pushed right. Kit: `SearchInput` is the same component the toolbar uses; this is a top-bar search (UI_BUILD_RULES §4a); see G9 for what it searches.
- **Page body:** padding-top 28, sides 32, gap 20. **Page title:** Geist 24/30 600 −0.01em ink; under it (gap 4) a line Geist 14/18 `#635E57`, with the document number as a `#1F5BAE` Geist Mono 14/18 underlined link (1px underline).
- **Cards** (department cards on Today): white, 1px `#D2CFC9`, no radius, padding 16, gap 10. Chips and rules as 1.3.
- **Desktop primary button:** gradient as the phone, **H40**, padding 0 20, label Geist 14/18 500 `#FCF7F2`, disabled 0.45 opacity (step 5). Kit: `Button` default is H32 / 13px; use `size="lg"` (36) as a base and add an `xl`/40 size, shape `square`.

### 1.5 Differences between the shared kit and Paper (decisions, with a recommended default)

The Block 3 rulings (above) decide the policy, so each line is the numbers and the recommended build; the owner only needs to act where it says "owner".

**Finding that shrinks this table:** the Block 4 phone screens are drawn in the same family as Block 2 (dispatch and deliveries). The Block 2 phone kit in `shared/block2-phone-parts.tsx` (`B2Header`, `B2PrimaryButton`, `B2SecondaryButton`, `B2Footer`, `B2Banner`, `Chip`, `RefLink`, `TextAction`, `ReadField`, `PinField`, `B2Tracker`, `SectionLabel`) already matches Paper's Block 4 header, footer and buttons almost number for number. **Build the phone screens on that kit**, not on `PhoneHeader` / `PhonePrimaryButton` (those are the older Central Store shell). The old code in `features/inventory/branch-day/` (`todays-day-screen`, `department-count`, `opening-sheet`, `reopen-day`, and so on) is the legacy flow: replace it, do not extend it.

Numbers are Paper (left) against the code (right).

| # | What | Paper (Block 4) | Code today | Recommended default |
|---|---|---|---|---|
| K1 | Phone header | Padding 16, gap 10; icon 20 stroke `#F5F3EF`; label Geist 12/16 0.06em `#B98A5E`; avatar 28 radius 14, Geist 11/14 `#EEDDCC`; title 22/28 600 −0.01em `#FCFCFC`; subtitle Geist Mono 12/16 0.02em `#B5AEA5`. Menu glyph `M4 7h16M4 12h16M4 17h16` | `B2Header mono` is identical in every number. Differences: icon colour `text-wds-neutral-50` = `#F6F5F3` (Paper `#F5F3EF`, one step; invisible), menu glyph `M3 6h18M3 12h18M3 18h18` (Paper's bars span x 4 to 20 at y 7, 12, 17; the kit's span 3 to 21 at y 6, 12, 18) | Use `B2Header` with `mono`, `place="NYERI TOWN"`. No change to the kit; if the owner wants the glyph exact, change the path (a 1-line kit edit that touches Block 2's screens too: owner) |
| K2 | Phone primary | H48, full width, token gradient `#B0610F → #4A1D00`, 15/20 500, **radius 0**, label `#FCF7F2`, disabled 45% | `B2PrimaryButton`: h-12, `wds-gradient-primary`, 15/20 500, **radius 2px**, label `wds-primary-fg` = `#FCFCFC`, disabled 45% | Use `B2PrimaryButton`. Radius 2 vs 0 and the label hex (`#FCF7F2` vs `#FCFCFC`) are the only differences; take the kit (rulings: the kit's default look is kept; Block 3 added a square option only where its own screens needed it). Offer `rounded-none` as a class override if the owner wants Paper's 0 |
| K3 | Phone secondary | Flat white, 1px `#D2CFC9`, 15/20 500, H44 (step 1) or H48 (2b, 4) | `B2SecondaryButton`: `PHONE_SECONDARY_BUTTON` + `h-12`, 15/20 500, hover/pressed states | Use `B2SecondaryButton`; pass `className="h-11"` for step 1. C2 below |
| K4 | Phone footer | 1px `#E4E2DE` top, padding 14 20 20, gap 8, note 13/18 centred `#635E57` | `B2Footer`: `border-t border-wds-border px-5 pb-5 pt-3.5 gap-2`, note 13/18 centred | Identical. Use as is |
| K5 | Success note | Padding 12 14, gap 10, `#EEF4EC` / `#CADFC6`; an 18 × 18 green check disc; title 14/18 600 `#2F6438`; body 13/18 **`#2F6438`** | `B2Banner tone="success"`: padding 14 16, gap 6, an 8px dot, title 15/20 600, body 14/20 **ink** (compact: 12/16, title 14/18, body 13/18 ink, gap 3) | Paper wins as options: add `icon="check"` and `bodyTone="tone"` and `size="note"` to `B2Banner` (defaults unchanged) |
| K6 | Chip | Padding 3 9 + 1px border = **24 high** (steps 2, 3b) or padding 2 8 = **22** (step 5); 12/16; square dot (6 × 6, no radius) | `Chip`: `px-2 py-[2px]` = 22, round dot, tones neutral/success/warning/info/error | Use `Chip`; add a `size="lg"` (3 9) and a `shape="square"` dot as options. "Not counted" is `#F6F5F3` with a 6 × 6 square ring (1.5px `#8D8982`) and sits on a card with a **dashed** 1px `#8D8982` border; kit `neutral` is `bg-wds-neutral-100`: add `tone="muted"` (50 fill) |
| K7 | Mono label | Geist Mono 10/12 0.06em `#635E57` | `SectionLabel` is 11/14; `B2Tracker` overrides to 10/12; `PhoneFieldLabel` is 10/12 but **ink** | `SectionLabel className="text-[10px] leading-3"` (as `B2Tracker` does) |
| K8 | Read-only field | H40 (14/18 + 2 × 10 + 2 border = 40), `#F6F5F3`, 1px **`#E4E2DE`** | `ReadField`: label 11/14, box `border-wds-border-strong` (`#D2CFC9`) | Use `ReadField`; the border is one step darker (invisible); label 11 vs Paper 10: pass the size |
| K9 | PIN field | Label 10/12; box **H44**, 1px (focus) `#B0610F` + `0 0 0 3px #FCF2E4`; bullets **Geist Mono 18/22**, tracking 0.3em | `PinField`: label 11/14; box 46 high (`p-3` + 20 line + 2 border), **sans 18/20, tracking 0.5em**; focus border `border-wds-primary` = **`#693C1B`**, not Paper's `#B0610F` | Use `PinField` with options `size="paper"` (H44, mono, 0.3em) and fix the focus colour to `wds-selected-edge` (a bug against Paper) |
| K10 | Tracker (phone, step 4) | 16 × 16 discs; done = green disc, white tick 2.4px; pending = 1.5px `#D2CFC9` ring; rows gap 12; latest done row weight 500; no heading | `B2Tracker`: 20 × 20 discs, tick 3, `CURRENT` = ringed disc + dot (600), heading label | Add `size="sm"` (16) and `currentStyle="done-bold"` options; no heading |
| K11 | Pager (desktop tables) | see step 10 | `PagerBar` (32 cells) and `TablePager` | decided per step |
| K12 | Faint grey | `#8D8982` | `wds-text-faint` `#A8A39B`, `wds-text-copy-faint` `#756E66` | `text-wds-text-copy-faint` for copy a person reads; exact `#8D8982` only for placeholders and the "–" glyph (the Block 3 D12 ruling: no token change) |
| K13 | Count box | 64 × 40, sans 16/500; focused = white, 1px `#B0610F`, halo | none (the dispatch pack stepper is `h-11 w-16 border-y`, 20/600: different) | New `CountBox` in `features/inventory/branch-day/`; hit area 44 high via a padded wrapper |
| K14 | Status card, receipt card | see 1.3 | none | New, in the same folder; offer to `_shared` afterwards |
| K15 | Document-number link | `#1F5BAE` mono underlined: 13/18 (rows), 14/18 (page subtitle) | `RefLink` 13/18 (no size prop) | `RefLink className="text-[14px]"` on the page subtitle |
| K16 | Desktop drawer (steps 8, 12, 15) | **560** wide, 1px ink left border, no shadow; header padding 24 28 18 (step 15: 16), 1px `#E4E2DE` bottom; title 20/26 600 −0.01em **above** the context line (13/18); close glyph 20 (`#635E57`) at the right (not on step 15); body padding 20 28 (step 15: 16 28); footer padding 16 28 22: **text-link Cancel** (14/18 500 `#B0610F`) at the left and a **H44** primary of natural width (padding 0 28) at the right; scrim **45%** | `DrawerShell paper`: 520/540 wide, 28 padding, 18 gap, context line (mono 11/14 uppercase) **above** a 22/28 title, **secondary button Cancel** at the left (H44) and a growing primary, no close glyph, scrim 35% (`wds-scrim`) | Paper wins as an option: `DrawerShell variant="day"` (`paperWidth={560}`, title above the context line, close glyph, link Cancel, natural-width primary, `scrim={45}`). Default drawers unchanged |
| K17 | Table toolbar and pager (steps 10, 10b, 17) | Search H36 / W320, filters as H36 buttons "Name: All ▾" at the left; pager centre (32 cells, mono), rows-per-page right (select, "25", "8") | `TableToolbar` (search 240, "Name · All" dropdowns at the right, status chips) and `TablePager` ("Showing 1–50 of 142" left; Rows per page and numbers right; 26 cells, default 50 rows) | **Kit wins** (Block 3 rulings D9 and D13, UI_BUILD_RULES §4a). Paper's labels and wording apply: "Search by day number", "Date: Last 7 days", "Status", "Branch". Day history rows are two-line (67): add a `TableRow` option `size="two-line"` |
| K18 | Desktop file tracker (step 11) | one-line strip: three done items (green 16 disc + 13/18 text) and an info chip at the right | `dispatch/components/desktop/progress-tracker.tsx` (stepper) and `purchasing/components/compact-tracker.tsx` | New `DayTracker` (3 items + chip) in `features/inventory/branch-day/`; not the dispatch stepper |
| K19 | Desktop tabs (11, 12b, 13) | tab padding 10 14, 14/18; active ink 600 with a **2px `#B0610F`** underline on a 1px ink rail; counts mono 12/16 `#635E57` after the label, gap 8 | no shared desktop tab component in `ui2` (the dispatch/purchasing files have their own; `B2TabBar` is the phone one) | New `FileTabs` in `features/inventory/branch-day/_shared/`; offer to the kit |
| K20 | Audit log area filter (17) | **Chips** (H32, ink fill when selected) for All areas, Catalog, Purchasing, Requisitions, Dispatch, Discrepancies, Branch day, Branch waste, then Branch, Who, Date buttons | `audit-log/components/area-menu.tsx`: a **menu** (All areas, Central Store areas, Branches areas), plus Branch, Who and the shared date picker; steps 35, 58 and 59 of Paper | Keep the menu, add the five Branches areas (owner decision O3) |
| K21 | Two-pane (steps 6, 11) | rail 272 (step 6) or 240 (step 11), 1px ink dividers, pane padding 20 24 or 16 20 | no shared two-pane component | New `DepartmentPane` used by both screens: one set of numbers (take step 6's 272 and padding 20 24; C14) |
| K22 | Doc print frame (13b to 13d) | A4 794 × 1123, navy band, `px-12`, footer rule | `dispatch/components/desktop/delivery-note-print-screen.tsx` (`PageShell`, `paginateNote`, QR) and `counting/print/components/print-frame.tsx` (points-based, tokens) | Reuse the delivery note's frame (it already is the approved LPO template); write a `paginateDaySheet` beside it |

(Owner rulings D4, D5, D9 to D11, D13 and the D12 note are Block 3 decisions; K16 and K17 apply them.)

### 1.6 Primary button gradient: checked, no conflict

Every Block 4 primary button starts at `#B0610F` (`oklab(57.3% 0.069 0.112)`) and ends at `#4A1D00`: all eight phone screens, steps 5, 7, 8, 9, 11, 12, 14, 15 and the drawers. The Block 3 `#7A4217` start does not appear in this block, so Block 3's decision D1 needs no new ruling here. (The full conflicts list is section 8.)

### 1.7 Scroll and sticky behaviour (interpretation, not drawn)

Paper draws each phone screen at exactly 844 high with the body `flex-grow`, `min-height: 0` and (steps 1, 3, 3c) `overflow: clip`. Build as: header fixed, **body scrolls**, **foot sticks to the bottom** (its own top border is the separator; it is drawn, not a new rule). On steps 1, 3 and 3c the list is the scroller; on step 3 the progress strip (5 of 8 counted) is **sticky below the header** (it sits between header and list in the drawing, and its ink bottom border works as the rule). Desktop pages scroll as one column below the top bar; the two-pane (steps 6 and 11) keeps its rail fixed (G27).

---

## 2. Phone screens (steps 0 to 4)

### Step 0: Day, where the head starts (phone, 390 × 844)

Role: Department head or member. Route: the "Day" row of the head's phone drawer (`branch-day-flow.md`: "heads and members get Count and Waste in the phone drawer").

| Region | Values |
|---|---|
| Header | 1.2, menu icon. Title "Day". Subtitle "Barista · Wed 7 Oct · DAY-NYR-0044" (mono 12/16) |
| Body | white, padding 20, gap 14 |
| Label | "BARISTA TODAY" (L1) |
| Done card 1 | status card (1.3): title "Opening checked", sub "7:17 am · Milk 1L was 1 less" |
| Done card 2 | title "Delivery confirmed", sub "3:35 pm · 1 short, held for the Store Manager" |
| Active card | fill `#FCF2E4`, edge `#B0610F`, ring icon; title "Evening count" (15/20 600); sub "8 items. Count what is on the shelves; nothing is shown to count against." (wraps to two lines) |
| Note | Geist 13/18 `#635E57`: "In the morning the first card reads Check the opening and opens step 1. The day closes once every department has counted." |
| Foot | one primary button (H48) "Count your department" |

**Derived card heights:** done card 70 (14+20+2+18+14+2 borders); active card 88 (14+20+2+36+14+2).

**Strings (exact):** Day · Barista · Wed 7 Oct · DAY-NYR-0044 · BARISTA TODAY · Opening checked · 7:17 am · Milk 1L was 1 less · Delivery confirmed · 3:35 pm · 1 short, held for the Store Manager · Evening count · 8 items. Count what is on the shelves; nothing is shown to count against. · In the morning the first card reads Check the opening and opens step 1. The day closes once every department has counted. · Count your department.

**Interaction.**
- Focus order: menu, the three cards are **not** controls (only the active card's button is), then "Count your department".
- The note below the cards is a design note to the builder, not product copy ("opens step 1"). Build the **morning state** it describes: before the opening is checked, the first card is the active one, titled "Check the opening", sub "Last night's figures, signed on {time}. Check the shelves." (proposed, G1), button "Check the opening" opening step 1. Do not print the note.
- The button opens step 3 (blind count). The middle card state when the delivery is not yet confirmed is not drawn (G2).
- Touch: the button is 48.

### Step 1: Opening count (phone)

Header: back icon, title "Opening count", subtitle "Barista · Wed 7 Oct · 8 items".

| Region | Values |
|---|---|
| Sub-header | white, padding 16 20 14, gap 4, **1px ink bottom border**. Title Geist 17/22 600 ink "Same as last night?". Body Geist 13/18 `#635E57` "These are the figures signed when the Barista day closed on Tuesday at 7:31 pm. Check the shelves, then accept or recount." |
| List | white, grows, no padding. 8 count rows (1.3) with the **Mono value** (read-only): Coffee beans 1kg / Bags / 12; Milk 1L / Packets / 8; Sugar 2kg / Packs / 6; Cocoa powder 1kg / Tins / 3; Vanilla syrup 750ml / Bottles / 4; Paper cups 12oz / Sleeves / 10; Coffee filters / Boxes / 3; Napkins / Packs / 8 |
| Foot | primary "Yes, same as last night"; secondary H44 "No, I'll recount" (gap 8) |

**Interaction.** "Yes, same as last night" accepts: 1 tap, **no PIN** (flow doc). "No, I'll recount" starts the blind recount; the flow doc says it "uses the step 3 screen" but Paper draws no recount screen and step 3's words are the evening's (C5, G28). The list shows last night's figures, so it is **not blind**; only the recount is blind. 8 rows × 60 = 480 fits 844 with no scroll; with more items the list scrolls under the sticky header and above the sticky foot.

### Step 2: Check the difference and sign (phone)

Header: back, title "Record the opening", subtitle "Barista · recount · 8 items". Body white, padding 20, gap 16.

| Region | Values |
|---|---|
| Receipt card | 1.3. Top: L1 "YOU COUNTED", title "8 items" (24/30 600 −0.01em), warning chip "1 difference". Section: green check (14 × 14, 2.4px, `#2F6438`) + "7 items match last night" Geist 13/18 500 ink, then (indented 22) "Beans, Sugar, Cocoa, Syrup, Cups, Filters, Napkins" 13/18 `#635E57`. Differences block: fill `#FBF2E4`, 1px `#E7D3AC` top border, padding 10 16 12, gap 2: "Milk 1L · 1 less than last night" 13/18 500 ink; "Signed last night: 8 packets. You counted: 7." 13/18 `#8A5A16` |
| Note | 13/18 `#635E57`: "The day starts from what you counted. The Branch Manager sees the difference on Today." |
| SIGNED BY | L1, read-only field "Barista Department Head" |
| YOUR PIN | L1, PIN field focused, "••••" |
| Foot | primary "Record the opening" |

**Interaction (the PIN flow).** Focus lands on the PIN field when the screen opens (it is drawn focused). 4 digits (four bullets drawn); numeric keyboard (`inputMode="numeric"`, `autoComplete="off"`, masked: `PinField` already does this). The button is enabled when 4 digits are entered. On success go to step 2b. A wrong PIN: not drawn (G3). The sign is "2 taps" (the pill above the screen: "2 TAPS": type PIN, tap). The name read-only field shows the signed-in user and their title.

### Step 2b: Overnight difference recorded (phone)

Header: **menu**, title "Opening recorded", subtitle "Barista · Wed 7 Oct · 7:17 am". Body gap 16.

| Region | Values |
|---|---|
| Success note | title "Counted and signed at 7:17 am"; body "The Barista day starts from your count." |
| Summary card | 1px `#D2CFC9`. Row 1: padding 12 16, space-between: "Items that match last night" Geist 14/18 ink; "7" Geist Mono 14/18 ink. Row 2: fill `#FBF2E4`, 1px `#E7D3AC` top border, padding 12 16, space-between: left "Milk 1L" 14/18 500 ink and "8 last night, 7 this morning" 13/18 `#8A5A16`; right "−1" (U+2212) Geist Mono 14/18 **600** `#8A5A16` |
| Note | "The Branch Manager can see the difference, with your name against it. Nothing else is needed from you." 13/18 `#635E57` |
| NEXT | padding-top 4, gap 10: L1 "NEXT"; a row with an 8 × 8 **square** marker (1.5px `#D2CFC9`, no radius) and "This evening: count your department" 13/18 ink |
| Foot | secondary **H48** "Back to Day" (the only button; flat) |

Conflict C4: the "NEXT" marker is an 8 × 8 square here and a 16 × 16 ring on step 4. Take the 16 ring (step 4's pending marker) so the two screens read the same.

### Step 3: Count my department (phone)

Header: back, title "Count your department", subtitle "Barista · Wed 7 Oct · 8 items".

| Region | Values |
|---|---|
| Progress strip | white, padding 14 20 12, gap 8, **1px ink bottom border**. Row (baseline, space-between): "5 of 8 counted" Geist 15/20 600 ink; "Count what is on the shelves" 13/18 `#635E57`. Bar: 4 high, full width, track `#EEEDEA`, fill ink, width `round(62%, 1px)` (5/8 = 62.5%, derived) |
| List | 8 count rows (1.3) with the **value box**. Hints are "Count in bags / packets / packs / tins / bottles / sleeves / boxes / packs". Values entered: 9, 14, 5, 2, 3. Row 6 (Paper cups) is the focused row: `#FCF2E4` with the edge, box focused and empty ("–"). Rows 7 and 8 empty ("–") |
| Foot | primary, disabled (opacity 0.45), "Check and sign"; under it, centred, 13/18 `#635E57`: "3 items still to count." |

**Interaction.** Blind: no expected figure anywhere. The box takes a number (decimals if the unit allows; whole numbers shown); Enter / the keypad's Next moves to the next empty row; the progress strip and the helper count update live ("N items still to count."; at zero the caption goes and the button is enabled). "Check and sign" opens step 3b. Empty boxes are "–", never "0": zero must be typed (flow doc: "empty boxes"). Touch: the box is 40 high, give a 44 hit area (Block 3 ruling: keep the look, 44px hit area); the row itself is the larger target (61). Value font: sans 16/500 (C6 against step 1's mono).

### Step 3b: Check and sign (phone)

Header: back, title "Check and sign", subtitle "Barista · Wed 7 Oct · 8 items". Body gap 16, padding 20.

| Region | Values |
|---|---|
| Receipt card | L1 "YOU COUNTED", title "8 items", success chip "None left blank". Sections (1px top border, padding 10 16, gap 2): "Drinks and dry goods · 5 items" 13/18 500 ink; "Beans, Milk, Sugar, Cocoa, Syrup" 13/18 `#635E57`, **width 300**; "Serving supplies · 3 items"; "Cups, Filters, Napkins". Last section (padding 10 16): link "See every figure" Geist 13/18 **500 `#B0610F`** (Paper `--color-primary`; code `wds-selected-edge`), opens step 3c |
| Note | "The Branch Manager reviews your department and closes the day. You will not be shown what was expected." |
| SIGNED BY / YOUR PIN | as step 2 |
| Foot | primary "Send to the Branch Manager" |

The group names are placeholders until the catalogue categories are used (flow doc). "3 TAPS: CHECK, PIN, SEND" (the pill) is the tap budget.

### Step 3c: See every figure (phone)

Header: back, title "Every figure", subtitle "Barista · 8 items · not sent yet". Body: 8 count rows with value boxes (9, 14, 5, 2, 3, 7, 2, 6), units without "Count in", **no focus row**, all boxes with a 1px `#D2CFC9` border. Foot: primary "Back to check and sign".

The pill says "TAP A FIGURE TO CHANGE IT" but no edit state is drawn: tapping a box turns it into the focused box of step 3 (same look: white, 1px `#B0610F`, halo) and shows the device number keyboard (G4). Changing a figure keeps the screen; "Back to check and sign" returns to 3b with the new total. Conflict C7: the list is the same shape as step 3 but has no progress strip and no helper count; build one component with a `mode` (`count`, `review`).

### Step 4: Count sent (phone)

Header: menu, title "Count sent", subtitle "Barista · Wed 7 Oct · 6:52 pm". Body gap 16, padding 20.

| Region | Values |
|---|---|
| Success note | title "Counted and signed at 6:52 pm"; body "8 items sent to the Branch Manager." |
| Tracker | 4 rows, gap 12 (1.3): done "Opening checked · 7:17 am" · done "Delivery confirmed · 3:35 pm" · done (500) "Evening count signed · 6:52 pm" · pending (muted) "Branch Manager closes the day" |
| Note | "If you got a figure wrong, tell the Branch Manager. They can correct one item after the day is closed." |
| Foot | secondary H48 "Back to Day" |

Only the head's own slice (no other department's progress), per the flow doc.

---

## 3. Desktop screens, chapter 1 and 2

### Step 5: Today, five departments and what blocks the close (Branch Manager; read by all desktop roles; 1440 × 900)

Frame: 1.4. Breadcrumb "Branch / Day" (Day current). Top-bar search placeholder "Search a day". Title "Today". Under the title: "Nyeri Town · Wednesday 7 October ·" then link `DAY-NYR-0044`.

| Region | Values |
|---|---|
| Department cards row | flex, gap 12, five cards `flex: 1 1 0` (derived width (1140 − 4×12) / 5 = **218.4**). Card: 1.4 card; name Geist 16/20 **600** ink; under it (gap 1) the head's name Geist 13/18 `#635E57`; **state chip** (align start): Counted = success chip with a 6 × 6 `#2F6438` **square** dot (no radius) + "Counted" 12/16; Not counted = `#F6F5F3` fill, 1px `#D2CFC9`, a 6 × 6 square ring (1.5px `#8D8982`) + "Not counted" 12/16 `#635E57`. Then a rule (1px `--color-border` top, padding-top 12, gap 2): L1 "USED TODAY (KES)", value Geist Mono **20/26** 400 ink. Then "Counted 6:20 pm" 13/18 `#635E57` (not counted: "Waiting for the count"). Then an **exceptions slot 22 high** (an empty spacer when none; else a warning chip). Then the link "Open figures →" Geist 13/18 500 ink. **Not counted card:** 1px **dashed** `#8D8982` border, value "–" in `#8D8982`, link text "No figures yet" `#8D8982` (not a link) |
| Cards drawn | Kitchen · Grace W. · Counted · 24,380 · Counted 6:20 pm; Barista · David M. · Counted · 11,940 · Counted 6:52 pm · warning chip "Opening 1 less · Milk 1L" (H22, padding 0 8); Pastry · Ann K. · Counted · 8,760 · Counted 6:35 pm; Service · John M. · Counted · 3,120 · Counted 6:41 pm · warning chip "Opening not checked"; Housekeeping · Mary N. · Not counted · – · Waiting for the count |
| Blockers block | column. Header: padding-bottom 12, **1px ink bottom border**, space-between: left "Before the day can close" Geist 15/20 600 ink; sub "1 thing to do. 1 more to know about." 13/18 `#635E57` (gap 2); right the **Close the day** button (H40, padding 0 20, 14/18 500 `#FCF7F2`, gradient, **disabled opacity 0.45**) in a column (gap 4, align end, with room for a reason line under it, G5) |
| Blocker rows | each: padding 14 8, gap 14, 1px `--color-border` bottom, align start. Icon 18 × 18 (margin-top 1); title Geist 14/18 500 ink; sub 13/18 `#635E57` (gap 2). **OK** row: green check disc. Text: "Every delivery is confirmed" / "Five departments counted what arrived. One discrepancy is open, which does not block the close:" followed inline by link `DSC-NYR-0007` (mono 13/18). **Blocking** row: fill `#FBEDEB`, 1px `#E6BEB7` bottom border, red disc `#97281D` with a white "!" (2.4px): "Housekeeping has not counted" / "This blocks the close. The Housekeeping Department Head, or any active member of the department, can count it now." **Heads-up** row: amber ring icon (`#8A5A16`, 2px) with "!": "Opening not checked: Service" / "The Service day ran on last night's closing figure. This does not block the close." |

**Strings (exact):** as above plus the pill text "1 DEPARTMENT STILL TO COUNT". The state chips: Counted, Not counted (+ exceptions: "Opening 1 less · Milk 1L", "Opening not checked"; card chips from the wording table in step 18: Counted, Not counted, Opening not checked, Opening 1 less).

**Interaction.**
- Tab order: topbar search, five "Open figures →" links (the Housekeeping one is not focusable), the DSC link, the Close button (disabled: `aria-disabled` and still focusable with the reason announced, G5).
- "Open figures →" opens step 6 with that department selected. A card is not clickable as a whole; only the link (keep it so; add a 44 high hit area? not needed on desktop).
- Close the day is **disabled** while a department has not counted or a delivery is unconfirmed; enabled otherwise (step 7). The reason it is disabled is the red row, not a tooltip.
- The cards update live by socket (counts arriving) with a `role="status"` announcement ("Housekeeping counted"), G6.
- Hub role view: step 16.

### Step 6: A department's figures (Pastry; 1440 × 900)

Breadcrumb "Branch / Day / Pastry". Title "Today's figures" (same line below). Two-pane: container top border 1px ink, flex-grow.

| Region | Values |
|---|---|
| Rail | **272 wide**, 1px ink right border. Department rows: padding 14 16, gap 3, 1px `--color-border` bottom; top line (space-between): name Geist 14/18 600 ink; value Geist Mono 13/16 ink; second line (gap 6): 6 × 6 `#2F6438` dot (square) + "Counted 6:20 pm" 12/16 `#635E57`. **Selected row (Pastry): fill `#FCF2E4`, inset 3px left edge `#B0610F`**. Footer pinned to the bottom (margin-top auto): top 1px ink, padding 14 16, space-between: L1 "BRANCH USED VALUE (KES)" and "50,060" Geist Mono 14/18 600 |
| Pane | flex-grow, padding 20 24, gap 16. Head (space-between, align start): left (gap 2) "Pastry" Geist 18/24 600 ink, "Counted by Ann K. at 6:35 pm · signed with PIN" 13/18 `#635E57`; right (gap 24): two blocks (gap 2): L1 "OPENING" + "Checked 7:14 am, no difference" 13/18 ink; L1 "DELIVERY" + "Confirmed 3:20 pm" |
| Table | header row: padding 0 8 10, gap 12, **1px ink bottom border**; labels Geist Mono 10/12 0.06em `#635E57`, right-aligned, wrapping to two lines, **USED TODAY in ink**. Columns (px): ITEM grow · OPENING STOCK 60 · RECEIVED 60 · WASTE 48 · CLOSING STOCK 60 · USED TODAY 60 · YESTERDAY 68 · USED VALUE (KES) 68 · CLOSING STOCK VALUE (KES) 92. Data rows: padding 11 8, gap 12, 1px `--color-border` bottom; item cell: name Geist 14/18 500 ink + unit Geist 12/16 `#635E57` (gap 1); numbers Geist Mono 14/18 right-aligned; **USED TODAY weight 600**; YESTERDAY `#635E57`; when USED VALUE is 0 the cell is `#8D8982`. **Derived row height 58** (11 + 18 + 1 + 16 + 11 + 1). **Derived item column ≈ 191** at 1440 (867 − 48 − (516 + 96 + 16)) |
| Total row | padding 12 8, gap 12, **1px ink bottom border**: left "Waste: 1 entry (Eggs, broken)" 13/18 `#635E57` (grows), five empty cells, "TOTAL" L1 (68), used-value total **8,760** and closing-value total **15,840** Geist Mono 14/20 600 |
| Footnote | padding 10 8 0: "Used today = opening stock + received − waste − closing stock. Used value is what was used at today's prices; closing stock value is what is left on the shelves." 13/18 `#635E57` |

**Rows drawn (Pastry):** Flour 25kg Bags 4/0/0/1/3/1/6,000/2,000 · Butter 500g Blocks 6/4/0/8/2/2/1,240/4,960 · Eggs Trays 4/3/1/5/1/1/480/2,400 · Caster sugar 2kg Packs 5/0/0/4/1/1/340/1,360 · Baking powder 500g Tins 3/0/0/3/0/0/0/1,200 · Vanilla essence Bottles 2/0/0/2/0/0/0/1,400 · Icing sugar 1kg Packs 4/0/0/3/1/1/280/840 · Cream cheese Tubs 3/2/0/4/1/1/420/1,680. (8 rows, not 7.)

**Interaction.** Selecting a department row in the rail swaps the pane (`aria-current` / `role="tab"`-like list; arrow keys move). The Branch Manager sees values; the head sees no costs (the value columns are hidden from them; heads do not reach this screen). The pane scrolls inside; the rail footer stays pinned. Kit: no two-pane component exists in `_shared` (K21). Hairline: the ink 1px top border runs across both panes and meets the vertical ink divider (the hairline-meets-divider look the owner asked for on master-detail desktop screens).

### Step 7: Today, ready to close (1440 × 900)

Same frame, cards, topbar and title as step 5; sidebar badge is gone (nothing blocks). Differences, all from the drawn nodes:

| Part | Value |
|---|---|
| Cards | All five are Counted (Housekeeping "Counted 7:24 pm", value **1,860**; the card is the Counted card). Barista keeps the chip "Opening 1 less · Milk 1L"; Service keeps "Opening not checked" |
| Blockers header | Title "Ready to close" Geist 15/20 600; sub "Nothing is left to do. 1 thing to know about." 13/18 `#635E57`. 1px ink bottom border, padding-bottom 12. **Close the day**: H40, padding 0 20, gradient, 14/18 500 `#FCF7F2`, **fully opaque (enabled)**; no wrapper column and no line under it |
| Row 1 | green check disc (18): "Every delivery is confirmed" / "One discrepancy is open, which does not block the close:" + link `DSC-NYR-0007` |
| Row 2 | green check disc: "All five departments have counted" / "Housekeeping signed its count at 7:24 pm." |
| Row 3 | amber ring icon: "Opening not checked: Service" / "The Service day ran on last night's closing figure. This does not block the close." |

Row geometry: as step 5 (padding 14 8, gap 14, 1px `#E4E2DE` bottom, title 14/18 500, sub 13/18 `#635E57`, icon margin-top 1). The red blocker row is gone and the green "counted" row takes its place; order is delivery, departments, heads-up. **Interaction:** Close the day opens the step 8 drawer (focus moves into it; closing returns focus to this button).

### Step 8: Close the day, summary and PIN (desktop drawer over Today, 1440 × 900)

Behind: step 7 (the real page, not dimmed separately). **Scrim** full screen `#17151273` = neutral-950 at **45%** (0x73/255 = 45.1%, derived). Token `wds-scrim` is 35%: decision K16 below.

| Part | Value |
|---|---|
| Drawer | right edge, **560 wide**, full height (900 drawn), white, **1px ink left border**, no radius, no shadow |
| Header | padding 24 28 18, 1px `#E4E2DE` bottom, space-between, align start. Title Geist 20/26 600 −0.01em ink "Close the day"; under it (gap 4/8) "Nyeri Town · Wednesday 7 October ·" 13/18 `#635E57` + link `DAY-NYR-0044` (mono 13/18 `#1F5BAE` underlined). **Close glyph** 20 × 20, stroke `#635E57` 2px round (`M6 6l12 12M18 6L6 18`) at the right |
| Body | padding 20 28, gap 18, grows |
| Summary card | **2px ink top border**, no other border. Top: padding 14 16 12: L1 "USED TODAY (KES)" and the figure Geist Mono **28/34 600, −0.01em** "50,060". Five rows (1px `#E4E2DE` top, padding 9 16, gap 12): name Geist 13/18 500 ink (grows); "N items" 13/18 `#635E57`; figure Geist Mono 13/18 ink right-aligned in a **76 px** cell. Rows: Kitchen 12 items 24,380 · Barista 8 items 11,940 · Pastry 8 items 8,760 · Service 9 items 3,120 · Housekeeping 6 items 1,860 (items sum to 43). Last row (1px top, padding 10 16): link "See every line" Geist 13/18 500 `#B0610F` |
| WHAT CLOSING DOES | gap 6. L1, then Geist 13/19 ink: "Writes 43 usage entries to the stock ledger, one per item, each marked DAY-NYR-0044. Nothing is reopened afterwards: you can correct one item, with a reason and your PIN." |
| SIGNED BY | L1 + read-only field H40 "Branch Manager" |
| YOUR PIN | L1 + PIN field H44, focused (`#B0610F` + 3px `#FCF2E4`), "••••" |
| Footer | 1px `#E4E2DE` top, padding 16 28 22, space-between, centre. **Left: "Cancel" is a text link**, Geist 14/18 500 `#B0610F`, not a button. Right: primary **H44**, padding 0 28, "Close the day" 14/18 500 `#FCF7F2`, gradient |

**Interaction (the PIN flow, receipt-style summary).** Focus trap in the drawer; first focus on the PIN field (it is drawn focused); Escape, the close glyph, Cancel and the scrim close without closing the day. The figures are a receipt: they cannot be edited here; "See every line" expands (or opens) the 43 lines (G10). The button enables at four digits; while posting, label "Closing the day" and disabled; an idempotency key on the write. A wrong PIN or a server refusal (a department changed since the screen loaded) shows an error line under the PIN field in `wds-error-fg` 13/18 and keeps the drawer open (G7). After success the drawer closes and step 9 shows. "3 taps from Today" (flow doc): Close the day, type PIN, Close the day.

**Kit:** `Sheet` / `DrawerShell`. `DrawerShell paper` is 520/540 wide, 28 padding, 22/28 title **with a mono context line above it**, a **secondary Cancel button** at the left and a growing primary. Paper here is **560**, 20/26 title **with the context line under it**, a **text-link Cancel** and a 44 high primary of natural width. Decision **K16**: add `paperWidth={560}` (exists) and a `variant="day"` layout (header with close glyph, title above the context line, link Cancel). Recommended: Paper, as that option. Scrim: use 45% for this drawer only (`scrim` prop), as the phone sheets do.

### Step 9: The day is closed (1440 × 900)

Frame as step 5. Breadcrumb "Branch / Day". Title "Today"; same subtitle line.

| Part | Value |
|---|---|
| Confirmation | one row, align centre, gap 14, padding 16 18, `#EEF4EC`, 1px `#CADFC6`. Icon 22 × 22 green check disc. Text (grows, gap 2): "Day closed at 7:48 pm, signed by the Branch Manager" Geist 15/20 600 `#2F6438`; "Used today KES 50,060. 43 usage entries were written to the stock ledger, each marked DAY-NYR-0044." 13/18 `#2F6438`. Right: primary **H40** padding 0 20 "Open the day file"; secondary **H40** padding 0 18 white, 1px `#D2CFC9`, "Print the day sheet" (14/18 500 ink) |
| Section head | padding-bottom 10: "Written to the stock ledger" 15/20 600 ink; "One usage entry per item. Every entry links back to this day." 13/18 `#635E57` |
| Table | header: gap 20, padding 0 8 10, 1px **ink** bottom, mono 10/12 0.06em `#635E57`. Columns: TIME 72 · ITEM grow · DEPARTMENT 140 · USED 130 (right) · RECORD 150. Rows: padding 11 8, gap 20, 1px `#E4E2DE` bottom (**derived 41**: 11 + 18 + 11 + 1); time Geist Mono 13/16 `#635E57`; item Geist 14/18 500; department Geist 14/18; used Geist Mono 14/18 right ("−3 bags"); record link mono 13/16 `#1F5BAE` underlined |
| Rows drawn | 7:48 pm Flour 25kg Pastry −3 bags · Milk 1L Barista −15 packets · Cocoa powder 1kg Barista −1 tin · Cooking oil 10L Kitchen −2 cans · Tomatoes Kitchen −6 kg (all `DAY-NYR-0044`) |
| Footer line | space-between, padding 12 8: "Showing 5 of 43 entries" 13/18 `#635E57`; link "See all 43 in the day file" 13/18 500 `#B0610F` |
| Note | "Nothing is reopened. If a figure was wrong, the Branch Manager corrects that one item on the day file, with a reason and a PIN, until tomorrow's opening is accepted." 13/18 `#635E57` |

**Interaction.** The confirmation stays until the page is left (G8). "Open the day file" goes to step 11. "Print the day sheet" opens the print view (steps 13b to 13d) in a new tab / the print dialog; **printing writes no audit event** (flow doc). The five rows are a preview with a link, not a table with a pager (UI_BUILD_RULES §4a applies to tables the user pages; this is a 5-row summary, C9). Each record link opens the day file's Activity tab.

---

## 4. Desktop screens, chapter 3: the record

### Step 10: History (Branch Manager; 1440 × 900)

Sidebar: Day expanded, **History** active (Today at 26 high, 500, `#FCFCFC`; History `#EFCF9E` at 85%; the active sub-link carries the 5 × 5 `#D9A65E` node on the rail). Breadcrumb "Branch / Day / History" (History current). Title "History" Geist 24/30 600; sub "Nyeri Town · every branch day, newest first" Geist 14/18 `#635E57`.

| Region | Values |
|---|---|
| Toolbar | row, gap 10, centre. **Search** H36, W320, padding 0 12, gap 8, white, 1px `#D2CFC9`, radius 2, 12 × 12 ring glyph, placeholder "Search by day number" Geist 14/18 `#8D8982`. **Date** button H36, padding 0 12, gap 8, radius 2, 1px `#D2CFC9`: "Date: Last 7 days" 14/18 ink + "▾" system-ui 10/12 `#635E57`. **Status** button the same: "Status: All ▾" |
| Table | header: gap 16, padding 0 8 10, 1px ink bottom, mono 10/12 0.06em `#635E57`. Columns: DAY (grow) · DEPARTMENTS COUNTED **130** · USED VALUE (KES) **110** right · CLOSING STOCK VALUE (KES) **130** right · STATUS **100** · CLOSED BY **130**. Rows: padding 14 8, gap 16, 1px `#E4E2DE` bottom, **derived height 67** (14 + 18 + 2 + 18 + 14 + 1). Day cell: link `DAY-NYR-0045` Geist Mono 14/18 `#1F5BAE` underlined, under it the date Geist 13/18 `#635E57` ("Thursday 8 October"). Counts "5 of 5" Geist 14/18 ink. Figures Geist Mono 14/18 right. Status chip: padding 2 8, gap 6, 12/16, **6 × 6 square** dot: **Open** `info` (`#ECF2F5` / `#C1D4DF` / `#2C5670`), **Closed** `success`, **Corrected** `warning`. Closed by: Geist 14/18 ink. Unclosed days show "–" in `#8D8982` for figures and closed-by and "0 of 5" |
| Rows drawn (7) | 0045 Thu 8 Oct 0 of 5 – – Open – · 0044 Wed 7 Oct 5 of 5 50,060 214,500 Closed Peter Njoroge · 0043 Tue 6 Oct 5 of 5 47,310 219,850 **Corrected** Peter Njoroge · 0042 Mon 5 Oct 52,940 221,400 Closed · 0041 Sun 4 Oct 38,120 224,780 Closed · 0040 Sat 3 Oct 61,480 218,950 Closed · 0039 Fri 2 Oct 49,870 230,100 Closed (all 5 of 5, Peter Njoroge) |
| Footer | padding 4 8, space-between: left "Showing 1 to 7 of 7" Geist 13/18 `#635E57` (200 wide); centre pager, gap 6: **32 × 32** cells, "‹" disabled (1px `#D2CFC9`, glyph `#8D8982`, system-ui 16/20), current page ink fill `#171512` with white Geist Mono 13/16, "›" bordered ink; right (200 wide, gap 10): "Rows per page" 13/18 `#635E57` and a 32 high select with "25" Geist Mono 13/16 |

**Interaction.**
- Search by day number as you type, no Enter (§4a). Date and Status are filters; all state in the URL; changing any returns to page 1. Day link opens the day file (step 11). Rows are also activatable as a whole (Enter on the row opens the day).
- Open days (no close yet) have a day link too: they go to Today for that day (the open day's file has no figures yet; G11).
- The list is the kit's `DataTable` with `TablePager`; see the kit decision below.

**Kit decisions for 10, 10b.** Per the Block 3 rulings the **kit's toolbar wins** (search left, "Name · All" dropdowns right, status as chips with counts) and the **kit's pager** (`TablePager`, numbered, rows per page) wins, with Paper's labels: the toolbar reads "Search by day number", "Date: Last 7 days", "Status". Paper's drawn H36 buttons and 320 search become the kit's H32; nothing else to decide. Row height: Paper 67 (two-line day cell) against the kit's 46 default: the two-line day cell needs a `TableRow` `size="two-line"` option (default unchanged). Columns above are Paper's exact widths; the table scrolls horizontally inside its container below 1024.

### Step 10b: History across branches (Director; Accountant, Store Manager, System Admin see the same; 1440 × 900)

Sidebar (Director): tag "ALL BRANCHES"; groups OVERVIEW, **BRANCHES** (open: Day with Today and History, History active; **Waste**), OPERATIONS, CENTRAL STORE, PROCUREMENT; footer "SG" / "Samuel Gitau" / "Director". (There is no Requisitions row in Branches: decided 8 Oct, it sits in the Central Store group.) Breadcrumb "**Branches** / Day" (no "History" crumb: C10). Title **"Day history"**; sub "All branches · every branch day, newest first". Same toolbar with an added **Branch** button "Branch: All ▾" between search and Date.

Table differences against step 10: gap **14** (not 16), and the columns are DAY (grow) · **BRANCH 110** · DEPARTMENTS COUNTED **100** · USED VALUE (KES) **96** right · CLOSING STOCK VALUE (KES) **120** right · STATUS **96** · CLOSED BY **120**; rows padding **12** (not 14), derived height 63. Cells: "Nyeri Town" / "Karatina" Geist 14/18 ink; counts "0 of 4" / "4 of 4" for Karatina. Rows drawn (8): DAY-KRT-0031 Thu 8 Oct Karatina 0 of 4 Open · DAY-NYR-0045 Thu 8 Oct Nyeri Town 0 of 5 Open · DAY-KRT-0030 Wed 7 Oct Karatina 4 of 4 31,480 128,900 Closed Lucy Wanjiku · DAY-NYR-0044 Nyeri Town 5 of 5 50,060 214,500 Closed Peter Njoroge · DAY-KRT-0029 Tue 6 Oct Karatina 29,870 131,250 Closed Lucy Wanjiku · DAY-NYR-0043 Nyeri Town 47,310 219,850 Corrected Peter Njoroge · DAY-KRT-0028 Mon 5 Oct Karatina 33,020 127,600 Closed Lucy Wanjiku · DAY-NYR-0042 Nyeri Town 52,940 221,400 Closed Peter Njoroge. Footer: "Showing 1 to 8 of 14"; pager "‹" disabled, **1** current, **2**, "›"; "Rows per page" select "8" (mono 13/16). Read only: no action anywhere. Newest first, then by branch name within a date (as drawn: Karatina above Nyeri Town).

**Conflicts C11/C12:** the two History tables use two sets of widths, gaps and row paddings (step 10: gap 16, padding 14, 130/110/130/100/130; step 10b: gap 14, padding 12, 100/96/120/96/120). Build **one** table; take step 10's numbers (the roomier set; 1204 wide has the room) and add the Branch column (110) on the hub view only.

### Step 10c: The date range picker open (1440 × 700 artboard; popover 776 × auto)

The page behind is step 10 (the Date button is the trigger). The popover is the **approved picker** and the **kit's `DateRangePicker`** already matches: left rail 168 wide with the label "QUICK PICKS" (mono 10/12 0.06em `#635E57`) and seven rows (padding 7 8, 13/16): **Today, Yesterday, Last 7 days** (selected: fill `#FCF2E4`, weight 600), **Last 30 days, This month, Last month, Pick a date or range**. Right column padding 16 20, gap 14: FROM / TO fields (150 × 32, Geist Mono 13/16, FROM active with a 1px ink border, TO 1px `#D2CFC9`) joined by "→"; caption "7 days · click one date for a single day" 12/16 `#635E57`; two months side by side (gap 28): "‹ September 2026" and "October 2026 ›" Geist 13/16 600; weekday heads Mo to Su Geist Mono 10/12 `#635E57`; day cells **36 × 30**, Geist Mono 12/16; start and end days ink fill `#171512` with white text; days between `#FCF2E4`; **later dates `#8D8982`** and not selectable. Footer (1px `#E4E2DE` top, padding-top 12): note "Later dates can't be picked. The list shows every branch day in the range." 12/16 `#635E57`; **Cancel** 32 high (padding 0 14, 1px `#D2CFC9`, 13/16) and **Apply** 32 high (padding 0 14, fill `#B0610F`, 13/16 500 white). Popover: white, 1px `#D2CFC9`, radius 4, shadow `0 12px 32px #28190A2E`.

Kit (`ui2/date-range-picker.tsx`) differences: From/To fields 36 high (Paper 32); Cancel/Apply 36 high (Paper 32); panel 168 + 560 (Paper 168 + 608); note "Later dates can’t be picked." with a curly apostrophe. Ruling: the kit's picker wins; pass `note="Later dates can’t be picked. The list shows every branch day in the range."`.

---

### Step 11: The closed day file (Items tab; 1440 × 1000)

Breadcrumb "Branch / Day / History / **DAY-NYR-0044**" (current crumb Geist Mono 13/16 500 ink). Top-bar search is **max 360** here (420 elsewhere: C13). Page body padding **24** top, sides 32, gap **16** (other pages 28 / 20).

| Region | Values |
|---|---|
| Title row | space-between, align start. Left (gap 4): title "Wednesday 7 October" Geist 24/30 600 −0.01em + **status chip** (gap 12): Closed `success`, 6 × 6 square dot, padding 2 8, 12/16; below: "Nyeri Town ·" 14/18 `#635E57` + link `DAY-NYR-0044` (mono 14/18). Right: **Print the day sheet**, H40, padding 0 18, white, 1px `#D2CFC9`, 14/18 500 |
| Tracker strip | one row, gap 24, padding 12 16, white, 1px `#D2CFC9`, align centre. Three done items (gap 8): 16 × 16 green check disc (2.4px) + text 13/18: "Openings checked · 4 of 5" · "Counted · 5 of 5 by 7:24 pm" · "Closed 7:48 pm · signed by the Branch Manager" (this one weight 500). At the right (margin-left auto) an **info chip** padding 3 9, `#ECF2F5` / `#C1D4DF`, 12/16 `#2C5670`: "One item can be corrected until tomorrow's opening is accepted" |
| Tabs | row, gap 4, **1px ink bottom border**, each tab padding 10 14, 14/18. Active **Items**: ink, weight 600, **2px bottom border `#B0610F`**. Others `#635E57`, with a mono 12/16 count after the label (gap 8): "Documents 1", "Activity 9" |
| Two-pane | flex-grow. **Rail 240** (step 6 is 272: C14), 1px ink right border; rows padding 12 14, gap 3, 1px `#E4E2DE` bottom: name Geist 14/18 600 + value mono 13/16 (space-between); under it "12 items" 12/16 `#635E57` (**Service: "9 items · opening not checked"**). Selected row (Pastry): `#FCF2E4` + inset 3px `#B0610F`. **No rail footer total** here (step 6 has one). Pane: padding 16 20, gap 12 |
| Pane head | space-between: "Pastry" Geist 18/24 600; "Counted by Ann K. at 6:35 pm · signed with PIN" 13/18 `#635E57`. Right: **Correct a count** (Branch Manager only), H36, padding 0 16, gradient, 14/18 500 `#FCF7F2` |
| Table | identical to step 6 (same nine columns, widths, row padding 11 8, total row 12 8 with "Waste: 1 entry (Eggs, broken)", TOTAL 8,760 and 15,840, footnote) minus the opening/delivery block of step 6 |

**Strings:** as drawn above. Tab labels: Items, Documents, Activity. Button: Correct a count; Print the day sheet.

**Interaction.**
- Tabs are a `role="tablist"` with arrow keys, counts in the labels; the active tab and the department live in the URL (`?tab=items&dept=pastry`).
- **Correct a count** is shown only to the Branch Manager (System Admin can do every action with their own PIN, flow doc); for other desktop roles it is **hidden, not greyed**. It is also hidden once tomorrow's opening is accepted; then the info chip reads differently (G13).
- **Print the day sheet** is available to every desktop role (decided 8 Oct).
- **Tracker (desktop file)**: Paper draws a one-line strip, not the dispatch stepper. The kit's file trackers (`dispatch/components/desktop/progress-tracker.tsx`, `purchasing/components/compact-tracker.tsx`) are different shapes (K18).
- **Tabs kit:** no shared desktop tab component exists in `ui2`; dispatch and purchasing files each have their own. Build one `FileTabs` (Paper's numbers: padding 10 14, 14/18, 2px `#B0610F`, counts mono 12/16) in `features/inventory/branch-day/_shared/` and offer it to the kit (K19).

### Step 12: Correct a count (drawer over step 11; 1440 × 1000)

Behind: step 11. **Scrim** `#17151273` (45%), drawer **560 wide**, 1px ink left border (same frame as step 8; kit decision K16). Header: title "Correct a count" (20/26 600 −0.01em); under it "One item on the closed day" 13/18 `#635E57` + link `DAY-NYR-0044` (13/18), close glyph 20.

| Region | Values |
|---|---|
| Body | padding 20 28, gap 18 |
| ITEM | L1; chosen-item bar: H44, padding 0 14, `#FCF2E4`, 1px `#B0610F`, space-between; left (baseline, gap 8) "Flour 25kg" 14/18 500 ink + "Pastry · bags" 13/16 `#635E57`; right link "Change" 13/16 `#B0610F` |
| Figures | row, gap 16, centre: two columns (gap 4): "CLOSING STOCK WAS" + read-only box H44, padding 0 14, `#F6F5F3`, 1px `#E4E2DE`, value mono 18/22 "1"; a 20 × 16 arrow (stroke `#847E76` 1.5px, `M0 8H17M11 2L17 8L11 14`, margin-top 16); "CLOSING STOCK SHOULD BE" + **input** H44, white, 1px `#B0610F` + 3px `#FCF2E4` halo, mono 18/22 "2" |
| WHAT CHANGES | **2px ink top border**, no side borders. L1 row (padding 10 14 4); three rows (padding 7 14, gap 12, 1px `#E4E2DE` top between): label 13/16 ink; old value mono 13/16 `#635E57`; "→" system-ui 12/16 `#8D8982`; new value mono 13/16 **600** ink right-aligned in a 60 px cell. Rows: Used today 3 → 2 · Used value (KES) 6,000 → 4,000 · Closing stock value (KES) 2,000 → 4,000 (last row padding-bottom 10) |
| WHY · REQUIRED | L1, then chips (gap 8): **H36, padding 0 14, 13/16**. Selected "Counted wrongly": fill `#171512`, white text, weight 400 (**not 600 as in Branch waste W7**: C15), no border. Others "Item was missed", "Other": white, 1px `#D2CFC9`, ink |
| NOTE · OPTIONAL | L1 (gap 6), textarea H56, padding 10 12, white, 1px `#D2CFC9`, Geist 14/20; sample "A bag was in the dry store, not on the shelf." |
| Info note | padding 12 14, `#ECF2F5`, 1px `#C1D4DF`, 13/18 `#2C5670`: "One linked entry is posted to the stock ledger. The original close stays on file and in the audit log; nothing is reopened." |
| SIGNED BY · YOUR PIN | L1 (gap 6); two fields in a row (gap 10, grow equally): read-only "Branch Manager" H44 (`#F6F5F3`, 1px `#E4E2DE`, 14/18); PIN H44 focused ("••••", mono 18/22, 0.3em) |
| Footer | as step 8: 1px `#E4E2DE` top, padding 16 28 22; **link Cancel** 14/18 500 `#B0610F`; primary **H44**, padding 0 28, "Post the correction" |

**Interaction.** Item list: only one item, chosen with "Change" (opens a picker listing the day's items; not drawn, G14). The two figures stay one box wide each; entering the new figure live-updates **WHAT CHANGES** (same row geometry; the new value in 600). Posting needs: a new figure different from the old one, a reason, 4 PIN digits; "Other" asks for a note (G15: the note field is drawn optional for all three; recommend required for "Other"). "Post the correction" shows "Posting the correction" and disables. Allowed until the next morning's opening is accepted (flow doc). The drawer is a form: Enter in the PIN field submits. Focus order: Change, new figure, reason chips (radio group), note, PIN, Cancel, Post. Kit: `Sheet` + the `DrawerShell paper` options (K16); chips need a `size="drawer"` (H36, 13/16 ink fill) option on the shared `ChoiceChips` (Block 3 D5b already added the ink-fill tone; this one is H36 and weight 400).

### Step 12b: After the correction, Activity tab (1440 × 1000)

Breadcrumb as 11 but **no search box** in the top bar (C13). Title "Wednesday 7 October" with a **Corrected** chip (`warning`). Print the day sheet button as 11.

| Region | Values |
|---|---|
| Success note | row, gap 12, centre, padding 12 16, `#EEF4EC`, 1px `#CADFC6`. 18 × 18 green check disc. One line Geist 14/18 `#2F6438`: "Correction posted at 9:14 am: Flour 25kg, closing stock 1 → 2. The day's Used value is now KES 48,060." |
| Tabs | Items, Documents **1**, **Activity 10** (active) |
| Table | header: gap 16, padding 0 8 10, 1px ink bottom; columns **WHEN 96** · **WHO 200** · **WHAT** grow · **RECORD 150**. Rows: padding 14 8, gap 16, align **start**, 1px `#E4E2DE`: time mono 13/16 `#635E57` ("Thu 9:14 am"); who Geist 14/18 ("Peter Njoroge · Branch Manager"); what: title 14/18 500 + detail 13/18 `#635E57` (gap 2); record link mono 13/16 `#1F5BAE` underlined, or empty. **The correction row** is highlighted `#FBF2E4` with a 1px `#E7D3AC` bottom border |
| Rows drawn | Thu 9:14 am Peter Njoroge · Branch Manager: "Corrected a count: Flour 25kg (Pastry), closing stock 1 → 2" / "Reason: counted wrongly. Note: a bag was in the dry store, not on the shelf. Signed with PIN." / link "Stock ledger entry" · Wed 7:48 pm Peter Njoroge · Branch Manager: "Closed the day · Used today KES 50,060" / "43 usage entries written to the stock ledger. Signed with PIN." / `DAY-NYR-0044` · Wed 7:24 pm Mary N. · Housekeeping: "Counted and signed: Housekeeping, 6 items" · Wed 6:52 pm David M. · Barista: "Counted and signed: Barista, 8 items" · Wed 7:17 am David M. · Barista: "Recorded the opening: Milk 1L, 1 less than last night (8 → 7)" |
| Footer line | "Showing the 5 most recent of 10 entries" 13/18 `#635E57` (padding 12 8). **No pager and no link is drawn**: C16 |

Order is newest first, with the five most recent shown. (The sample is not strictly in time order: the 7:24 pm and 6:52 pm rows are fine; the 7:17 am opening is the oldest shown. Nine other entries are not drawn.) The kit's `DataTable` + `TablePager` (§4a) applies when the entries exceed a page: G16.

### Step 13: Documents tab (1440 × 700)

Breadcrumb as 12b (no search). **No Print button and no success note** are drawn here (C17). Title "Wednesday 7 October" + Corrected chip. Tabs: Items, **Documents 2** (active), Activity 10.

| Region | Values |
|---|---|
| Table | header: gap 16, padding 0 8 10, 1px ink; columns DOCUMENT (grow) · PAGES **70** · MADE **200** · (130 empty, for the action). Rows: padding **16** 8, gap 16, centre, 1px `#E4E2DE`. Document cell (gap 3): line 1 (gap 10, centre) "Day sheet" 14/18 500 + link `DAY-NYR-0044` mono 13/16 + a **tag** (padding 1 8, 12/16); line 2 13/18 `#635E57`. Pages: mono 14/18 "6". Made: Geist 14/18. Action: **Print**, 130 × 36, white, 1px `#D2CFC9`, 14/18 500 |
| Row 1 (latest, highlighted `#FCF2E4`) | "Day sheet" · `DAY-NYR-0044` · tag **"Latest · includes the correction"** (`#FBF2E4` / `#E7D3AC` / `#8A5A16`) · "Every department's figures, who counted and signed, and the Branch Manager's signature" · 6 · "Thu 8 Oct, 9:15 am" · Print |
| Row 2 | "Day sheet" · `DAY-NYR-0044` · tag "At the close" (white, 1px `#D2CFC9`, `#635E57`) · "As signed on Wednesday, before the correction. Kept on file." · 6 · "Wed 7 Oct, 7:48 pm" · Print |

**Interaction.** Print opens the printed day sheet of that version (steps 13b to 13d, A4). Every version is kept; a new version is made at the close and after each correction (flow doc). Print is allowed to every desktop role; printing writes no audit event. The 9:15 am time (one minute after the 9:14 correction) is the generation time of the latest sheet.

---

## 5. The printed day sheet (steps 13b, 13c, 13d)

**One document, six pages, A4.** Page 1 is the cover (13b), pages 2 to 6 are one page per department in the order Kitchen, Barista, Pastry, Service, Housekeeping (13c is page 4, Pastry; 13d is page 6, Housekeeping, the last). Pages 2, 3 and 5 are not drawn; they are the same template with that department's rows (G17). The cover's PAGE column says where each department is (Kitchen 2, Barista 3, Pastry 4, Service 5, Housekeeping 6).

**Page.** 794 × 1123 px = A4 at 96 dpi (derived: 210 mm × 297 mm = 793.7 × 1122.5 px). Background `#FFFFFF`. No `@page` margin is drawn: the page is a full-bleed sheet with its own paddings, so build as the existing delivery note does: `@page { size: A4; margin: 0 }`, each page an `article` 794 × 1123 with `break-after-page`, `overflow: hidden`, `print:border-0`. (The 1px grey outline in Paper is the artboard edge, not part of the print.) The frame already exists: **`dispatch/components/desktop/delivery-note-print-screen.tsx`** (the approved LPO template: 10px navy band, `px-12` = 48 padding, footer rule, QR). Reuse its `PageShell`, band and pagination approach (its `paginateNote` by fixed row heights, repeated headings, a closing block on the last page only) rather than writing a second print stack. The day sheet's differences are in the tables below.

**Print palette (no wds tokens; "no token: use exact value"):** navy `#0B2A4A` (band, headings, figures, QR), slate `#6B7785` (labels, secondary; the delivery note uses `#5B6670`: C18), body grey `#3A4756`, rule `#D5DCE4` (page rules, signature lines), row rule `#E3E8EE`, zero figures `#8A94A3`, corrected-row fill `#FBF6E9`. Fonts: Geist (text), Geist Mono (numbers, labels), **Alex Brush** (signatures; the project already ships it as `--font-signature`, `app/fonts/alex-brush`).

### Page chrome (every page)

| Part | Cover (page 1) | Department pages (2 to 6) |
|---|---|---|
| Top band | full width, **10 high**, `#0B2A4A` | same |
| Body padding | sides **48**, top **36** | sides 48, top **30** |
| Header | left: round logo **52 × 52** (radius 26), gap 14, "Wendo Coffee Bistro" Geist 18/22 600 navy, under it "Nyeri Town · Branch day sheet" 12/16 slate. Right (end-aligned, gap 2): "DAY SHEET" Geist Mono 10/12 0.08em slate; "DAY-NYR-0044" Geist Mono **26/32 600** navy; "Wednesday 7 October 2026" 12/16 slate | left: logo **36 × 36** (radius 18), gap 12, name 14/18 600, sub 11/14 slate. Right (gap 1): "DAY-NYR-0044" mono **16/20 600** navy; date 11/14 slate |
| Rule under header | 1px `#D5DCE4`, margins 20 / 20 | 1px `#D5DCE4`, margins 16 / 22 |
| Footer | margin-top auto; 1px `#D5DCE4` top, padding 14 0 18; left "Generated by Wendo RMS · Designed and developed by Lobster Technologies" Geist 10/14 slate; right "Page N of 6" Geist Mono 10/12 slate (space-between) | same |

### Page 1, cover (13b)

| Region | Values |
|---|---|
| Info row | gap 40. Left (grows, gap 4): L "BRANCH" (Geist Mono 10/12 0.08em slate); "Nyeri Town (NYR)" Geist 14/20 500 navy; "Branch Manager: Peter Njoroge" 12/18 `#3A4756`. Right, **300 wide**, rows gap 6, space-between, 12/16: "Closed" slate / "Wed 7 Oct, 7:48 pm" navy; "Corrected" / "Thu 8 Oct, 9:14 am"; "Printed" / "Thu 8 Oct, 9:15 am" |
| Departments table | margin-top 28. Header: gap 10, padding-bottom 8, **2px navy bottom border**; labels Geist Mono 10/12 0.06em slate: **#** 22 · **DEPARTMENT** grow · **HEAD** 84 · **ITEMS** 40 right · **USED VALUE** 78 right · **CLOSING VALUE** 100 right · **PAGE** 34 right. Rows: padding 11 0, gap 10, 1px `#E3E8EE` bottom; number mono 12/16 slate; department Geist 13/16 500 navy; head 12/16 `#3A4756`; figures mono 12/16 navy; page slate. **Total row:** padding 12 0, 2px navy bottom border; "Branch total (KES)" 13/16 600; 43 · 48,060 · 216,500 mono 12/16 600 |
| Rows | 1 Kitchen · Grace W. · 12 · 24,380 · 78,200 · 2 / 2 Barista · David M. · 8 · 11,940 · 41,350 · 3 / 3 **Pastry · corrected** · Ann K. · 8 · 6,760 · 17,840 · 4 / 4 Service · John M. · 9 · 3,120 · 52,310 · 5 / 5 Housekeeping · Mary N. · 6 · 1,860 · 26,800 · 6 |
| CORRECTION | margin-top 26, gap 6: L "CORRECTION"; 12/18 `#3A4756`: "Thu 8 Oct, 9:14 am · Pastry · Flour 25kg · closing stock 1 → 2 · reason: counted wrongly · signed by the Branch Manager. The figures above include it. The sheet printed at the close is kept on file." Shown only when the day was corrected; with several corrections one paragraph each (G18) |
| NOTES | margin-top 20, gap 4: L "NOTES"; 12/18 `#3A4756`: "Used today = opening stock + received − waste − closing stock. Service: opening not checked, the day ran on Tuesday's closing figure. DSC-NYR-0007 (Barista, Milk 1L) is open and did not hold the close." (built from the day's real exceptions: openings not checked, open discrepancies) |

Totals check (derived): used 24,380 + 11,940 + 6,760 + 3,120 + 1,860 = 48,060; closing 78,200 + 41,350 + 17,840 + 52,310 + 26,800 = 216,500; items 12 + 8 + 8 + 9 + 6 = 43.

### Pages 2 to 6, a department page (13c Pastry, 13d Housekeeping)

| Region | Values |
|---|---|
| Title row | align end, space-between. Left (gap 3): L "DEPARTMENT 3 OF 5" (mono 10/12 0.08em slate); name Geist **24/30 600** navy ("Pastry"). Right (end, gap 3): 12/16 `#3A4756` two lines: "Head: Ann K. · counted 6:35 pm, signed with PIN" / "Opening checked 7:14 am, no difference · Delivery confirmed 3:20 pm". Housekeeping: "Head: Mary N. · counted 7:24 pm, signed with PIN" / "Opening checked 7:12 am, no difference · No delivery today" |
| Table | margin-top 22. Header: gap **8**, padding-bottom 8, 2px navy bottom, labels Geist Mono **9/12** 0.06em slate: **#** 20 · **ITEM** grow · **OPENING STOCK** 46 · **RECEIVED** 48 · **WASTE** 40 · **CLOSING STOCK** 50 · **USED TODAY** 44 · **USED VALUE** 58 · **CLOSING VALUE** 70 (all numbers right). Rows: padding **10** (Pastry, 8 rows) or **9** (Housekeeping, 6 rows), gap 8, 1px `#E3E8EE`; # mono 11/14 slate (padding-left 2); item Geist 12/16 500 navy over unit 10/12 slate; figures mono 11/14 navy; a used value of 0 is `#8A94A3` |
| Corrected row (Pastry, item 1) | fill **`#FBF6E9`**; name "Flour 25kg *"; closing stock and used today each carry **two numbers in one cell: "1 2" and "3 2"** (the figure counted on Wednesday, then the corrected one). **The tools return one plain run in navy with no strike or weight change, so the strike is not readable from Paper**: see C19 and G19 for the proposed build |
| Total row | padding 12 (Pastry) / 11 (Housekeeping), 2px navy bottom; "Department total (KES)" Geist 12/16 600; used value and closing value mono 11/14 600 (6,760 / 17,840; 1,860 / 26,800); five empty cells keep the columns |
| Footnotes (Pastry only, margin-top 20, gap 3, Geist 11/16 `#3A4756`) | "* Corrected on Thu 8 Oct, 9:14 am by the Branch Manager (reason: counted wrongly). The figure counted on Wednesday is struck through." / "Waste logged today: 1 entry (Eggs, broken). Used today = opening stock + received − waste − closing stock." (Housekeeping has none) |

Item rows drawn: Pastry (8): Flour 25kg Bags 4/0/0/1→2/3→2/4,000/4,000 (note: with the corrected figures 4,000 and 4,000) · Butter 500g Blocks 6/4/0/8/2/1,240/4,960 · Eggs Trays 4/3/1/5/1/480/2,400 · Caster sugar 2kg Packs 5/0/0/4/1/340/1,360 · Baking powder 500g Tins 3/0/0/3/0/0/1,200 · Vanilla essence Bottles 2/0/0/2/0/0/1,400 · Icing sugar 1kg Packs 4/0/0/3/1/280/840 · Cream cheese Tubs 3/2/0/4/1/420/1,680. Housekeeping (6): Floor cleaner 5L Cans 7/0/0/6/1/950/5,700 · Dish soap 5L Cans 8/0/0/8/0/0/6,560 · Toilet paper 10pk Packs 15/0/0/14/1/480/6,720 · Bin liners Rolls 22/0/0/20/2/300/3,000 · Sponges Packs 11/0/0/10/1/130/1,300 · Hand towels Packs 11/0/0/11/0/0/3,520.

### Last page, signatures and QR (13d, the only page that has them)

| Region | Values |
|---|---|
| Heads' signatures | margin-top 26, gap 12: L "COUNTED AND SIGNED WITH PIN" (mono 10/12 0.08em slate). **Row 1** (three cells, gap 18, equal width): "Grace W." / "Kitchen · 6:20 pm", "David M." / "Barista · 6:52 pm", "Ann K." / "Pastry · 6:35 pm". **Row 2** (two cells, **197 wide** each, gap 18): "John M." / "Service · 6:41 pm", "Mary N." / "Housekeeping · 7:24 pm". Each cell: padding-bottom 6, gap 2, **1px `#D5DCE4` bottom** (the signature line); name in **Alex Brush 24/28 navy**; caption Geist 10/12 slate |
| Branch Manager | margin-top 26, row, align end, space-between. Left (gap 4): L "DAY CLOSED BY THE BRANCH MANAGER"; name "Peter Njoroge" in **Alex Brush 36/42 navy**; "Signed with PIN · 7 Oct 2026, 7:48 pm · correction signed 8 Oct 2026, 9:14 am" Geist 11/14 slate |
| QR | right, gap 12, align end: caption "Scan to open DAY-NYR-0044 in Wendo RMS" Geist 10/14 slate, right-aligned, **90 wide**; **QR 84 × 84** (21 × 21 modules), navy modules `#0B2A4A` on white, no margin. Paper's QR is a decorative static drawing: build with `QRCodeSVG` (`qrcode.react`, already a dependency of the delivery note; `size={84}`, `marginSize={0}`, `fgColor="#0B2A4A"`) encoding the day file's URL |

Signatures are typeset names, not images: the head's name from the signed record in Alex Brush, with the department and the time under it. A department counted on someone's behalf (step 15) prints "Peter Njoroge, for Housekeeping" with the department and time (G20). Signatures and QR appear **on the last page only**; if the closing block does not fit under the last table it takes its own page (as the delivery note does).

**Which sheet prints.** The Documents tab (step 13) prints the version named in its row: "At the close" prints without the CORRECTION block, with the figures as signed, no corrected row and no strike, "Corrected" line absent in the info row; "Latest · includes the correction" prints as drawn. Printing does not write an audit event.

---

## 6. Desktop screens, chapter 4: exceptions and the audit trail

### Step 14: Today blocked by an unconfirmed delivery (1440 × 900)

Frame, cards and title as step 5 (all five departments Counted, times 6:20, 6:52, 6:35, 6:41, 7:24 pm; chips "Opening 1 less · Milk 1L" on Barista and "Opening not checked" on Service). Header strip: "Before the day can close" / "1 thing to do. 1 more to know about." with **Close the day disabled** (45%). The pill above the screen reads "CLOSE IS OFF UNTIL KITCHEN CONFIRMS".

| Row | Values |
|---|---|
| Blocking (red) | fill `#FBEDEB`, 1px `#E6BEB7` bottom; **red disc `#97281D` with a white tick** (`M7.5 12.5l3 3 6-6.5`; step 5's red disc has a white "!": C20). Title "Kitchen has not confirmed its delivery" 14/18 500; "DSP-NYR-0231 left the store at 3:05 pm and is not counted yet. This blocks the close; an open discrepancy never does:" + link `DSC-NYR-0007` |
| OK (green) | "All five departments have counted" / "Housekeeping signed its count at 7:24 pm." |
| Heads-up | "Opening not checked: Service" / "The Service day ran on last night's closing figure. This does not block the close." |

**The button "Confirm for Kitchen" is not drawn on this screen**, although the flow doc and the wording table (step 18) both name it ("Branch Manager confirms a delivery for a department"): G21. Proposed build: a secondary button H32 on the right of the red row, label "Confirm for Kitchen", opening the existing Block 2 drawer `dispatch/components/desktop/confirm-for-department-drawer.tsx` (the Branch Manager counts the delivery on the department's behalf), which then returns here with the row turned green. **Interaction:** the card for Kitchen still reads "Counted 6:20 pm" (the evening count), independent of the delivery.

### Step 15: The Branch Manager counts for a department (drawer over Today; 1440 × 900)

Behind: the dimmed Today **as step 14 draws it** (Housekeeping already Counted at 7:24 pm, the red "Kitchen has not confirmed its delivery" row): this contradicts the drawer, which counts Housekeeping because it has not counted (C30). The right background is step 5's (Housekeeping Not counted, the red "Housekeeping has not counted" row). Scrim `#17151273` (45%); drawer 560 wide, 900 high, 1px ink left border.

| Region | Values |
|---|---|
| Header | padding 24 28 16 (steps 8 and 12: 24 28 18), 1px `#E4E2DE` bottom. **No close glyph.** Title "Count Housekeeping" Geist **20/24 600, no tracking** (steps 8 and 12: 20/26, −0.01em: C21); sub "On behalf of the department · blind: nothing to count against" 13/16 `#635E57` |
| Body | padding 16 28, gap 14 |
| Info note | padding 10 14, `#ECF2F5`, 1px `#C1D4DF`, 13/18 `#2C5670`: "Neither the Housekeeping Department Head nor a member is available. The count is recorded "on behalf of Housekeeping", signed by the Branch Manager." |
| Count list | **2px ink top border**; rows padding 10 0, gap 12, 1px `#E4E2DE`: item name Geist 14/18 500 (colour **`#000000`**, not ink: C22); box **64 × 36**, 1px `#D2CFC9`, value mono 16/20 centred. Drawn: Floor cleaner 5L 6 · Dish soap 5L 8 · **Toilet paper 10pk 14 (focused: 1px `#B0610F` + 3px `#FCF2E4`)** · Bin liners "–" (system-ui 16/20 `#8D8982`). Then padding 10: "2 more items to count" 13/16 `#635E57` (only 4 of the 6 items are drawn; Sponges and Hand towels are the 2 more) |
| YOUR PIN | L1 (gap 6), field H44, 1px `#D2CFC9` (not focused), "••••" Geist Mono **16/20**, 0.3em, `#000000` (steps 2, 8, 12: 18/22, ink) |
| Footer | padding 16 28 22: link Cancel 14/18 500 `#B0610F`; primary H44, padding 0 28, **disabled (45%)** "Check and sign" |

**Interaction.** Opened from Today's red "Housekeeping has not counted" row (its action is not drawn: G22; propose "Count for Housekeeping", visible only to the Branch Manager and System Admin). Blind: no expected figures. Every item must be filled before "Check and sign" enables (the "N more items to count" line counts down). "Check and sign" shows the receipt-style summary and PIN (the same as step 3b, at drawer width; not drawn: G23, proposed: reuse steps 3b's layout inside the drawer). The count is recorded "on behalf of Housekeeping", signed with the Branch Manager's own PIN; the printed sheet then shows "Peter Njoroge, for Housekeeping".

### Step 16: Today for a hub role (Director, Accountant, Store Manager, System Admin; 1440 × 900)

Sidebar: Director's (tag "ALL BRANCHES"; OVERVIEW, BRANCHES with Day (Today, History) and Waste, OPERATIONS, CENTRAL STORE, PROCUREMENT; footer Samuel Gitau / Director). **The sidebar highlights History, not Today** (verified by computed style: History 500 `#FCFCFC`, Today 400 caramel at 85%): C23. Breadcrumb "Branch / Day" (should read "Branches" as on 10b: C24).

| Region | Values |
|---|---|
| Branch picker | **absolute, right 32, top 84** (the title row's top: 56 top bar + 28 padding), **H36**, padding 0 12, gap 8, white, **1px ink border**, "Branch: Nyeri Town ▾" Geist 14/18 ink. (Branch waste W8's picker is H32, 13/16, "Branch: All branches ▾": C25. Today has no "All branches" value: it is one branch's day) |
| Everything else | as step 7 (all counted): five department cards, header "Ready to close" / "Nothing is left to do. 1 thing to know about.", rows "Every delivery is confirmed" / "One discrepancy is open, which does not block the close:" `DSC-NYR-0007`, "All five departments have counted" / "Housekeeping signed its count at 7:24 pm.", "Opening not checked: Service" / "…". **No Close the day button at all** (the header has only the left text block) |

**Interaction.** The picker lists the branches the role may read (Nyeri Town, Karatina in the sample) and is in the URL (`?branch=`); the default is the first branch alphabetically or the last one used (G24). "Open figures →" works (read only). Hub roles never see the Close button (hidden); the Branch Manager's own Today has no picker (one branch).

### Step 17: Audit log, extended (Director; 1440 × 900)

Existing screen: `features/inventory/audit-log/` (README: Paper chapter 8 step 35; Area menu and date range, steps 58 and 59). Sidebar: the Director's, **PROCUREMENT open with Suppliers, Catalog and "Audit log" active** (500 `#F5F3EF`, verified). Breadcrumb "Procurement / Audit log" (one text run "Procurement /" then "Audit log" 13/16 500 ink). Top bar here is white (no gradient) and has no search.

| Region | Values |
|---|---|
| Title | "Audit log" Geist 24/30 **600, no tracking** (the other screens: −0.01em: C26); sub 14/18 `#635E57`: "Who did what, when and why, across the Central Store and every branch. Nobody can edit or remove an entry." |
| Filters | row, wrap, gap 8, all **H32, padding 0 12**: **area chips** (13/16): "All areas" selected (fill `#171512`, white text), then Catalog · Purchasing · **Requisitions · Dispatch · Discrepancies · Branch day · Branch waste** (white, 1px `#D2CFC9`, text `#000000`); then "Branch: All ▾" (gap 6), "Who ▾", "Date: Today ▾" |
| Table | header: gap 14, padding 0 8 10, 1px ink; mono 10/12: **WHEN 90** (with 0.06em, the others none: C27) · **WHO 170** · **BRANCH 100** · **AREA 110** · **WHAT** grow · **RECORD 130**. Rows: padding 11 8, gap 14, 1px `#E4E2DE`; when mono 12/16 `#635E57`; who **two lines** (name, then the title, Geist 13/16 `#635E57`); branch, area, what Geist 13/16 (`#000000`: use ink); record link mono 12/16 `#1F5BAE` underlined (or "Stock ledger entry" in `#8D8982`, not a link, on the Karatina row) |
| Rows drawn | 7:48 pm Peter Njoroge / Branch Manager · Nyeri Town · Branch day · "Closed the day · Used value KES 50,060 · signed with PIN" · `DAY-NYR-0044` · 7:24 pm Mary N. / Housekeeping Head · Nyeri Town · Branch day · "Counted and signed Housekeeping · 6 items" · `DAY-NYR-0044` · 3:35 pm David M. / Barista Head · Discrepancies · "Counted delivery: Milk 1L 22 counted, 24 sent · reason: not in the box" · `DSC-NYR-0007` · 3:05 pm Store Attendant / Central Store · Dispatch · "Signed and sent 40 lines · carried by Wendo van KCB 214K" · `DSP-NYR-0231` · 2:10 pm Peter Njoroge / Branch Manager · Requisitions · "Approved 40 lines · KES 58,020 · signed with PIN" · `REQ-NYR-0112` · 1:15 pm Lucy Wanjiku / Branch Manager · Karatina · Branch waste · "Reversed waste entry · Milk 1L 2 · reason: logged the wrong item" · "Stock ledger entry" |
| Footer | "Showing 6 of 38 today. Documents printed are not recorded here." 13/16 `#635E57`. **No pager is drawn** (K11: use the kit's `TablePager`; the line above is its left text, then the pager) |

**Kit decision (K20).** The code's Area is a **menu** (`area-menu.tsx`: All areas, Central Store areas, Branches areas), Branch, Who and the shared date picker. Paper step 17 draws **chips** (and omits Suppliers, Restock levels, Payments and Prep, which the flow doc and the code keep). Recommendation: keep the menu (it is approved by steps 58/59 and works with 14+ areas) and **add the five Branches areas** with the words "Requisitions", "Dispatch", "Discrepancies", "Branch day", "Branch waste"; show who with the title under the name (the README lists "the person's role under their name" as a back-end gap) and the Branch filter. Owner may prefer chips: then all areas need chips and the row wraps. The Branch Manager gets an Audit log link scoped to their own branch (flow doc): its sidebar row is not drawn (G25).

### Step 18: The wording of Branch day (reference table, 1120 wide; not a screen to build)

Panel padding 28, gap 48, white, 1px `#E4E2DE`. Left column **520** (term 170, meaning 350); right column **480** (term 190, meaning 290), column gap 22 between its three blocks. Block head: L (mono 10/12 0.06em `#635E57`) over a 1px ink rule (padding-bottom 8). Rows: padding 9 0, 1px `#E4E2DE` bottom; term Geist 13/16 600 ink; meaning 13/16 `#635E57`. The text is the wording source for the screens; copy it exactly:

**THE FIGURES**
- "Opening stock": "Last night's closing figure, checked by the head at the start of the day"
- "Received": "Deliveries the department confirmed today"
- "Waste": "Waste logged today"
- "Closing stock": "The evening count, done blind by the department head. Never "counted""
- "Used today": "Opening stock plus Received, less Waste, less Closing stock. Never "consumption""
- "Yesterday": "The same item's Used today the day before. Nothing is flagged; the Branch Manager compares"
- "Used value (KES)": "What was used, at today's prices. Heads do not see it"
- "Closing stock value (KES)": "What is left on the shelves, at today's prices. Heads do not see it"

**STATES AND CHIPS**
- "Open · Closed · Corrected": "The three states of a day in History"
- "Counted · Not counted": "A department card on Today"
- "Opening not checked": "The department ran on last night's figure. Does not block the close"
- "Opening 1 less · Milk 1L": "The overnight difference, with the item. Recorded, never blocks"

**WHAT BLOCKS THE CLOSE:** "A department has not counted. A delivery has left the store and is not confirmed. Nothing else blocks: an open discrepancy never does"

**BUTTONS AND REASONS**
- "Close the day": "Branch Manager only. Hidden, not greyed, for every other role"
- "Correct a count": "One item, one reason, PIN. Posts one linked entry; a day is never reopened"
- "Counted wrongly · Item was missed · Other": "The three reasons for a correction"
- "Confirm for Kitchen": "Branch Manager confirms a delivery for a department"

Two rules from the table that change a screen: **"Closing stock" is never written "counted"** (so the step 3 progress text "5 of 8 counted" is about the act of counting items, not the figure, and stays; the department figure column is "Closing stock"), and **"Used today" is never written "consumption"** (the old `CONSUMPTION` reason is gone). The caption on Paper says "NO PER-SCREEN STATES (THE STATES KIT IS IN GROUP R)": loading, empty and error come from the States kit with a per-screen copy table that Paper does not draw (G26).

---

## 7. Extra chapter on the page (not in the 28): the head's Day history (Chapter 5, steps 19 and 20)

Added 8 Oct 2026 after the plan ("A head counts their own department every evening but could o…"). **It is not in the brief's list of 28 screens, and it is drawn in the Block 3 phone shell, not the Block 2 shell of steps 0 to 4** (C28). Included here so the build does not meet it unread; the owner decides whether it belongs to this block (decision O1, recommended default: yes, a head needs it, and it is two small screens).

**Step 19, "My department's past days"** (phone 390 × 844, no costs): header = the older `PhoneHeader` (22px chevron `#FFFFFF`, label Geist Mono 11/14 0.08em, 30 px avatar `#EBDFD6`, title 22/28 600 **no tracking**, subtitle Geist 13/18; 20 px above, 4 px inner top, 18 below). Title "Past days", subtitle "Kitchen · Grace W.". Body padding 16, gap 12: two buttons (gap 8, **H34**, padding 0 12, white, 1px `#D2CFC9`, 13/16): "Date: Last 30 days ▾", "Status: All ▾"; a card (white, 1px `#E4E2DE`); rows padding 12 14, gap 10, 1px `#EEEDEA`: left (grows, gap 3) link `DAY-NYR-0043` (mono 13/16 `#1F5BAE`), "Tue 6 Oct · 62 items counted" 13/16 ink, "I signed at 6:20 pm" 12/16 `#635E57` (or "I signed at 6:35 pm · 1 figure corrected"); right a chip (padding 2 8, 12/16): Closed (success) / Corrected (warning). Rows drawn: 0043 Tue 6 Oct 62 items 6:20 pm Closed · 0042 Mon 5 Oct 62 items 6:35 pm 1 figure corrected **Corrected** · 0041 Sun 4 Oct 61 items 6:10 pm · 0040 Sat 3 Oct 60 items 6:45 pm · 0039 Fri 2 Oct 62 items 6:25 pm. Foot: "Showing 1 to 5 of 28" 12/16 `#635E57` and a pager of **32 × 32** cells in Geist 12/16 ("‹" disabled `#8D8982`, "1" current ink fill, "2", "3", "›"), padding-bottom 20. Pill: "DEPARTMENT HEAD · PHONE · NO COSTS".

**Step 20, "One past day, my department"** (read only, quantities only): header title "Kitchen · Tue 6 Oct", subtitle (mono 12/18) "DAY-NYR-0043 · I signed at 6:20 pm". Column-head card (padding 8 12, 1px `#E4E2DE`): ITEM 100 · OPEN 46 · IN 44 · WASTE 40 · CLOSE 44 · USED 50 (mono 10/12 0.04em `#635E57`; **abbreviations here, the full words elsewhere**: C29). Rows card: padding 10 12; item Geist 13/16 ink (100 wide, names wrap); figures mono 12/16 ink right; USED weight 600. Rows: Marinated chicken 6/10/3/4/9 · Beef stew 8/12/2/6/12 · Kachumbari mix 5/6/2/3/6 · Pilau 4/8/0/5/7 · Fries portions 30/40/5/22/43. Info note (`#ECF2F5`, padding 10 12, 12/16 `#2C5670`, 320 wide): "Opening stock, Received, Waste, Closing stock and Used today for your department. Values are for the Branch Manager." Pill: "READ ONLY · QUANTITIES ONLY".

---

## 8. Conflicts inside Paper (two drawn places that disagree)

| # | Conflict | Where | Proposed resolution |
|---|---|---|---|
| C2 | Secondary button height: **44** vs **48** | step 1 vs steps 2b, 4 | 44 everywhere (the Block 3 value); both clear the touch minimum |
| C4 | The "next" marker is an **8 × 8 square** (1.5px ring) vs a **16 × 16 ring** | step 2b "NEXT" vs step 4 tracker | the 16 ring on both |
| C5 | The **recount screen is not drawn**: the flow doc says it "uses the step 3 screen", but step 3's title ("Count your department"), its button ("Check and sign") and its pill (evening) do not fit the morning opening, and step 2 (the next screen) is titled "Record the opening" with subtitle "Barista · recount · 8 items" | steps 1, 2, 3 | Reuse the step 3 layout with the step 2 header words: title "Recount the opening", subtitle "Barista · Wed 7 Oct · 8 items", button "Check the difference" (wording proposed; G28) |
| C6 | Figure font: **Geist Mono 16/20 400** (step 1, last night's figures, plain text) vs **Geist 16/20 500** (steps 3 and 3c, typed figures in boxes) | step 1 vs 3, 3c | as drawn: mono for read-only figures, sans in the entry boxes |
| C7 | Steps 3 and 3c are the same list, 3c without the progress strip and helper line; the pill says a figure can be tapped, nothing shows it | 3 vs 3c | one component with `mode` `count` / `review` (G4) |
| C8 | **DAY-NYR-0044 reads "Closed"** in History (10, 10b) but "Corrected" on 12b, 13, 13b. Also today is "Wednesday 7 October" on steps 5 to 9 and 14 to 16, while History lists a DAY-NYR-0045 on "Thursday 8 October" as Open | 10, 10b vs 12b, 13 | mock-data timeline (the correction happens on Thursday): show real statuses (Corrected once a correction exists) and today's real date |
| C9 | Step 9's ledger table is a 5-row preview with "See all 43 in the day file", no pager | 9 | as drawn (a preview, not a paged table); the full list is the Activity / ledger link |
| C10 | Breadcrumb: "Branches / Day" (10b) vs "Branch / Day / History" (10); "Branch / Day" on step 16 (a hub screen) | 10, 10b, 16 | hub roles read "Branches"; the Branch Manager reads "Branch"; History adds "History" |
| C11 | History tables use two geometries (gap 16, padding 14, widths 130/110/130/100/130 vs gap 14, padding 12, widths 100/96/120/96/120) | 10 vs 10b | one table, step 10's numbers; the Branch column (110) on hub roles only |
| C12 | History "Rows per page" selects: "25" (10) and "8" (10b) | 10 vs 10b | the kit's options (25, 50, 100); the drawn values are sample data |
| C13 | Top-bar search: max-width **360** (11) vs **420** (5, 6, 7, 9, 10, 10b, 16); **no search** on 12b, 13, 17 | various | one top bar with the search, max 420 on every page (what it searches: G9) |
| C14 | Day file rail **240** wide, no footer total, rows "12 items" vs Today's figures rail **272**, with "BRANCH USED VALUE (KES)" footer and "Counted 6:20 pm" | 11 vs 6 | one `DepartmentPane`: 272 and the step 6 numbers; the footer total on both |
| C15 | Reason chip selected: weight **400** (step 12, H36) vs **600** (Branch waste W7, H34) | 12 vs Block 3 W7 | each as drawn (separate options; K16 note) |
| C16 | Activity tab: "Showing the 5 most recent of 10 entries" with no pager or link | 12b | build the kit's numbered pager and rows per page (G16) |
| C17 | Step 13 (Documents) draws no "Print the day sheet" button and no success note; 12b does | 12b vs 13 | the Print button on every file tab (as step 11); the success note only straight after a correction (G8-style, clears on refresh) |
| C18 | Print slate **`#6B7785`** (day sheet) vs **`#5B6670`** (delivery note) | 13b to 13d vs `delivery-note-print-screen.tsx` | each document as drawn; owner may unify |
| C19 | **The corrected figure's strike-through is not readable from Paper**: cells read "1 2" / "3 2" in one plain navy run; footnote says "struck through" | 13c | build: the Wednesday figure `line-through` in `#6B7785`, then the corrected figure weight 600 navy (G19) |
| C20 | Red blocker disc: white **"!"** (step 5) vs white **tick** (step 14) | 5 vs 14 | the "!" (the tick reads as done) |
| C21 | Drawer title: 20/**24**, no tracking (step 15) vs 20/**26**, −0.01em (8, 12); header padding-bottom 16 vs 18; close glyph absent on 15 | 15 vs 8, 12 | one drawer (K16): 20/26, −0.01em, padding 18, close glyph on all |
| C22 | Hard black **`#000000`** text: step 15 (items, boxes, PIN), step 17 (chips, most cells) | 15, 17 | ink `#171512` |
| C23 | Step 16's sidebar highlights **History**, not Today (checked by style); step 15's dimmed Today too | 16 | Today active |
| C24 | Step 16 breadcrumb "Branch / Day" | 16 | "Branches / Day" (see C10) |
| C25 | Branch picker: H36, 14/18, "Branch: Nyeri Town ▾" (step 16) vs H32, 13/16, "Branch: All branches ▾" (Branch waste W8) | 16 vs Block 3 W8 | one `BranchPicker` with a `size` option; "All branches" only where it makes sense (not on Today) |
| C26 | Step 17: title no tracking, top bar white (no gradient) and no search, "Procurement /" crumb | 17 | the shell's top bar, one title style (−0.01em) |
| C27 | Step 17 header: the 0.06em tracking is on WHEN only | 17 | on all column heads |
| C28 | Chapter 5 phone header is the **older shell** (22 chevron, mono label 11/14, 30 avatar, subtitle Geist 13/18, 20 + 4 top) vs the Block 2 header of steps 0 to 4 | steps 19, 20 vs 0 to 4 | `B2Header` on all (the family of the rest of Day) |
| C29 | Chapter 5 column heads abbreviate: OPEN, IN, WASTE, CLOSE, USED; everywhere else "Opening stock, Received, Waste, Closing stock, Used today" | step 20 vs 6, 11 | phone width forces abbreviations; keep, with the full word in `aria-label` and a legend in the footer note |
| C30 | Step 15's background shows Today as step 14 (Housekeeping already counted) while the drawer counts Housekeeping | 15 | the step 5 state behind the drawer |
| C31 | The sidebar badge on Today: "1" on step 5 (blocked); **none on step 14**, also blocked | 5 vs 14 | show it whenever something blocks the close (G12) |

**Paper against the flow document** (Paper wins; the document is what to correct):
- Flow doc: "Step 14 … with **Confirm for Kitchen**": Paper's step 14 draws no such button (only the wording table does): G21.
- Flow doc: "the Director's sidebar … **Requisitions**, Day (Today, History) and Waste under Branches": Paper's 10b, 16 and 17 sidebars have **Day** and **Waste** only (Requisitions is in the Central Store group, as the later 8 Oct decision says). Paper wins.
- Flow doc lists Audit areas "Catalog, Suppliers, Restock levels, Purchasing, Payments, Prep" plus five new; Paper step 17 draws chips for Catalog, Purchasing and the five new ones only (O3).
- Flow doc: "Step 5 Today … Used today in KES per department (Branch Manager sees values)": matches. "**Needs a look**" is gone in Paper (correctly removed with the unusual-figure rule).
- Flow doc step 6: "department rail with Used value and a branch total": matches (the rail shows the used value, not "Used value (KES)" text).

---

## 9. Gaps (not drawn) and the proposed build, built in the same style and reported, not omitted

Each is a proposal for the front-end session to build and report; none is Paper.

| # | Gap | Proposed build |
|---|---|---|
| G1 | **Step 0 morning state**: Paper's note says "In the morning the first card reads Check the opening and opens step 1" but draws only the evening state | Active card (the step 0 style) titled "Check the opening", sub "Last night's figures, signed at {time}. Check the shelves, then accept or recount.", button "Check the opening" → step 1. The other two cards are muted rings until done |
| G2 | **Step 0 delivery card when nothing has been delivered or it is unconfirmed**; "Delivery confirmed" when none came | Unconfirmed: active-style card "Delivery not counted yet" / "{DSP number} left the store at {time}", button "Count the delivery" (opens the Block 2 delivery count). No delivery: card reads "No delivery today" with a muted ring (the printed sheet says "No delivery today", step 13d) |
| G3 | **PIN failure and validation** (steps 2, 3b, 8, 12, 15): wrong PIN, fewer than 4 digits, locked after attempts | `PinField` error state: border `wds-error-fg`, halo `wds-error-bg`, the box clears, line under it 13/18 `wds-error-fg` "That PIN is not right. Try again."; the button stays disabled until 4 digits; after the contract's attempt limit "Too many tries. Wait 5 minutes." (copy proposed; the limit is the back end's) |
| G4 | **Step 3c edit**: what happens on tapping a figure | The box becomes the focused box (white, 1px `#B0610F`, halo) with the device number pad; Done returns; a changed figure gets a small "changed" marker (amber ring 6 × 6); "Back to check and sign" returns to 3b |
| G5 | **Step 5 "Close the day" disabled**: reason and focus | The red blocker row is the reason; the button keeps `aria-disabled="true"` and `aria-describedby` pointing at the first red row, so it announces "Close the day, unavailable: Housekeeping has not counted". It stays in the tab order |
| G6 | **Live updates on Today** | Socket events (count signed, delivery confirmed, opening recorded) update the cards and the blocker rows in place; `role="status"` announces "Housekeeping has counted"; no layout jump |
| G7 | **Close the day: errors, pending, conflict** | Pending: "Closing the day", button disabled; error line under the PIN (G3 style): "Could not close the day. Nothing was written. Try again."; conflict (a department changed after the page loaded): "{Department} changed after you opened this. Review it and close again." and the drawer closes to Today with the card flagged |
| G8 | **Step 9 persistence** | The confirmation shows after closing and on a refresh of that day's Today for the Branch Manager until the day is left; it is not a toast |
| G9 | **Top-bar "Search a day"**: what it searches | Day number and date, going to the day file or History filtered; ⌘K focuses it. Results list under it as `DAY-NYR-0044 · Wednesday 7 October · Closed`; "No day matches." Hub roles search across branches |
| G10 | **"See every line"** (step 8) | Expands the receipt in place (all 43 lines grouped by department, item, quantity used, value) inside the drawer's scroll; "Hide the lines" collapses |
| G11 | **An open day's day file** (History row "Open", figures "–") | The Day link opens Today for that day (hub roles: Today with the branch picker set); a closed day opens the day file. Open rows have no Closed by |
| G12 | **Sidebar badge** on Today | The number of blockers (departments not counted plus unconfirmed deliveries); hidden at 0; the same number as the red rows on Today |
| G13 | **After tomorrow's opening is accepted**: Correct a count is gone | The button is hidden; the info chip reads "Corrections are closed: tomorrow's opening has been accepted"; the rule still shows on the day file |
| G14 | **Correct a count: choosing the item** ("Change") | A searchable list (type-ahead, grouped by department) of the day's items in the drawer, replacing the chosen-item bar; selecting returns to the form with the closing stock was filled in |
| G15 | **"Other" needs a note**; empty and over-limit note | "Other" makes the note required (label "NOTE · REQUIRED"); the other two keep it optional; counter 200 characters (proposal) |
| G16 | **Activity tab beyond five entries** | The kit's `DataTable` with `TablePager` (numbered pager, rows per page), newest first; the five most recent are page 1 of 10 |
| G17 | **Day sheet pages 2, 3 and 5** (undrawn) and **overflow** | Same template as 13c with that department's rows; "Page N of M" computed. If a department's rows exceed one page: the table continues on the next page with the heading row repeated and a "Department {name}, continued" line; the total row and footnotes on the department's last page; the page count grows; the cover's PAGE column shows the first page of each department |
| G18 | **Several corrections on one day** | The cover's CORRECTION block lists each (newest last), one paragraph each; each corrected row carries an asterisk with the matching footnote number (`*`, `**`) |
| G19 | **Printed strike-through** | The Wednesday figure `text-decoration: line-through` 1px in `#6B7785`, then the corrected figure weight 600 navy, in the same right-aligned cell (the cell is already 50/44 wide); the row fill `#FBF6E9` |
| G20 | **A count made on behalf of a department** on the printed sheet | Signature cell: name "Peter Njoroge" in Alex Brush, caption "Housekeeping, on behalf · 7:24 pm"; the department page head line reads "Counted by the Branch Manager on behalf of the department at 7:24 pm" |
| G21 | **"Confirm for Kitchen"** on the blocked Today (step 14) | A secondary button H32 ("Confirm for Kitchen") on the right of the red row, Branch Manager and System Admin only; opens the existing Block 2 `confirm-for-department-drawer`; the row turns green on success |
| G22 | **"Count for {Department}"** on the "has not counted" row (step 5) | A secondary button H32 on the right of the red row opening step 15's drawer; Branch Manager and System Admin only |
| G23 | **Step 15 after "Check and sign"** | The receipt-style summary (as step 3b but "on behalf of Housekeeping", with "SIGNED BY Branch Manager") and the PIN field, in the same drawer; button "Send for Housekeeping" (proposed) |
| G24 | **Hub Today: picker dropdown, default, empty** | A `Select` (the kit's) listing the branches the role may read, "Nyeri Town" first; default the last branch used (URL `?branch=`); if the branch has no open day: "No open day at Karatina yet." |
| G25 | **The Branch Manager's Audit log link** (own branch) | A row "Audit log" in the Branch group (`nav-table.ts`), same screen scoped to their branch (branch filter fixed and hidden) |
| G26 | **Loading, empty, error, filtered-empty, permission-denied** for every screen (the wording table says "no per-screen states") | The States kit (`shell-states.tsx`, `mobile-states.tsx`, `scw-states.tsx`) with a copy table: Today loading "Getting today" (skeleton: five cards and three rows), empty "No open day for this branch yet." (hub role), error "Could not load the day. Try again."; History loading "Getting days", empty "No days in this range.", filtered-empty "No days match. Clear filters."; Day file loading "Getting the day", not found "This day does not exist."; Activity empty "Nothing has happened on this day yet."; Documents empty "No day sheet yet. One is made when the day closes."; phone count: loading "Getting your department", error "Could not load your items. Try again."; every write: an error line and the form kept (copy in the same voice as the Block 3 table) |
| G27 | **Widths between 390 and 1440** | Desktop at 1024 and 768: tables scroll inside their container; the department cards on Today wrap to 3 + 2 below 1280 and to 1 column below 768; the two-pane rail collapses to a department select above the table below 1024; drawers go full width below 768; phone screens use the 480 max-width phone column (`PhoneColumn`) above 480 |
| G28 | **The recount screen** (step 1 → "No, I'll recount") | The step 3 layout (blind count, boxes, progress strip, "N items still to count.") with the header title "Recount the opening", and the button "Check the difference" leading to step 2's receipt; "Back" returns to step 1 without saving |
| G29 | **Sidebar rows for Accountant, Store Manager, System Admin** (only the Director's are drawn) | The same Branches group as the Director's (Day with Today and History, Waste), through `nav-table.ts` rows; Store Manager and Accountant sidebars otherwise unchanged |
| G30 | **The head and member's phone menu** ("Count", "Waste" in the phone drawer, flow doc) | A row "Day" opening step 0 and (existing) "Waste"; part of the shell's nav table, not a screen |
| G31 | **History filter panels** (Status, Branch) | `Status`: All, Open, Closed, Corrected; `Branch`: All plus each branch the role may read; the kit's toolbar dropdowns |
| G32 | **Day file for an Open day viewed by a hub role** | Not a file: opens Today with the branch picker preset (G11) |
| G33 | **A member (not the head) signing** | Same screens; "SIGNED BY" shows the member's name and "Barista Member"; their own PIN |

---

## 10. Owner decisions needed

Each has a recommended default; the front-end sessions can proceed on the defaults.

| # | Decision | Recommended default |
|---|---|---|
| O1 | Chapter 5 (steps 19 and 20, the head's past days) is on the Paper page but not in the 28 screens or the index: is it in Block 4? | Yes, build it: a head needs it; two small screens; on `B2Header` (C28) |
| O2 | Button radius: Paper draws 0 on the Block 4 buttons; `B2PrimaryButton` is 2px | Keep the kit's 2px (default look kept, Block 3 ruling); add `rounded-none` only if you want Paper exact |
| O3 | Audit log area filter: chips (Paper) or the menu (code, steps 58 and 59) | Keep the menu, add the five Branches areas |
| O4 | Secondary phone button height 44 or 48 | 44 |
| O5 | History table geometry (one set) | Step 10's numbers; Branch column on hub roles |
| O6 | Step 16 and 15 sidebar highlight History while the page is Today | Build Today active; fix the Paper part when next touched |
| O7 | Where "Confirm for Kitchen" lives (undrawn on step 14) | A button on the red row (G21) opening the existing drawer |
| O8 | Step 15 background | The step 5 state (Housekeeping not counted) |
| O9 | Drawer variant (K16): 560 wide, link Cancel, close glyph, 45% scrim | Paper, as an option on `DrawerShell` |
| O10 | Printed strike-through form (C19, G19) | Line-through slate old figure, then weight 600 corrected figure |
| O11 | Paper's `#000000` text on steps 15 and 17 | Ink `#171512` |
| O12 | Step 9 ledger preview: 5 rows plus link, no pager | As drawn |
| O13 | Phone menu glyph path in `B2Header` (K1): kit's 3 to 21 bars vs Paper's 4 to 20 | Leave the kit as is (an edit would also touch Block 2) |

---

## 11. Check yourself

**Every drawn screen and state appears.** Steps 0, 1, 2, 2b, 3, 3b, 3c, 4 (section 2); 5, 6, 7, 8, 9 (section 3); 10, 10b, 10c, 11, 12, 12b, 13 (section 4); 13b, 13c, 13d (section 5); 14, 15, 16, 17, 18 (section 6); the extra chapter 5 (steps 19 and 20, section 7). Paper draws **one state per screen**; every other state is in the Gaps list (section 9). Pages 2, 3 and 5 of the day sheet are not drawn (G17); the Cover and the Screens index are not product screens and are noted in section 0.

**Every number came from a tool call.** Values come from `get_jsx` (inline styles, which also return the Paper token names) and `get_computed_styles` / `get_node_info` / `find_nodes` on the drawn nodes: all 28 screens, the Cover's index, Chapter 5, the sidebar link colours (steps 10b, 16, 17) and the scrim values (steps 8, 12, 15). **Derived numbers** are marked "derived" with their arithmetic (row heights, header and foot heights, A4 pixels, card widths, totals). Hex values for the two oklab gradient stops come from Paper's own `oklab(57.3% 0.069 0.112)` / `oklab(29.3% 0.052 0.059)`, which equal the token start `#B0610F` and end `#4A1D00` (the Block 3 spec made the same conversion); the scrim `#17151273` is 0x73/255 = 45.1% (derived). A screenshot was used once, on the printed corrected cell, only to see whether a strike was drawn (it is not: C19); no value was taken from it.

**Not verified, honestly.**
- The sidebar's Waste, Today and History **geometry** is copied from step 5's drawn nodes; the active link colours were checked by computed style on 10b, 16 and 17 only. The Director's sidebars on steps 10b, 16 and 17 differ from the Branch Manager's in their groups (checked by text search).
- I did not open the Paper "Group R" States kit; the states in G26 use the code's existing States kit and wording, not a drawing.
- Fonts are Geist, Geist Mono and (day sheet signatures) Alex Brush as returned by the tools; I did not run `get_font_family_info` because no Paper typography was written.
- Kit differences were read from the code (`B2Header`, `B2PrimaryButton`, `B2Footer`, `B2Banner`, `Chip`, `PinField`, `B2Tracker`, `DrawerShell`, `date-range-picker`, `table-pager`, the print frames); nothing was run in a browser.
- Step 6 and step 11 were compared by tool: the same nine columns and widths; the step 11 table's row, total and footnote values match step 6's (checked via the extracted values).





