# Progress Hub — Design Spec

Extracted from the approved Paper page "Progress Hub · Design" (file "Wendo RMS · Approved designs", page `p-D-0`) on 5 Oct 2026, using `get_jsx` with inline styles. Every number below is a value read from Paper, not estimated from a screenshot. Later build sessions use this file and do not open Paper.

**Sources of truth.** Paper wins over this file if they ever disagree. Where Paper does not show something (hover, focus, keyboard, breakpoints between 390 and 1440), the section says **Not in Paper** and gives the rule to use. Those rules are decisions made here, not approved designs. The owner can change them.

**Artboard map**

| # | Artboard | Size | Page it defines |
|---|---|---|---|
| 1 | Hub home | 1440 wide | `/` |
| 2 | Deck viewer (Workforce) | 1440 × 900 | Overview slide viewer shell |
| 3 to 7 | Slides: Screens in context, Title, The problem today, Who does what, Journey | 1280 × 720 | Slide types |
| 8 | Feature page, Journeys tab | 1440 wide | `/<feature>` with User journeys tab |
| 8b | Feature page, Overview tab | 1440 wide | `/<feature>` with Overview tab |
| 9 | Role page, Branch Manager | 1440 wide | `/<feature>/roles/<role>` |
| 10 | Journey viewer | 1440 × 900 | `/<feature>/roles/<role>/<journey>/<step>` |
| 11 | Journey outline (Being designed) | 1440 wide | Outline page |
| 12 | Mobile, Hub home | 390 wide | `/` on a phone |
| 13 | Mobile, Role page | 390 wide | Role page on a phone |
| 14 | Mobile, Journey viewer | 390 wide | Journey viewer on a phone |

**Not in Paper.** The "How to read this page" page (linked from the hub header) has no artboard. There is no feature-page mobile layout, no overview-viewer mobile layout and no outline-page mobile layout. Section 9 gives the rules to use.

---

## 1. Tokens

The Hub has its own palette. It is **not** the espresso and caramel palette in `frontend/app/tokens.wds.css`. Do not import the app tokens into `progress-hub/`. Define these as CSS variables in the Hub.

### Colour

| Token | Hex | Used for |
|---|---|---|
| `--hub-white` | `#FFFFFF` | Page ground (hub, feature, role, outline), panels, cards |
| `--hub-fog` | `#F3F5F8` | Viewer ground, slide ground, mobile step bar, callout panels |
| `--hub-ink` | `#0B1426` | Headings, table header rule, table text strong |
| `--hub-black` | `#000000` | Row titles, notes titles, sidebar feature name |
| `--hub-navy` | `#14284B` | Primary button, links, progress fill, active tab, filled markers, dark slides |
| `--hub-slate` | `#5B6676` | Secondary text, mono labels |
| `--hub-body` | `#47505E` | Row descriptions, list text |
| `--hub-notes` | `#2B3544` | Notes text on desktop |
| `--hub-line` | `#D9DEE6` | All hairlines, input and chip borders |
| `--hub-line-soft` | `#EEF1F5` | Faint row rule inside the journey slide, window chrome fill |
| `--hub-track` | `#E6EAF0` | Progress bar track |
| `--hub-faint` | `#9AA6B8` | Empty checkbox border, dashes, "After build", not-designed borders and numbers |
| `--hub-faint-text` | `#8A93A3` | "Staff trained: after build" on mobile |
| `--hub-blue` | `#2C6ECB` | Accent: eyebrow labels, "In progress" dot, active step number and rail, screen markers |
| `--hub-blue-wash` | `#EEF3FB` | Active row background in the slide and step lists |
| `--hub-success` | `#2F6438` | Approved text and dot |
| `--hub-success-bg` | `#EEF4EC` | Approved badge fill |
| `--hub-success-border` | `#CADFC6` | Approved badge border |

Colours used only inside the dark navy slides (`#14284B` ground):

| Hex | Used for |
|---|---|
| `#8FB0E8` | Eyebrow text, "Pay" step, dashed outline marker |
| `#B8C6E0` | Body text on navy |
| `#8FA3C7` | Footer line on the title slide |
| `#3D5A8C` | Connector lines between step circles |
| `#244274`, `#1B335E` | Calendar-grid blocks on the title slide (`#8FB0E8` for highlighted cells) |

Other values: slide thumbnail grey `#EEF1F5`; slide progress inactive segment `#C9D1DD`; window dots `#C9D1DD`; window border `#D2D8E1`; mobile window dots `#C5CCD8`.

**Text contrast.** `--hub-slate` on white is 5.9 to 1 and passes. `--hub-faint` (`#9AA6B8`) on white is about 2.5 to 1 and **fails** 4.5 to 1. Paper uses it for "After build", dashes and the not-designed row numbers. PRD section 9 requires 4.5 to 1. Rule: use `--hub-faint` for borders and dashes only. For text that carries meaning ("After build", "Not started" dashes) use `--hub-slate` or `#6B7586`. The visual change is small. Flag this to the owner at the quality pass (task 12).

### Type

Fonts: **Geist** for text, **Geist Mono** for small labels and numbers (PRD section 9). Paper's export writes `system-ui` for the text font because the Hub page was drawn with the default sans; the approved screens render in Geist in the owner's Paper file, and the PRD says Geist. Use Geist with `system-ui, sans-serif` as fallback.

| Role | Size / line | Weight | Tracking | Where |
|---|---|---|---|---|
| Display (hub title) | 60 / 64 | 600 | -0.035em | Hub home h1 |
| Page title (feature) | 56 / 60 | 600 | -0.04em | Feature page h1 |
| Page title (role, outline) | 52 / 56 | 600 | -0.04em | Role and outline h1 |
| Page title mobile | 36 / 40 | 600 | -0.04em | Mobile hub and role h1 |
| Lede | 19 / 28 (hub), 17 / 26 (others) | 400 | 0 | Text under the h1 |
| Lede mobile | 16 / 24 | 400 | 0 | |
| Section title | 24 / 30 | 600 | -0.02em | "In short", "All slides", "Choose your role" |
| Row title large | 20 / 24 | 600 | -0.02em | In-progress feature name |
| Row title | 18 / 22 | 600 | -0.01em | Role, journey and outline step titles |
| Row title small | 16 / 20 | 600 | 0 | Planned feature name |
| Body large | 16 / 25 | 400 | 0 | "In short" paragraph |
| Body | 14 / 20 | 400 | 0 | Row descriptions |
| Notes text | 14 / 21 desktop, 16 / 24 mobile | 400 | 0 | Notes steps |
| Button / link | 14 / 18 or 15 / 18 | 500 | 0 | Open, Download, breadcrumbs |
| Small | 13 / 16 | 400 | 0 | Updated dates, captions |
| Caption | 12 / 16 | 400 | 0 | Chips, footers |
| Eyebrow | Geist Mono 11 / 14 | 400 | 0.08em, uppercase | "03 · FEATURE" in `--hub-blue` |
| Mono label | Geist Mono 10 / 12 | 400 | 0.08em, uppercase | Table headers, NOTES, STEPS |
| Mono number | Geist Mono 12 / 16 | 400 | 0 | Row numbers, counts |
| Mono meta | Geist Mono 11 / 14 | 400 | 0.04em | "SLIDE 3 OF 12", "UPDATED 5 OCT 2026" |

In the viewer top bar, notes panel and slide thumbnails the mono labels use tracking 0.1em.

### Spacing, radius, elevation

- Page side margin: **80px** at 1440, **16px** at 390. Content is full width with that margin; no max-width container is drawn.
- Radius: **2px** on buttons, chips, badges and tags. 3px on checkboxes and progress tracks. 4px on small cards and mobile window. 6px on the desktop window frame. 24px on the phone frame. Circles use half the size.
- Shadow on window frame: `0 20px 40px #14284B1F` (viewer) and `0 24px 48px #14284B24` (slide). Phone frame: `0 28px 56px #0B142652`. Nothing else has a shadow.
- Hairlines are 1px `--hub-line`. The table header rule is 1px `--hub-ink`.

---

## 2. Shared parts

### Site header (hub, feature, role, outline pages)

72px tall, white, 1px `--hub-line` bottom border, 80px side padding, items vertically centred, space between left and right groups.

- Left group, gap 12: logo image 36 × 36 round (radius 18; asset is the Wendo logo, `progress-hub/public/logo.jpg`), then "Wendo RMS" (Geist 15 / 18, 600; ink on the hub, black on others), then a 1 × 18 `--hub-line` divider, then the page context.
- Hub home context: "Progress" (15 / 18, slate). Right group, gap 28: "UPDATED 5 OCT 2026" (mono meta, slate, uppercase) and "How to read this page" (14 / 18, 500, navy).
- Feature page context: "← All features" (15 / 18, 500, navy). Right: mono meta "UPDATED 5 OCT 2026".
- Role and outline pages: breadcrumb in the left group after the divider: "All features / Workforce / Branch Manager" in 14 / 18. Ancestors are slate, the separator "/" is `--hub-faint`, the current page is navy 500. Right: "← All roles" (role page) or "← Branch Manager" (outline page), 14 / 18, 500, navy.
- The date comes from the content file's last-updated value, formatted "5 Oct 2026".

### Status strip (hub row and feature header)

Four columns, same data in both places.

- **Designed**: bar track 6px high, radius 3, `--hub-track`; fill `--hub-navy`, fill width = designed ÷ total × track width. Track 140px wide in a hub row, 120px in the feature header. Under it a mono 12 / 16 count, "9 of 16 chapters". The unit word comes from content ("chapters", "areas").
- **Approved** and **Built**: a 20 × 20 checkbox, border 1.5px `--hub-faint`, radius 3, empty when false. Ticked: fill `--hub-success`, white tick, border `--hub-success`. Display only, never a form control (HH-4); render as a non-interactive element with an accessible label such as "Approved: no".
- **Staff trained**: text "After build" (13 / 16, `--hub-faint`, see contrast rule) until Built is ticked. After Built is ticked it shows a checkbox like the other two.
- In the feature header each column has a mono label above (10 / 12, tracking 0.08em) and a small caption below the checkbox ("Not yet", 12 / 16, slate). Column gap 40.

### Buttons and links

| Kind | Height | Padding | Fill | Border | Text |
|---|---|---|---|---|---|
| Primary | 36 in a table row, 44 on feature page, 48 on phone | 0 16 (row), 0 20 (page) | `--hub-navy` | none | white, 14 or 15, 500 |
| Secondary | same | same | transparent | 1px `--hub-line` (`--hub-navy` for "Coming soon") | black or ink, 14 or 15, 400 |
| Small (viewer bar) | 32 | 0 12 | transparent | 1px `--hub-line` | ink, 13 / 16 |
| Icon square (viewer bar) | 32 × 32 | centred | transparent, or navy for Next | 1px `--hub-line` | arrow, 14 |
| Text link | n/a | n/a | n/a | n/a | navy, 14 / 18, 500, "Open →" |

Radius 2 on all. A button that goes nowhere yet ("Coming soon") is shown outlined in navy and is not a link.

### Chips and badges

- **Tag chip** (role, device, "who this affects"): padding 4 10 (5 10 in the notes panel), 1px `--hub-line` border, radius 2, 12 / 16 text, black or ink, white fill on the fog viewer ground and none elsewhere.
- **Approved badge**: padding 4 10, fill `--hub-success-bg`, 1px `--hub-success-border`, radius 2, text `--hub-success` 12 / 16, 500.
- **Being designed badge**: padding 4 10, **dashed** 1px `--hub-faint` border, radius 2, no fill, text slate 12 / 16, 400.
- **Status dot**: 8 × 8 circle. In progress `--hub-blue`, approved `--hub-success`, not designed or planned `--hub-line`, "Designed" legend `--hub-navy`. Legend dots on the hub intro are 10 × 10 radius 5.

---

## 3. Hub home (artboard 1, mobile artboard 12)

### Desktop, 1440

1. Site header (section 2).
2. **Intro**, padding 72 80 56, two columns bottom-aligned, gap 80, space between.
   - Left, 760 wide, gap 20: eyebrow "RESTAURANT MANAGEMENT SYSTEM REBUILD" (mono 11, tracking 0.08em, `--hub-blue`), h1 "Where each feature stands" (60 / 64, 600, -0.035em, ink), lede (19 / 28, slate).
   - Right, 380 wide, gap 14, padding-bottom 6: three legend lines, each a 10 × 10 dot (navy, success, `--hub-line`), gap 10, then 14 / 18 ink text. Text: "Designed: screens are drawn" / "Approved: the whole feature is signed off (tick)" / "Built, Staff trained: ticked when done". The third line is 600 weight in Paper; treat it as a drawing slip and use 400 for all three unless the owner asks otherwise.
3. **Table**, padding 0 80 80. Column widths, left to right: No. 48, Feature 260, What it covers 320, Designed 180, Approved 100, Built 100, Staff trained 120, Open 152 (right-aligned). Total 1280.
   - Header row 40 high, 1px `--hub-ink` bottom border, mono labels 10 / 12, tracking 0.08em, slate, uppercase. "Open" is right-aligned.
   - **Group header** "In progress": 44 high, 8 × 8 `--hub-blue` dot, margin-right 10, then "In progress" 13 / 16, 600, navy. "Planned" group header: 56 high, 16 top margin, dot `--hub-line`, text slate 13 / 16, 600.
   - **In-progress row**: 96 high, 1px `--hub-line` top border, items centred.
     - No.: mono 12 / 16, slate ("03"); a dash "—" for Inventory (not numbered).
     - Feature: name 20 / 24, 600, -0.02em, black; under it "Updated 5 Oct 2026" 13 / 16 slate; gap 4.
     - What it covers: 14 / 20, `--hub-body`, padding-right 40.
     - Designed: bar and count (section 2), gap 8.
     - Approved, Built: checkbox.
     - Staff trained: "After build".
     - Open: primary button "Open →". For a feature with no deck: secondary button "Coming soon" (HH-5).
   - **Planned row**: 52 high, 1px `--hub-line` top border. Name 16 / 20, 600, black. Description 14 / 18 `--hub-body`. Designed column "Not started" (13 / 16 slate). Approved, Built, Staff trained show "—" (13 / 16, `--hub-faint`, see contrast rule). No Open button (HH-3). The last row also has a 1px bottom border.
   - Order: roadmap order within each group (HH-1). Workforce is 03, Inventory shows "—" and comes second in the in-progress group.
   - Row hover and focus: **Not in Paper.** Rows are not clickable except the Open button. Give the Open button the focus ring in section 8.

### Mobile, 390

- Header 56 high, 1px bottom border, padding 0 16: logo 28 × 28 round, "Wendo RMS" 15 / 18 600, divider 1 × 16, "Progress" 14 / 18 slate; right "How to read" 14 / 18 500 navy.
- Intro, padding 32 16 28, gap 12: eyebrow, h1 36 / 40, lede 16 / 24, then legend (gap 8, padding-top 8) with 8 × 8 dots and 13 / 18 text in `--hub-body`.
- "In progress" group: 40 high, 1px ink top border and 1px line bottom border, 8 × 8 dot, 13 / 18 600 ink text.
- In-progress **card** (each feature), padding 20 0 24, 1px line bottom border, column gap 14:
  1. Number (mono 12) and name (20 / 24 600), baseline aligned, gap 10.
  2. Description 14 / 20 `--hub-body`.
  3. Bar full width, 4px high, radius 2, then count (mono 12).
  4. Checkboxes row, gap 20: checkbox 20 × 20 (radius 2, 1px border) + label "Approved" 13 / 18; same for "Built"; then "Staff trained: after build" 13 / 18 `--hub-faint-text`.
  5. Button full width, 48 high: primary "Open →" (15 / 18, 500) or outlined "Coming soon".
  6. "Updated 5 Oct 2026" 12 / 16 slate.
- "Planned" list: group header 56 high with 16 top padding; rows 56 high, 1px top border, gap 10: number (mono 12, 24 wide), name (16 / 20 600, grows), "Not started" (13 / 16 slate, right). Bottom padding 48. Paper draws six rows and a note "Same rows continue for 07 to 10"; build all rows from the data, not the note.

---

## 4. Feature page (artboards 8b Overview, 8 Journeys; no mobile artboard)

### Header block (both tabs)

- Site header (section 2).
- Title block, padding 56 80 40, two columns bottom-aligned, gap 60. Left 640 wide, gap 14: eyebrow "03 · FEATURE" (number from content), h1 56 / 60, lede 17 / 26 slate. Right: the status strip (section 2), gap 40, padding-bottom 6.

### Tabs

Row with 1px `--hub-line` bottom border, padding 0 80, gap 32. Each tab has padding 14 0 and text 15 / 18.

- **Active**: navy 2px bottom border, text navy 600.
- **Inactive**: no border, text slate 400.
- Overview is the default (FP-2). Tabs are links (`/<feature>` and `/<feature>/journeys`) so the browser back button works. The URL for the journeys tab is a build decision; the PRD lists a single address.
- Hover on an inactive tab: **Not in Paper.** Text changes to ink.

### Overview tab (8b)

1. **Two columns**, padding 48 80 32, gap 64.
   - Left, 620 wide, gap 16: "In short" (24 / 30 600 -0.02em black), paragraph (16 / 25 `--hub-notes`), then buttons row (gap 12, padding-top 8): primary "Start the overview →" 44 high 15 / 18 500, secondary "Download PDF" 44 high. Under: "8 slides · about 5 minutes to read. Each slide has notes." 13 / 16 slate. Slide count and reading time come from the deck file.
   - Right, grows, gap 14: mono label "WHAT THE OVERVIEW COVERS", then a list with 1px ink top border. Each row padding 12 0, 1px line bottom border, gap 16: mono 14 / 18 number (slate, 24 wide), then title 14 / 18 black.
2. **All slides**, padding 24 80 80, gap 20. Title row with baseline alignment and space between: "All slides" (24 / 30 600) and "Click a slide to open it" (13 / 16 slate).
   - **Slide grid**: 4 per row, each tile 270 wide, gap 20 horizontally and 20 between rows; tile = 152 high thumbnail + 10 gap + caption 13 / 16 slate "01 Title". Caption for not-designed slides uses `--hub-faint` and adds "· in design".
   - **Thumbnail types** (each is a tiny mock of the slide type, drawn from the slide's own data):
     - Title: navy fill, padding 16, content aligned to the bottom, title 22 / 28 600 -0.03em white.
     - Text list ("problem"): white, 1px line border, padding 16, gap 6; title 14 / 18 600 ink, then a 1px ink rule, then three 5px-high bars of `--hub-track` at widths 200, 220, 160.
     - Flow ("how it works"): navy, padding 16, title 14 / 18 600 white at top; at bottom a row of 14px white circles joined by 1px `#3D5A8C` lines; the last circle is a 13px dashed `#8FB0E8` circle when the step is not designed.
     - Roles: white, 1px line border, padding 16, gap 8; title 14 / 18 600; five 36 × 70 `#EEF1F5` blocks, gap 6.
     - Screens in context: fog fill, 1px line border, no padding; a white 170 × 100 rectangle (border `#D2D8E1`, radius 3) at left 14, top 30, and a black 60 × 96 rounded rect (radius 8) at left 190, top 50.
     - Journey: fog fill, 1px line border, padding 16, gap 6; title 14 / 18 600; three bars 14 high: solid navy 90 wide, 1px navy outline 130 wide offset 70, 1px dashed `--hub-faint` 110 wide offset 150.
     - **Not designed** (FP-5): white fill, **dashed** 1px `--hub-faint` border, padding 16, gap 8; title 14 / 18 600 slate; text 12 / 17 slate "Screens not designed yet. Shown as an outline."
   - Clicking a tile opens the viewer at that slide. The tile is one link. Focus and hover: section 8.

### User journeys tab (8)

1. Heading block, padding 40 80 24, gap 6: "Choose your role" (24 / 30 600 -0.02em), text 15 / 22 slate, 700 wide.
2. **Role table**, padding 0 80 80. Header row 40 high, 1px ink bottom border, mono labels. Columns: Role 240, What they do in Workforce 560, Journeys ready 160, In design 160, Open 80 (right-aligned). Total 1200 (this table is narrower than the content width; it starts at the left margin and does not stretch).
   - Row 68 high, 1px line bottom border. Role name 18 / 22 600 -0.01em black. Summary 14 / 20 `--hub-body`, padding-right 40. "Journeys ready" mono 13 / 16 black. "In design" mono 13 / 16 slate. "Open →" 14 / 18 500 navy, right aligned.
   - A role with no ready journeys still shows "Open →" because its page shows the outline list.
   - The column header text "What they do in Workforce" uses the feature name from content.

---

## 5. Role page (artboard 9, mobile artboard 13)

### Desktop

- Site header with breadcrumb (section 2).
- Title block, padding 56 80 40, two columns bottom-aligned, gap 60. Left 720 wide, gap 14: eyebrow "WORKFORCE · ROLE", h1 52 / 56 (role name), lede 17 / 26 slate. Right: secondary button "Download journeys as PDF", 40 high, padding 0 16, 14 / 18.
- **Journey table**, padding 0 80 80. Columns: No. 48, Journey 420, When you do it 440, Steps 100, Status 152, Open 80 (right-aligned). Total 1240.
  - Header 40 high, ink bottom border, mono labels.
  - Row 76 high, 1px line bottom border. Number mono 12 / 16 slate. Title 18 / 22 600 -0.01em black. "When" 14 / 20 `--hub-body`, padding-right 40. Steps mono 13 / 16 black. Status: Approved badge. Open "Open →".
  - **Being designed row** (RP-3): number `--hub-faint`, title slate (18 / 22 600), "when" slate, steps "—" (13 / 16 `--hub-faint`), Being designed badge (dashed), and the last column says **"Outline"** (14 / 18 slate, not navy, not bold) and links to the outline page.

### Mobile, 390

- Header 56 high: logo 28 round + "Wendo RMS"; right "← All roles" navy 14 / 18 500.
- Breadcrumb row 44 high, padding 0 16, gap 8, 13 / 18: ancestors slate, "/" `--hub-faint`, current navy 500.
- Title block, padding 16 16 28, gap 12: eyebrow, h1 36 / 40, lede 16 / 24, and a full-width outlined button 44 high "Download journeys as PDF" (14 / 18) with 4px top margin.
- **Journey list**, padding 0 16 48. Header "JOURNEYS" (mono 10), 40 high, ink bottom border. Each journey is a row with padding 18 0, 1px line bottom border, gap 12 across three zones: number (24 wide, padding-top 3, mono 12 slate); body (grows, gap 6) with title 18 / 22 600, description 14 / 20 `--hub-body`, and a badge line (padding-top 4, gap 12) with the status badge and "10 steps" (mono 12 / 16 `--hub-body`); right: "Open →" (14 / 18 500 navy, padding-top 2). A designing row shows the dashed badge, no step count, and "Outline" in slate.

---

## 6. Viewer (artboards 2 and 10; mobile artboard 14)

One component for the overview slides and the journey steps (SV-1).

### Desktop, 1440 × 900

Ground `--hub-fog`. Column layout: top bar 60 px, then a row that fills the rest.

**Top bar** (60 high, white, 1px line bottom border, padding 0 24, space between):

- Left, gap 14: back link ("← All features" in the deck viewer, "← Branch Manager" in the journey viewer; 14 / 18, 500, navy); 1 × 18 divider; title (15 / 18 600, black; -0.01em in the deck viewer); position label (mono 11 / 14, tracking 0.04em, slate, uppercase): "SLIDE 3 OF 12" or "STEP 1 OF 10".
- Right, gap 10: "Download PDF" small button; previous icon button (outline); next icon button (navy fill, white arrow).

**Left list** (white, 1px line right border, padding 20 0, gap 2): width **232** in the deck viewer, **260** in the journey viewer.

- Header "SLIDES" or "STEPS": mono 10 / 12 tracking 0.08em slate, padding 0 20 10.
- Item: 34 high in the deck list, 36 in the journey list, padding 0 20, gap 12. Number: mono 11 / 14 slate, 20 wide, flex-shrink 0. Title 13 / 16 `--hub-body`.
- **Active item**: fill `--hub-blue-wash`, 2px `--hub-blue` left border, left padding reduced to 18 so text does not move, number in `--hub-blue`, title navy 600.
- **Not designed item** (deck list only): a 6 × 6 `--hub-line` dot pushed to the right (margin-left auto).
- Footer, pinned bottom (margin-top auto), padding 0 20: deck list shows 6 × 6 dot and "Screens not designed yet" (12 / 16 slate); journey list shows mono label "OTHER JOURNEYS" (10 / 12) and a navy 13 / 16 500 link "Check who is in today →" (SV-6).

**Centre stage** (grows, min-width 0, padding 24, gap 14 to 16, content centred vertically).

- **Journey viewer**, above the screen: a line of chips, gap 10: role chip ("Branch Manager"), device chip ("Computer" or "Phone"), both white fill with 1px line border; then the "where to click" text "Schedule, then Rota" (13 / 16 `--hub-body`) (SV-4).
- **Window frame** (computer screens): white, 1px `#D2D8E1` border, radius 6, shadow, overflow clipped. A 22px chrome bar (`#EEF1F5`, 1px line bottom border, padding 0 10, gap 6) with three 7 × 7 `#C9D1DD` dots; then the image area. Frame is 772 × 530 in the journey viewer (770 × 506 image area) and 762 × 497 on the "Screens in context" slide. The image is the exported screen scaled to the frame width, background-size 100% 100%, cropped so the top of the browser bar in the source is hidden (Paper offsets the image up by 23 to 24 px). Keep the source aspect ratio; do not stretch. Export the images already cropped (tasks 3 and 4) so the page needs no offset.
- **Phone frame** (phone screens): white, 6px `--hub-ink` border, radius 24, shadow, 226 × 480 on the "Screens in context" slide. Image fills the inside (214 × 468).
- **Numbered markers** (SV-5): 26 × 26 circle, fill `--hub-blue`, 2px white border, white 13 / 16 600 number, absolutely positioned over the screen. Each marker number matches a numbered note.
- Caption under the frame: "Approved design. Names and numbers are sample data." (12 / 16 slate). Mobile: "Approved design. Sample data only."
- **Deck viewer, slide stage**: the slide is a 820 × 461 (16:9) surface; for a 1280 × 720 slide, scale to 820 wide. Below it, space between, 820 wide: **progress segments** (left) and the keyboard hint (right, 12 / 16 slate, "Use the arrow keys or swipe to move between slides"). Segments: 4 px high, radius 2, gap 6; width 18 each; past slides `--hub-navy`, current slide **28 wide** `--hub-blue`, future slides `#C9D1DD`.

**Notes panel** (white, 1px line left border, padding 24, gap 18 to 20): width **340** in the deck viewer, **360** in the journey viewer.

- Header row: mono "NOTES" (10 / 12, tracking 0.1em, slate) and "Hide" (12 / 16 500 navy), space between (SV-3).
- Title: 20 / 26 600 -0.02em black.
- **Numbered notes** (journey): each note is a 22 × 22 navy circle with white 12 / 16 600 number, gap 10, then text 14 / 21 `--hub-notes`; notes gap 10.
- **Plain notes** (deck): paragraphs 14 / 21, gap 12.
- 1px `--hub-line` rule, then the sections below, separated by the same rule:
  - Journey: mono "WHAT HAPPENS NEXT" (10 / 12, tracking 0.1em) then paragraph 14 / 21; gap 6.
  - Deck: "STATUS OF THESE SCREENS" with status lines (8 × 8 dot, gap 8, 13 / 16 black; gap 10 between lines) then "WHO THIS AFFECTS" with tag chips (12 / 16, padding 5 10, gap 6, wrap).
- Footer pinned to the bottom (journey): 8 × 8 `--hub-success` dot, "Approved 5 Oct 2026" 13 / 16 black.
- When notes are hidden, the stage takes the freed width and the "Hide" link becomes "Show notes" in the top bar (Not in Paper, build decision).

### Slide types (artboards 3 to 7, 1280 × 720)

Slides are authored data, not hand-built pages. Each slide has a `type`. Types seen in Paper: **title**, **text-list** ("The problem today"), **roles-grid**, **journey-grid**, **screens-in-context**, **flow** ("How it fits together", inside the deck stage). The build renders them scaled to the stage. Padding is 64 unless noted.

- **title** (navy `#14284B`, 64 padding, column, space between): top row with logo 36 round + "Wendo RMS" (15 / 18 600 white) and eyebrow right (mono 11, tracking 0.1em, `#8FB0E8`); middle: eyebrow "03 · WORKFORCE" (mono 12 / 16 tracking 0.1em `#8FB0E8`), title 112 / 108 600 -0.05em white, lede 26 / 36 `#B8C6E0`, 760 wide, gap 28; bottom: step line "Plan — Work — Check — Pay" (15 / 18 white, last `#8FB0E8`, connectors 28 × 1 `#3D5A8C`, gap 14) and audience line right (13 / 16 `#8FA3C7`). Decorative calendar grid at left 820, top 200, 396 wide: seven columns of 48 × 34 blocks, gap 10.
- **text-list** (white; padding 72 64; two columns, gap 72): left 360 wide, gap 20: eyebrow, title 48 / 52 600 -0.04em black, text 16 / 24 slate; right grows: items with padding 22 0 and gap 24, first item 1px ink top border, others 1px line top border, last also bottom border; number mono 13 / 16 `--hub-blue` in a 32-wide slot; item title 21 / 26 600 -0.02em black; item text 15 / 22 `--hub-body`.
- **roles-grid** (white; gap 40): eyebrow, title 44 / 48 600 -0.035em ink; a 372-high table with 1px ink top border and six columns each 192 wide (padding 24 20 0; first column has no left padding, last has no right padding; each column after the first has a 1px line left border). Column: name 20 / 24 600 -0.02em in a 52-high slot (so Does/Sees line up), then label "DOES" (mono 10, 6 gap) and text 14 / 20 `--hub-notes`, then "SEES" the same, gap 18. Under the table a fog panel (radius 2, padding 20 24, gap 48) with two equal columns divided by a 1px line: heading 14 / 18 600 ink, text 14 / 20 `--hub-body`.
- **journey-grid** (fog ground; absolute layout): eyebrow and title (40 / 44 600 -0.035em) at left 64, top 56; a white card at left 64, top 176, 1152 wide with 1px line border. Header row 44 high, 1px line bottom border; first column "WHO" 176 wide with 20 left padding; four phase columns 244 wide each, mono 10 / 12 labels "1 · PLAN" etc. Rows 92 high, 1px `--hub-line-soft` bottom border; row label 15 / 18 600 black. **Cells** are 224 wide (20 right margin), padding 10 12, text 13 / 18: *a person acts* = navy fill, white text; *the system does it* = 1px navy outline, black text; *screens not designed yet* = 1px **dashed** `--hub-faint` outline, slate text. Legend at left 64, top 650: 14 × 14 swatches of the same three cell styles, gap 28, text 12 / 16 slate.
- **screens-in-context** (fog ground; absolute layout): left column at left 64, top 72, 340 wide, 576 high, space between: eyebrow "PLAN AND WORK", title 42 / 46 600 -0.035em black; two numbered paragraphs (26 × 26 navy circle with white 13 / 16 600 number, gap 14; heading 16 / 20 600 black; text 14 / 21 `--hub-body`; gap 28) and a caption 12 / 16 slate. Window frame at left 440, top 84, 762 × 497; phone frame at left 1000, top 196, 226 × 480, overlapping the window; markers 1 and 2 at (858, 166) and (984, 260).
- **flow** (navy card): eyebrow `#8FB0E8` mono 10 / 12 tracking 0.1em; title 34 / 38 600 -0.03em white, 600 wide; a row of four 32 × 32 white circles with navy 14 / 18 600 numbers joined by 1px `#3D5A8C` lines (the last is a 30 × 30 dashed `#8FB0E8` circle with `#8FB0E8` number when not designed); under it four 160-wide columns (gap 24): title 18 / 22 600 white (last `#8FB0E8`) and text 13 / 19 `#B8C6E0`, gap 6. Card padding 44 48.

### Mobile viewer, 390 (artboard 14, journey viewer)

Vertical scroll, sticky bottom bar. Order:

1. **Top bar**, 56 high, 1px line bottom border, padding 0 16, space between: "← Branch Manager" (14 / 18 500 navy), "STEP 1 OF 10" (mono 11 / 14, tracking 0.08em, slate).
2. **Step bar**, 48 high, fog fill, 1px line bottom border, padding 0 16, space between: mono 12 `--hub-blue` number + step title (14 / 18 500 ink), gap 10; right "All 10 steps ⌄" (13 / 18 navy). This opens the step list (a sheet or inline list; sheet look **Not in Paper**).
3. **Heading**, padding 20 16 16, gap 12: journey title 24 / 28 600 -0.03em ink; chips (12 / 16, padding 4 10, 1px line border, gap 8, wrap): role, device; text "Where to click: Schedule, then Rota" 14 / 20 slate.
4. **Screen**, padding 0 16, gap 8: window frame 358 wide, 1px line border, radius 4, with a 16-high chrome bar (fog fill, 1px bottom border, dots 5 × 5 `#C5CCD8`, gap 5, left padding 8) and image area 356 × 234. For a phone screen use the phone frame scaled to fit. Under it a row (space between): caption "Approved design. Sample data only." (12 / 16 slate) and "Tap to enlarge" (13 / 18 500 navy). The enlarge view is **Not in Paper**: use a full-screen overlay with the image, close button 44 × 44, pinch zoom allowed.
5. **Notes**, padding 28 16 32, gap 16: header row "NOTES" (mono 10) and "Hide" (14 / 18 500 navy); title 20 / 26 600 -0.01em ink; numbered notes (24 × 24 navy circle with 12 / 16 600 white number, gap 12; text 16 / 24 ink); 1px line rule; "WHAT HAPPENS NEXT" mono label and text 15 / 22 ink.
6. **Bottom bar**, 72 high, white, 1px line top border, padding 0 16, gap 12, pinned to the bottom: previous button 48 × 48 (1px line, radius 2, arrow 18 / 22 slate), centre (grows, centred, gap 2) "1 / 10" (mono 12 / 16 ink) over a 120 × 3 progress track (`--hub-track`, radius 2, navy fill), next button 48 × 48 navy fill with white arrow. Swipe left and right also move between steps (SV-2).

---

## 7. Outline page (artboard 11, "Being designed")

Opened from a "Being designed" journey (RP-3); there is no viewer.

- Site header with breadcrumb of four levels: "All features / Workforce / Branch Manager / Approve a leave request"; right "← Branch Manager".
- Title block, padding 56 80 48, gap 14: eyebrow "WORKFORCE · BRANCH MANAGER · OUTLINE"; row (centred, gap 20): h1 52 / 56 and the Being designed badge (flex-shrink 0); lede 17 / 26 slate, 720 wide. The lede always says the screens are not drawn yet and that the page shows a plain-words outline (writing rule 4).
- Body, padding 0 80 96, two columns top-aligned, gap 80:
  - Left, 760 wide: header row 40 high with 1px ink bottom border and mono label "WHAT YOU WILL DO · OUTLINE" (10 / 12). Each outline step: padding 24 0, 1px line bottom border, gap 20, top-aligned; a 28 × 28 **dashed** circle (1px `--hub-faint`, number mono 12 / 16 slate); title 18 / 22 600 -0.01em ink; text 15 / 22 `--hub-body`, 640 wide; title and text gap 4.
  - Right, 360 wide, gap 24: **status panel** with 1px dashed `--hub-faint` border, radius 2, padding 24, gap 12: mono label "STATUS", heading 20 / 26 600 -0.01em ink "Screens not designed yet", text 14 / 21 `--hub-body` ("The steps on the left are a plain-words outline. They may change when the leave screens are approved. Nothing here is a promise of how it will look."); then "OTHER JOURNEYS" mono label with links 14 / 18 500 navy, gap 10.

---

## 8. States

Paper draws the default state of each component. It does **not** draw hover, focus, pressed or disabled. Use these rules.

| State | Rule | Source |
|---|---|---|
| Focus (every link, button, tab, list item, slide tile) | 2px outline in `--hub-blue`, 2px offset, never removed. Use `:focus-visible` | Not in Paper; PRD section 9 requires visible focus |
| Hover, primary button | Fill `#0B1426` (ink) | Not in Paper |
| Hover, secondary button and icon button | Fill `--hub-fog` | Not in Paper |
| Hover, text link ("Open →", breadcrumbs, back links) | Underline, same colour | Not in Paper |
| Hover, left-list item | Fill `--hub-fog`; active item keeps its blue wash | Not in Paper |
| Hover, slide tile | Thumbnail border becomes `--hub-navy` | Not in Paper |
| Active tab | Navy 2px bottom border, navy 600 text | Paper |
| Active list item | Blue wash, 2px blue left rail, blue number, navy 600 title | Paper |
| Disabled (previous on first step, next on last) | 40% opacity, no hover, `aria-disabled` | Not in Paper |
| Checkbox, unticked | 20 × 20, border 1.5px `--hub-faint`, radius 3 | Paper |
| Checkbox, ticked | Fill `--hub-success`, white tick (about 12px), border `--hub-success`; same size | Not in Paper (no ticked checkbox is drawn); derived from the Approved colour |
| Staff trained, before Built | Text "After build" | Paper |
| Staff trained, after Built | Checkbox | Not in Paper |
| "Being designed" | Dashed 1px `--hub-faint` border, slate text, no fill, "—" in count columns, "Outline" instead of "Open →", no viewer | Paper |
| Planned feature | "Not started", dashes, no Open button | Paper |
| "Coming soon" | Outlined navy button, not a link | Paper |
| Not-designed slide | Dashed border tile or dashed marker, text "Screens not designed yet" | Paper |
| Empty or missing screen image | Fog box with 1px dashed `--hub-faint` border and "Screen not available" in slate. Build validation (task 5) should fail before this ships | Not in Paper |
| Loading | Pages are built ahead of time, so there is no loading state | Decision |

**Keyboard.** Left and right arrows move to the previous and next slide or step; the key hint is shown on the deck viewer only. Escape closes the enlarge overlay. Every control is reachable with Tab in reading order.

**Reduced motion.** If transitions are used they are 150ms colour and opacity changes only. No slide animation. Respect `prefers-reduced-motion`.

---

## 9. Responsive rules

Paper draws 1440 and 390 only. The Hub must also work between them and must not scroll sideways (PRD section 9).

- **Breakpoints.** Phone layout below 768. Desktop layout from 1024. Between 768 and 1023 use the phone layout with wider padding (24px side margin). This is a decision, not a drawing.
- **Side margins.** 80 at 1440, scaling down to 40 at 1024; 16 on phones.
- **Hub table.** At desktop the row is a fixed-column table (section 3). At phone widths it becomes the card list from artboard 12. The same data renders both.
- **Role table.** Same rule: table at desktop, list from artboard 13 on phones.
- **Feature page on a phone** (Not in Paper): stack the title block and the status strip (strip below the lede, columns wrap two by two); "In short" and the contents list stack; the slide grid is one column with the same 152-high thumbnail at full width; the role list uses the same pattern as the mobile role page's journey list (name, summary, ready and in-design counts, Open →).
- **Overview viewer on a phone** (Not in Paper): use the journey viewer's mobile layout: top bar, step bar ("All 12 slides"), slide stage at full width (16:9), notes below, sticky bottom bar. Slides shrink; text inside the slide scales with the stage, never below 11px.
- **Outline page on a phone** (Not in Paper): single column, status panel first, then the steps list, then other journeys. Step circles stay 28 × 28.
- **Window and phone frames** scale to the column width and keep their aspect ratio; the phone frame is capped at 226 wide.
- **Touch targets** are at least 44 × 44 (Paper uses 44 to 48 on phones). Desktop controls at 32 high stay.
- **Print and PDF.** Not in Paper. The PDF buttons are in the design; whether they ship in version 1 is decided in the PRD, not here.

---

## 10. Open points for the owner

These came up while writing the spec. None blocks the next task.

1. **Low-contrast grey text.** `#9AA6B8` is used for "After build", dashes and not-designed row numbers (about 2.5 to 1). Section 1 proposes a darker grey for text. Needs a yes or no.
2. **Font.** Paper's export says `system-ui`; the PRD says Geist. The spec uses Geist. Confirm the Hub page in Paper really uses Geist.
3. **Ticked checkbox, hover and focus states** are derived here, not drawn. Approve as written or draw them.
4. **Unspecified screens:** feature page, overview viewer and outline page on a phone, and the "How to read this page" page. Rules are in section 9. The "How to read this page" page has no design and no content; it needs a decision before task 6 builds the header link (hide the link, or write the page).
5. **Third legend line weight** on the hub intro (600) looks like a slip. The spec uses 400.
