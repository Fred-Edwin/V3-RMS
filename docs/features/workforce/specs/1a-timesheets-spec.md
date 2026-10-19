# Segment 1A: Timesheets rework, build spec

19 October 2026. For the back-end and front-end build sessions of Segment 1A. Sources: Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page "Workforce · D. Pay", Chapter 12 steps 01 to 12 (nodes in the table below), `segment-1-review.md`, `design-pass-3-payroll.md`, `design-pass-4-shared-parts.md`, and the built slice 4a (`backend/src/modules/workforce/timesheets/`, `frontend/features/workforce/timesheets/`). Business choices made here are logged in [decisions-1a-spec.md](decisions-1a-spec.md) and cited as D1, D2 and so on.

**Standing rule (owner): Paper is a demonstration, production is the goal.** Every screen below has "Paper shows" (exact) and "Production adds" (what the build must also deliver). Build both. A part that Paper draws is reproduced exactly; a part Paper does not draw is built in the same style and reported as "beyond Paper" in the parity manifest.

| Step | Node | Screen | Section |
|---|---|---|---|
| 01 | `3AUK-0` | How payroll works (stages only) | 12 |
| 02 | `314L-0` | Timesheets month page | S1 |
| 03 | `31J4-0` | Date range | S2 |
| 04 | `31WA-0` | Export menu | S3 |
| 05, 06 | `3262-0`, `32LS-0` | Exported PDF, pages 1 and 2 | 10 |
| 07 | `32QU-0` | Excel export | 10 |
| 08 | `330S-0` | A person's drawer | S4 |
| 09 | `34CW-0` | A person's full month | S5 |
| 10 | `33DF-0` | Overtime decision | S6 |
| 11 | `33PK-0` | Approve the month | S7 |
| 12 | `340Z-0` | Month approved | S8 |

## 0. Rules that apply to every screen

- **Frame.** All screens sit in `WorkforceFrame` (top bar 56 px high, `neutral-200` bottom rule, title 14/18 `neutral-950` left, "Nyeri Town · Branch Manager" 13/16 `neutral-600` right, 32 px side padding). At 1440: sidebar 236, main 1204, content 1140 (32 px gutters). The page route stays `app/app/workforce/timesheets/`; the shell and `nav-table.ts` are untouched except the rows in section 14.
- **Kit first** (`frontend/features/workforce/_shared`, import from `index.ts`): `PageHeader` (28 px: `size="lg"`), `KpiStrip`, `StatusTag`/`WorkforceTag`, `FilterChip`, `DataTable tableLook="workforce" rowSize="compact"`, `TableCells` (`NumberCell`, `StatusText`), `UnderlineTabs` (not used here), `Callout`, `KitDialog`, `WorkforcePinDialog`, `PinField`, `ChoiceChips`, `FormField`, `WorkforceDrawer`/`DrawerSection`, `StatBoxes`, `KeyValueRows`, `States kit` (`states.tsx`, `lib/states-copy.ts`), `useRemote`/`useAction`, `ui2/date-range-picker`, `ListDetailLayout` (for the months list idea only), `WorkforceDocument`, `inbox-row`/`notification-copy`. Reuse, do not redraw.
- **Colours by token.** Paper's value, then the `wds-` token (`frontend/app/tokens.wds.css`): `#171512` neutral-950 (ink); `#635E57` neutral-600; `#2E2B27`/`#47433D` neutral-800/700; `#E4E2DE` neutral-200 (border); `#D2CFC9` neutral-300 (`border-strong`); `#EFEBE4` hairline: use neutral-100 (`#EEEDEA`, the kit's row rule); `#EEEDEA` rest-day fill neutral-100; `#FCF2E4` caramel-100; `#B5823E` caramel-600; `#8A5A16` warning-fg; `#FBF2E4` warning-bg; `#E7D3AC` warning-border; `#2F6438` success-fg; `#EEF4EC` success-bg; `#CADFC6` success-border; `#693C1B` primary (use the primary button, not a flat fill); `#FFFFFF` surface. **Values with no token**, nearest used (flagged): `#8D8982` (zero cells, "Day off", placeholder) → `neutral-500` `#847E76`; scrim `#17151273` (45 %) → the kit's dialog scrim (`neutral-950` at 55 %); drawer scrim keeps 45 % via `color-mix`; card shadow `0 12px 40px #17151240` → `shadow-wds-lg`.
- **Type.** Geist for text, Geist Mono for numbers and the small caps labels (10 px, `0.08em`, uppercase, `neutral-600`). Names 14/18 weight 500. Body 13/16 or 13/18. Captions 12/16.
- **Buttons.** One primary (espresso) per screen. Outlined buttons: 1 px `neutral-300`, `surface`, 13/16, padding 10/16, radius 2. A role that may not do a thing does not see its button; a state that blocks a thing shows it disabled with the reason as text (the kit rule).
- **Times** are Nairobi time through `_shared/time/` only. Hours in tables as `h:mm` (`176:00`, `0:35`), in headings as whole hours with separators (`5,360 h`), small amounts as "5 min", "1 h 30" (D19).
- **Naming.** Never a bare person name: name plus role, or the role alone. No he, she, her, his. Staff names in tables are the display name without the bracket suffix (`plainName`).
- **URL state** per D20: `?site=&month=YYYY-MM&from=&to=&q=&dept=&view=needs|late|all&page=&rows=`; the drawer adds `&person=<employeeId>`; the full month is `/app/workforce/timesheets/month/<monthKey>/<employeeId>?site=`.
- **Production additions that apply to every screen** (listed once): loading (kit pulse, plus the 8 s "Still loading" line), empty, error with Try again, offline banner, a refusal in the server's own words, focus ring and keyboard path as the kit, reduced motion, long names (single line, ellipsis, full name in the title attribute and accessible name), 200 people (server paging, never client slicing), narrow widths (D23), two people acting at once (D25), double taps (buttons disable while a request runs).

---

## S1. Timesheets month page (step 02)

**Purpose and who.** One site's timesheet by month: pick a month on the left, check its hours on the right, decide what needs the manager, approve. Seen by the Branch Manager (own branch), Store Manager (Central Store), Director (Head office, by URL, D8); read-only for HR, Accountant and System Admin (no menu link, route open to them, site chooser). The department head and staff do not see it (D7).

**Layout at 1440** (main 1204). Top bar 56. Content column 1140 wide, left padding 32.
1. Header block, padding-top 24: left title "Timesheets · Nyeri Town" (28/34, 600, `-0.02em`, `neutral-950`) over a 13/18 `neutral-600` line; right the actions (gap 8): **Export ▾** (outlined, 10/16) and **Approve September** (primary, 13/16 600, 10/16). Header to strip gap 16.
2. `KpiStrip`: white, 1 px `neutral-200` border top, left and right, four equal cells of 285 (padding 14/18, gap 2). Label Geist Mono 10/12 `0.08em`; value 28/34 600; caption 12/16 `neutral-600`. The fourth cell is the action cell: fill `caramel-100`, 2 px top border `caramel-600`, label, value and caption in `warning-fg`.
3. A 1 px `neutral-950` hairline across 1140 (the "very dark hairline").
4. Two columns, height 640 at 900 (production: viewport height minus the three blocks above, minimum 520): **months list** 280 wide, 1 px `neutral-950` right border, padding-top 16; **month panel** 859 wide, padding 16/0/0/24, content 835.
- **Stays:** top bar, header, KPI strip, hairline, the months list heading, the filter row, the table header and the table footer. **Scrolls:** the months list body and the table body, each by itself ("the table scrolls, the header stays"). The page itself does not scroll at 1440 × 900; below that height the whole region keeps its minimum and the page scrolls.

**Paper shows: months list.** Heading "MONTHS · NYERI TOWN" (Mono 10/12, bottom padding 10, right padding 16). Rows separated by a 1 px `neutral-100` top rule, padding 14/16 (right) with gap 4: line 1 month name 14/18 600 `neutral-950` and a status tag at the right; line 2 12/16 `neutral-600`.
- Open: tag "Open" (1 px `neutral-300` border, 11/14, text `neutral-600`, padding 1/7, no fill); line 2 "Today is 19 Oct · 3,118 h so far".
- To approve: tag fill `warning-bg`, border `warning-border`, text `warning-fg` 500; line 2 "5,356 h · 31 people".
- Approved: tag fill `success-bg`, border `success-border`, text `success-fg` "Approved" (step 12). Paid (older months): same green, text "Paid" (shown from Segment 2; before it exists every approved month says "Approved").
- **Selected month:** fill `neutral-200` (`#E4E2DE`), a 3 px `neutral-950` left bar, left padding 13. Never amber (owner). Footer line "Showing 5 of 9 months · Page 1" (12/16 `neutral-600`).

**Paper shows: month panel.** Filter row (gap 8): search "Search a name" (220 wide, 1 px `neutral-300`, 9/12 padding, placeholder `neutral-500`); "Department: All ▾"; the date button "1 Sep to 30 Sep ▾" (1 px **ink** border, text 500: it is the active filter); chips "Needs you · 3", "Late · 6" (outlined) and "All 31" (selected: fill `neutral-950`, white 600). Table card: white, 1 px `neutral-200`. Header row: padding 12/14, bottom rule 1 px `neutral-950`, Mono 10/12 `0.08em`. Columns: PERSON 140, DEPT 76, PLANNED 68, WORKED 68, OVERTIME 72, LATE 62, ABSENT 56, LEAVE 48 (all right-aligned, Mono 13/16) and STATUS (the rest, left padding 18). Rows: padding 12/14, 1 px `neutral-100` bottom rule (43 px; the kit's compact row is 42: use compact, flag 1 px). Name 14/18 500; dept 13/16 `neutral-600`; numbers Mono 13/16 `neutral-950`; **zeros and "0" in `neutral-500`**. Footer: "Showing 1 to 31 of 31 people · the table scrolls, the header stays" (12/16 `neutral-600`, left) and "Rows per page: 50 ▾" (right). (That caption is a Paper note, not product copy: production says "Showing 1 to 31 of 31 people".)

**Exact copy.**
- Title "Timesheets · {Site}". Subtitle (month to approve or open): "One timesheet per month. Pick a month, check the hours, decide the overtime, then approve it for payroll."
- KPI cells (month in state OPEN or TO_APPROVE): `{MONTH} · HOURS WORKED` / `5,356 h` / `plan was 5,456 h · 31 people`; `OVERTIME RECORDED` / `3 h 45` / `1 h 30 approved · 2 h 15 to decide` (adds ` · 0 h 20 not approved` only if non-zero); `LATE, RECORDED` / `6` / `for payroll, nothing to approve`; `NEEDS YOU BEFORE APPROVING` / `3` / `1 clock-out fix · 2 overtime decisions` (parts joined with " · ": "N clock-out fix(es)", "N overtime decision(s)", "N request(s)", "N day(s) to look at"). Plural rules as the kit.
- Open month cells: first cell `OCTOBER · HOURS SO FAR` / `3,118 h` / `plan so far 3,200 h · open shifts not counted` (D18); the fourth cell reads `NEEDS YOU` and the same sentence (nothing blocks an open month, so it is informational: tint `caramel-100` only if the count is above zero, otherwise plain white with a `neutral-300` top border and the caption "Nothing to decide yet").
- Header buttons: `Export ▾`, `Approve September` (month name follows the selected month; the open month shows the disabled form of D5).
- Filter chips: `Needs you · {n}`, `Late · {n}`, `All {n}`. Search placeholder `Search a name`. Department filter `Department: All ▾` (lists the site's departments, A to Z).
- Status column words (one per row, the most urgent first, amber `warning-fg`): `Clock-out fix · Fri 11 Sep`, `Overtime 35 min to decide`, `Overtime 1 h 40 to decide`, `Request to answer · Tue 8 Sep`, `Day to look at · {Ddd D Mmm}`, `Several things to decide ({n})` when more than one kind. Green `success-fg` after a decision: `Overtime approved`, `Overtime 35 min approved`, `Overtime approved in part`, `Overtime not approved`, `Clock-out fix approved`. Grey `neutral-600`: `Nothing to decide`, `Absent Wed 9 Sep, unpaid` (an absence is a fact, not a decision), `Approved leave, 3 days`.
- Months list empty ("no timesheets yet"): title `No timesheets yet`, body `Timesheets start on the first day of the month after this branch's new clock was switched on.`
- Table empty by filter: `No one matches. Try another word or clear the filters.`

**Interactions and states.**
- Month row: a button; hover `neutral-50` (pointer only); focus ring inset; `aria-current="true"` on the selected month; arrow keys move between months, Enter selects. Selecting a month resets the date range to the whole month (or "1 Oct to today" for the open month), clears search, keeps department.
- Table row: whole row is a button opening the drawer (S4); focus ring inset; Enter or Space opens; the drawer returns focus to the row on close. A row's status text is also the accessible description.
- Chips are real toggles with counts; "All" is the default. Counts follow the date range and department, not the search.
- Date button opens S2. Department: kit select. Search: type-ahead after 250 ms, URL `q`.
- Export opens S3. Approve opens S7.
- **Approve button states:** visible only for the approver of this site (D7). Month ended and nothing needing the manager: primary, enabled. Month ended, items open: primary, enabled, dialog shows the blocked form (D1). Month open: disabled with the reason as text under the button ("October ends on 31 Oct. You can approve from 1 Nov.", 12/16 `neutral-600`). Approved: replaced by the green "Approved ✓" status (S8). Not the approver: absent.
- **Selected state colour rule:** selected month is grey with the dark bar; amber appears only on "To approve" tag, the fourth KPI cell and the "to decide" words (in progress or needs you).

**Production adds (S1).**
- Loading: the strip shows four quiet blocks, the list five grey rows, the table the kit's loading rows. A month that is being refreshed by the server (T4) shows a small "Updating" mark in the header, never a full reload.
- Error: the kit error block in the panel with `Try again`; the months list keeps working if only the month failed.
- Switch off: a branch whose new clock is off shows `This branch still uses the old clock. Timesheets start when it is switched on.` (built text, keep).
- No access: another site answers the kit "not found" page (404 rule, section 13); a role without `timesheet.read` is redirected by the route gate.
- Stale data: the page refetches on focus after 60 s and after any action; a toast "Updated" is not shown.
- A person who left mid-month or joined mid-month is listed with their days only; a person with no days in the range is not listed in the range view.
- A month with no one to list: `Nobody worked in {Month}.`
- 200 people: server paging, sticky header, search type-ahead.
- Screen reader: the KPI strip is a list of four labelled items; the table has a caption "Timesheet, {Site}, {Month}, {range}"; the months list is a `listbox`-free list of buttons with `aria-current`; the fourth KPI cell is announced as "Needs you before approving: 3. 1 clock-out fix, 2 overtime decisions."

**What the server must provide.**
- **Months list** `GET /workforce/timesheets/months?site=&page=&rows=5`: per row `monthKey` (YYYY-MM), `label`, `state` (OPEN, TO_APPROVE, APPROVED; plus `paidAt` once Segment 2 exists), `workedMinutes`, `headcount`, `soFarThroughDate` (open month only), `needsYouCount`, `approvedAt`, `approvedBy {name, role}`, `documentNumber`. Months exist from the first month the site's attendance switch was on. Newest first. The current month is created on first read (as built).
- **Month** `GET /workforce/timesheets/months/:monthKey?site=&from=&to=`: `state`, `window {start, end}`, `kpis {workedMinutes, plannedMinutes, headcount, overtime {recordedMinutes, approvedMinutes, partNotApprovedMinutes, toDecideMinutes}, lateCount, absentDays}`, `needsYou {clockOutFixes, overtimeDecisions, requestsWithManager, daysToLookAt, requestsWithHr}` (these decide D1), `approval {approvedAt, approvedBy {name, role}, documentNumber}`, `rulesUsed [{key, version, effectiveFrom}]`, `otherSites {name, approved:boolean}[]` (company sites that have timesheets, for the S7 sentence), `capabilities {canApprove, canExport, canDecide}` computed server side. The KPIs follow `from`/`to`, except `needsYou` and the approval which are always for the whole month.
- **People** `GET .../people?from&to&q&dept&view&page&rows&sort`: per row `employeeId`, `name`, `department`, `plannedMinutes`, `workedMinutes`, `overtimeMinutes` (recorded), `lateMinutes`, `absentDays`, `leaveDays`, `status {kind, text key, date?, minutes?}`, and `total` and `counts {needs, late, all}`.
- **What counts as an exception** (D2) and **how "so far" is computed** (D18) are server rules, unit-tested in pure files (`needs-you.ts`, `so-far.ts`). `worked` is the day assessment's worked minutes; `planned` is the rota's planned minutes for the range; leave days are approved leave from slice 5 (zero until slice 5 provides them).
- **Refresh.** Reading a month refreshes it (T4, at most every 20 s) and never alters an APPROVED month. **Concurrency:** reads need no version; every write does (D25).

---

## S2. Date range (step 03)

**Purpose and who.** Narrow the month page (numbers and people) to a week or any run of days inside the month; the same range feeds Export ("the range now selected"). Everyone who sees S1.

**Paper shows.** The approved range picker (`ui2/date-range-picker`) opened under the date button, 774 wide (left edge 666, right edge 1440), 355 high, white, 1 px `neutral-200`, shadow-lg. Left column 168 wide, heading "QUICK PICKS" (Mono 10/12), rows 14/18: `Whole month`, `Week 1 · 1 to 6 Sep`, `Week 2 · 7 to 13`, `Week 3 · 14 to 20`, `Week 4 · 21 to 27`, `Week 5 · 28 to 30`, `Pick a date or range`. The chosen quick pick row has fill `caramel-100` and 600 text. Right: "FROM" and "TO" fields (1 px ink border on the active one; value "Mon 14 Sep 2026" Mono 13) with an arrow between and the caption "7 days · one Monday to Sunday week" (12/16 `neutral-600`); two months side by side (September 2026, October 2026) with Mo to Su headers (Mono 10); day cells 36 wide, 12/16; the selected ends fill `neutral-950` with white text, days between fill `warning-bg`-like tint (`caramel-100`), days outside the month `neutral-300` text and not pickable. Footer: help text "Only days inside September 2026 can be picked here. Weeks run Monday to Sunday." (12/16 `neutral-600`), `Cancel` (outlined) and `Apply` (primary, brown).

**Use** the approved picker with the existing `single`/min/max options; the differences are: quick picks are weeks of the selected month, the min and max are the month's first and last day (for the open month, the first and today), and the caption counts days. Week quick picks are cut at the month's edges (week 1 is "1 to 6 Sep", week 5 "28 to 30").

**Exact copy.** As above. Counting caption: `{n} days` or `{n} days · one Monday to Sunday week` when the range is exactly such a week. Invalid: `Pick the last day too.` / `The end cannot be before the start.`

**Interactions and states.** Quick pick click fills the fields and the calendar; Apply commits and updates the URL; Cancel or Escape closes and returns focus to the date button; keyboard: arrow keys move days, Page Up and Page Down change month, Home and End go to week start and end, Enter selects, Tab order quick picks → From → To → calendar → Cancel → Apply. Apply disabled until both days are set. The picker button shows the range ("1 Sep to 30 Sep", "14 to 20 Sep"); when it is not the whole month a small "Clear" appears inside the button area as a quiet text button "Whole month".

**Production adds.** The month panel and Export both say the range in words; a range that spans no worked days still applies and the table says `No one worked on these days.` Narrow screens: the picker opens as a bottom sheet with the quick picks as a horizontal strip. Screen reader: the picker announces "Quick picks", "From date", "To date", each day as "Monday 14 September 2026". Focus is trapped while open.

**Server.** None new; `from` and `to` (inclusive, Nairobi dates inside the month) are parameters on S1's reads. Out-of-month dates answer 400 `RANGE_OUTSIDE_MONTH`.

---

## S3. Export menu (step 04)

**Purpose and who.** Take the month away as a landscape PDF or an Excel file, for the whole month or the range now selected. Branch Manager, Store Manager, HR, Accountant (D9). Director and System Admin do not see the button.

**Paper shows.** A popover under the Export button, right-aligned to it, about 292 wide, white, 1 px `neutral-200`, radius 4, shadow-lg, padding 16. Heading Mono 10/12 "EXPORT SEPTEMBER 2026 · NYERI TOWN". Two format cards (radio cards, `RadioCards`): `PDF · landscape` / "Signed, formatted and ready to print or file" (selected: 2 px ink border); `Excel` / "Every column, for your own sums". Then two radios: `Whole month · 1 to 30 Sep` (chosen), `The range now selected`. A full-width primary button "Download PDF" (becomes "Download Excel" when Excel is chosen). Caption 12/16 `neutral-600`: "The PDF opens in the Document view first, with zoom, Download and Share. Each export is recorded in the audit log."

**Production adds.**
- The range radio is disabled with the reason "Pick a range first" when the range is the whole month; its label shows the range ("14 to 20 Sep").
- Draft or approved: a line under the cards, amber (`warning-fg`) for a draft: `This month is not approved yet. The file will say "Draft, not approved".` Green for approved: `Approved on 19 Oct. The file carries the signature and TSH-0009.`
- Working: the button says `Preparing…` with the kit busy state; up to 10 s synchronous, then the popover says `This is a big month. We will tell you when the file is ready.` and a Notifications row arrives (D14).
- Failed: `The file could not be made. Try again.` with the button re-enabled; the server error id is shown small. Offline: the button is disabled with the offline words.
- Excel: downloads at once (browser download, name `Timesheet-Nyeri-Town-2026-09.xlsx`; PDF `Timesheet-Nyeri-Town-2026-09.pdf`). PDF: opens the shared **Document view** (zoom, Download, Share; Chapter 17) and downloads from there. A range export adds `-14-20` to the name.
- Popover is a menu dialog: focus moves in, Escape closes and returns focus to Export, arrow keys move across the radio cards and radios, the button is last in order. Role `dialog` with the heading as its name.

**Server.** `POST /workforce/timesheets/months/:monthKey/exports` body `{format: 'pdf'|'xlsx', scope: 'month'|'range', from?, to?, idempotencyKey}` → file stream (or `202 {jobId}` over 200 people). Needs `timesheet.export` at the site (404 for another site, 403 without the capability). Writes the audit entry (D32). Returns the document number for an approved month, none for a draft. Same data and order as S1 so the three agree.

---

## S4. A person's drawer (step 08)

**Purpose and who.** Click a person in the table: their month at a glance, the days that need a look, the last 7 days. Same viewers as S1.

**Paper shows.** `WorkforceDrawer` on the right, 500 wide, full height 900 (production: full viewport height), white, 1 px `neutral-950` left border, shadow-drawer, over a scrim (`#17151273`). Header (padding 28 sides, bottom rule `neutral-200`): kicker Mono 10/12 "SEPTEMBER 2026 · BARISTA · NYERI TOWN"; name 24/30 600 `-0.02em`; line 13/18 `neutral-600` "1 to 30 September · 22 working days"; close × 20/20 `neutral-600` at the top right. Four stat cells in a row (1 px `neutral-200` rules; padding 14/18; label Mono 10/12; value Mono 16/22): PLANNED `176:00`, WORKED `177:05`, OVERTIME `0:35` (filled `caramel-100`, text `warning-fg`), LATE `5 min`. Section "DAYS THAT NEED A LOOK · 1" (Mono 10/12): one card (fill `caramel-100`, 1 px `warning-border`, padding 12/14, gap 6): title "Sat 12 Sep · closed shift" 14/18 600 and, at the right, "Overtime 35 min" 13/18 600 `warning-fg`; body 13/18 `neutral-600` "Planned 14:00 to 22:00 · clocked 13:58 to 22:35. Recorded as overtime because the shift was closed after the planned end."; primary button "Decide the overtime" (13/16 600, 9/14). Section "THE LAST 7 DAYS": a table with an ink top rule and `neutral-200` header rule; columns DAY 110, PLANNED 130, CLOCKED 130, RESULT (rest); rows padding 8 with `neutral-100` rules: day 13/16, times Mono 12/16 `neutral-950` ("06:00 to 14:00"), "Day off" and "·" Mono 12 `neutral-500`, result 12/16 `neutral-600` ("On the rota", "Rest day"). Footer line "Showing the last 7 of 30 days" (12/16 `neutral-600`) and the outlined button "Open the full month ↗" (ink border, 9/14, 13/16 600). Bottom bar (rule `neutral-200`, padding 16/28): "Overtime is only decided here as authorised or not. Payroll applies the Rules to decide pay." (12/16 `neutral-600`).

**Exact copy.** As drawn. Stat labels PLANNED, WORKED, OVERTIME, LATE. Kicker `{MONTH YEAR} · {DEPARTMENT} · {SITE}` uppercase. The range line follows the page range ("14 to 20 September · 5 working days"). Several days needing a look: "DAYS THAT NEED A LOOK · {n}" and a card each. No days: `Nothing needs a look.` (plain line). Action by kind: overtime → `Decide the overtime` (S6); open shift or clock-out fix → `Fix the clock-out` (opens the existing Edit time dialog from `week/`); waiting request → `Answer the request` (opens the request answer from `requests/`); day to look at → `Look at this day` (opens the full month scrolled to the day). On an approved month the cards are not shown; the section reads "DECISIONS · {n}" with each decision as a quiet row ("Overtime 0 h 35 approved by Faith Njeri, Branch Manager, 19 Oct 11:42").

**Interactions and states.** Opens on row click; focus goes to the × (kit rule); Escape or × closes and returns focus to the row; `person` in the URL makes it linkable. Previous and next person arrows are not in the drawer (they are on S5). "Open the full month ↗" goes to S5 in the same tab. The last 7 days end at the last day of the range (the month's last day, or today for the open month) and run backwards, most recent first.

**Production adds.** Loading rows inside the drawer; error `This person's month could not be loaded.` with Try again; a person with no days: `No days in this range.`; a person who left: the kicker adds `· LEFT 14 SEP`; a name over 28 characters truncates with the title attribute; the buttons that the viewer may not use are absent; the "Decide" buttons are disabled on an approved month. On a narrow screen the drawer is full width and the stats wrap two by two. Scrim click closes. Screen reader: dialog named by the person's name; the stat cells are a description list.

**Server.** `GET .../people/:employeeId?from&to` (extends T4): `employee {id, name, role, department}`, `workingDays`, `totals {planned, worked, overtime, late}`, `needLook [{date, kind, title, detail, overtimeItemId?, requestId?, timeFixAllowed}]`, `lastDays [{date, plannedStart, plannedEnd, clockIn, clockOut, resultKey}]` (7 rows), `neighbours {prevEmployeeId, nextEmployeeId}` in the current filtered order (for S5), `decisions []` for an approved month. Same 404 rule.

---

## S5. A person's full month (step 09)

**Purpose and who.** Every day of one person's month on its own page, the month at a glance, the same filters and export, arrows to the next person. Same viewers as S1.

**Paper shows.** Frame as S1. Header (padding-top 20, gap 16): crumb "‹ Timesheets · September 2026 · Nyeri Town" (13/16 `neutral-600`, a link back keeping the filters); title "Cynthia Wairimu · September 2026" (28/34 600 `-0.02em`); line "Barista · Nyeri Town · every day from 1 to 30 September" (13/18 `neutral-600`). Right actions (gap 8, outlined): `‹ Amina Hassan`, `Dan Kiprop ›` (the previous and next person in the table's order) and `Export ▾`. KPI strip (cells 285; padding 12/18; value **26/32** 600; Mono 10 labels): `HOURS WORKED` `177:05` "plan was 176:00"; `DAYS` `22 worked` "8 rest days · 0 absent · 0 leave"; `LATE, RECORDED` `5 min` "1 day · payroll applies the Rules"; `NEEDS YOU` `1` "overtime 0:35 on Sat 12 Sep" (action cell as S1). Ink hairline. Two columns, 660 high: left rail 300 wide (padding right 20, top 16, gap 12, ink right border) with "THE MONTH AT A GLANCE" (Mono 10/12), a calendar grid (weekday heads Mo to Su, Mono 10/12, cells 36 × 34, gap 3; day 12/16): worked day white with 1 px `neutral-300`; late day fill `warning-bg`, border `warning-border`, text `warning-fg`; overtime to decide fill `caramel-600` with white 600 text; rest day fill `neutral-100` with `neutral-500` text, no border. A legend: "Worked, matches the rota", "Late", "Overtime to decide", "Rest day" (13/16 swatches). Under it, if something needs the manager, the action card (fill `caramel-100`, border `warning-border`): "Sat 12 Sep · overtime 0:35" 13/18 600, "Clocked 13:58 to 22:35 on a 14:00 to 22:00 shift." 12/16 `neutral-600`, primary `Decide the overtime`. Right: the month panel (839 wide, padding-left 24): filters (gap 8) `1 Sep to 30 Sep ▾` (ink border), chips `All days · 30` (selected), `Needs a look · 2`, `Worked · 22`; table card with columns DAY 100, PLANNED 116, IN 58, OUT 58, WORKED 64, OVERTIME 72, LATE 56, RESULT (rest, left padding 18); rows padding 9/14 (about 35 px; the kit's compact is 42, so these use a denser `rowSize="dense"` row: a 35 px row on the Workforce table look, to add to the kit as a variant). Day 13/16 600 on exception rows; times Mono 12/16; "Day off" and "·" `neutral-500`; the late row is filled `warning-bg` with `5 min` and "Late 5 min, recorded" in `warning-fg`; the overtime row is filled `warning-bg` with `0:35` (`warning-fg`) and "Overtime 35 min, to decide" 600 `warning-fg`; rest rows are filled `neutral-50`, result "Rest day". Footer "Showing 1 to 30 of 30 days · the table scrolls, the header stays" and "Rows per page: 50 ▾".

**Exact copy.** As drawn. Result words: `On the rota`, `Rest day`, `Late {n} min, recorded`, `Left early {n} min`, `Overtime {n} min, to decide`, `Overtime {n} min, approved` / `approved in part` / `not approved`, `Clock-out missing, fix needed`, `Absent, unpaid`, `Approved leave`, `Public holiday`, `Request waiting`, `Edited by {Name}, {Role}` (an edited day always shows who edited it, T3). Chips: `All days · {n}`, `Needs a look · {n}`, `Worked · {n}`. Empty chip: `Nothing here.`

**Interactions and states.** Calendar cell click or Enter scrolls the table to the day and highlights the row for 2 s (kit highlight, none with reduced motion); the cells are a grid with arrow keys. A table row of an exception opens the same buttons as the drawer's card in a small inline row (Decide the overtime, Fix the clock-out, Excuse (D11)). The previous and next buttons keep range, chip and department; disabled with the reason "This is the first person" at the ends. Export as S3 for this person only: the popover heading reads "EXPORT CYNTHIA WAIRIMU · SEPTEMBER 2026" and the PDF is a one-person extract (the same layout, one department band, the line "Extract: Cynthia Wairimu"). Crumb back keeps the table state. Hover, focus and selected as the kit.

**Production adds.** Loading, error, no-access as S1; person not in this month: `{Name} has no days in September 2026.`; a part-month person ("joined 8 Sep") greys the days before with "Not yet employed"; a leave day shows the leave type; a day with two shifts shows two time pairs on two lines (row grows); a night shift past midnight shows the shift on its start date with "+1" after the out time; 31-day months and February render correctly (the calendar is built from the month, never hard-coded); day-light is not applicable (Nairobi has none). Narrow: the rail moves above the table and collapses behind a "Month at a glance" toggle. Screen reader: calendar is a table with each day named "Wed 9 Sep, worked, on the rota".

**Server.** `GET .../people/:employeeId/days?from&to&view&page&rows` returns `days [{date, weekday, plannedStart, plannedEnd, clockIn, clockOut, workedMinutes, overtimeMinutes, lateMinutes, resultKey, status, overtimeItemId?, requestId?, editedBy?}]`, `glance [{date, kind}]` for the calendar, `totals`. Rows follow the days of the range (rest days included as rows with `kind: REST`); the day list is paged at 50.

---

## S6. Overtime decision (step 10)

**Purpose and who.** Decide one overtime item with the evidence beside it: approve all, part, or none, with a reason and the PIN. The site's manager only (D7); a department head approves nothing; HR and the Accountant read.

**Paper shows.** `KitDialog` (780 wide, left 330, top 44 at 1440 × 900, white, shadow-lg, radius 6, padding 28 sides), over the page and the 45 % scrim. Header (bottom rule `neutral-200`): title "Overtime · Cynthia Wairimu · 0 h 35" (22/28 600), sub "Saturday 12 September · Barista · Nyeri Town" (13/18 `neutral-600`), × at the right. Three boxes in a row (1 px `neutral-200`, padding 10/14): `PLANNED` "14:00 → 22:00", `WORKED` "13:58 → 22:35" (Mono 15/20), `EXTRA` "0 h 35 after shift end" (fill `caramel-100`, text `warning-fg`) — this is `StatBoxes times` with a filled last cell. Two columns (gap 28): "WHY, FROM THE RECORD" lines (13/18 `neutral-950`, gap 6): `Reason given: busy, customers waiting`, `Open at 22:00: 3 tables, 1 ticket`, `Colleagues free: none, the Barista team had 3 of 4 in`, `Asked in advance: no`, `Head's note: Victor Maina, Barista head, saw it, no objection`; and "THE LIMITS": `That week: 41 h 35 of the 48 h limit`, `Overtime this month: 0 h 35 so far`, `Branch overtime that week: 4 h 05`. "Your decision" (13/16 600) with three chips: `Approve all 0 h 35` (selected: fill ink, white 600), `Approve part: 0 h 20`, `Decline` (outlined, 1 px `neutral-300`, 8/14). "Reason (needed to approve part or decline; recorded)" and a text field (1 px **ink** border, padding 10/12, 13/18). "Your PIN" with a 240 wide `PinField` (Mono 16/20, `0.2em`, ink border) and, to its right, the note (12/16 `neutral-600`): "You are only saying whether this extra time was authorised. Whether it is paid at an overtime rate, or counted another way, is decided by payroll from the Rules. The person is told your answer." Footer (right aligned, gap 10): `Cancel` (outlined 10/18) and primary `Save my answer` (11/18).

**Exact copy.** As drawn plus: Approve-part stepper label `How much to approve` with `−` and `+` and the value (D3). Errors: `Say why. This is needed to approve part or decline.`; `That PIN is not right.`; `This changed while you were looking. Check it again.` Evidence "none" lines: `Reason given: none`, `Open at {time}: nothing`, `Head's note: none`. Overtime fully covered by the service tail is not decided here (recognised by itself); the dialog never opens for it.

**Interactions and states.** Opens from S4, S5, the table status or the badge; first focus on the decision chips (the chosen one); the chips are real radios with arrows; choosing "Approve part" reveals the stepper, "Decline" or "Part" marks Reason required (an asterisk-free label as drawn). Save disabled with the reason as text ("Add your reason" / "Enter your PIN") until valid; Enter never signs, the PIN's last digit enables Save (kit rule: PinField calls `onComplete`, and the dialog saves on Save only: follow `WorkforcePinDialog` where it differs). Success: dialog closes, the table row turns green, the Undo toast is **not** offered (the answer is signed; to change it before approval open the item again and decide again: "Change my answer" replaces the primary label when an answer exists, and the answer history is kept). On an approved month the dialog is read-only: title unchanged, no chips, PIN or buttons, a `Callout`: `This month is approved. Tell HR if the overtime needs to change.`

**Production adds.** Loading evidence skeleton; evidence that cannot be read: `We could not read the record for this day.` with the decision still possible (a reason is then required for every choice); an item that is already decided by someone else: banner `Decided by {Name}, {Role} at {time}. Check it again.` (409, D25); a wrong PIN clears the field; a person with no PIN set (D26); long reason over 280 characters is refused at the field; a long head's note wraps; the "Head's note" line is absent when the head has no `overtime.note` (D24) and reads "none"; screen reader: the dialog is named by its title, the evidence is two description lists, the chips are a radio group "Your decision", errors are linked with `aria-describedby`; Escape closes and returns focus to the opener, nothing typed is saved.

**Server.** `GET /workforce/timesheets/overtime/:id` (built, extended): `plannedStart/End`, `workedStart/End`, `extraMinutes`, `evidence {reasonGiven, openWork {at, tables, tickets}, colleaguesFree {free, total, team}, askedInAdvance, headNote {by {name, role}, text}?}`, `limits {weekMinutes, weekCapMinutes, monthMinutes, branchWeekMinutes}`, `status`, `authorisedMinutes`, `decision {by, at, reason}?`, `version`. `POST .../overtime/:id/decision` body `{decision: 'APPROVE_ALL'|'APPROVE_PART'|'DECLINE', approvedMinutes?, reason?, pin, version}`: checks capability `overtime.approve` at the site, not the person's own item (no self-decision: the manager's own overtime goes to the Director, as built), the month not APPROVED, the PIN with the manager's own PIN, `approvedMinutes` between 5 and `extra − 5` and a multiple of 5 for a part, reason rules D4. Stores `authorisedMinutes`, `decidedById`, `decidedAt`, `decisionReason`, status `APPROVED`, `APPROVED_PART` or `DECLINED` (decline sets the authorised minutes to the automatic part only). Returns the item. Audit `timesheet.overtime_decided` (decision, minutes, reason, never pay). Notifies the person (D28). The limits are information; a manager may approve above the weekly cap with a reason (built rule `OVERTIME_NEEDS_MANAGER` no longer applies because the head decides nothing). `POST .../overtime/:id/note` `{text}` with `overtime.note` (D24). Idempotent by `version`.

---

## S7. Approve the month (step 11)

**Purpose and who.** Sign the month off: the hours go to payroll and are locked. The site's approver only (D7).

**Paper shows.** A 600 wide plain `KitDialog` (left 420, top 120), shadow-lg, radius 6. Title "Approve September 2026?" (22/28 600); line 13/18 `neutral-600` "Nyeri Town · 1 to 30 September · 31 people. After this, the hours go to payroll and are locked." A `KeyValueRows` list under an ink top rule, rows 10 padding with `neutral-100` rules, label 13/16 `neutral-600` left and a Mono 13/16 value right: `Hours worked` "5,360 h · plan 5,456 h"; `Overtime authorised` "3 h 45 · 3 decisions made"; `Late marks, absent days` "6 · 1 (payroll applies the Rules)"; `Still to decide` "Nothing" (13/16 600 `success-fg`). "Your PIN" and a 240 wide `PinField`. Note 12/16 `neutral-600`: "Payroll can start once every branch has approved. Today Nyeri Highway has not approved September yet, so payroll waits for it. HR and the Accountant are told. Your name, the time and these totals are kept in the audit log." Footer: `Cancel` and primary `Approve September`.

**Exact copy.** As drawn. Sentence variants for the note: all other sites approved: `Every branch has approved September. Payroll can start.`; several waiting: `Today Nyeri Highway and Central Store have not approved September yet, so payroll waits for them.`; the site is the only one: `Payroll can start as soon as you approve.` Blocked form (D1): `Still to decide` "3" in `warning-fg` 600 with the link `Show them` (closes the dialog and sets the "Needs you" chip), and under the PIN the disabled reason `Decide the 3 things first.` Requests with HR (D2): extra row `With HR` "2 requests" (neutral, not blocking). Errors: `That PIN is not right.`; `Someone approved this month a moment ago.` (409 repeat → dialog turns into the success state); `Something changed while you were looking. The numbers above are updated. Check them and try again.`

**Interactions and states.** First focus on the PIN field (the blocked form: on "Show them"); Escape closes; the last PIN digit enables the primary button; Enter does not approve. While saving: `Approving…`, all controls disabled. Success closes the dialog and shows S8 with a toast `September approved. HR and the Accountant are told.` (the kit toast, no Undo: approval cannot be undone). Failure keeps the dialog.

**Production adds.** Loading the totals (skeleton rows); totals that fail to load disable the button with `We could not read the totals.`; the figures in the dialog are read again from the server on open and again on Approve (the server checks them against the values the dialog showed, D25); a dialog opened for a month that is no longer TO_APPROVE refreshes and closes with an explanation; no PIN set (D26); a month with nobody to list cannot be approved (`Nobody worked in September, so there is nothing to approve.`); an approver who is also on the timesheet (a Branch Manager approves their own hours): allowed, with a line `Your own hours are included.`, and the audit entry marks it (the Director's approval of Head office covers the Director's own hours the same way). Screen reader: the key-value rows are a description list; the blocked state is announced with `role="alert"`.

**Server.** `POST /workforce/timesheets/months/:monthKey/approve` body `{pin, idempotencyKey, expectedTotals {workedMinutes, overtimeAuthorisedMinutes, headcount}}`. Checks in order: `timesheet.close` at the site (403, other site 404); month state is TO_APPROVE (`MONTH_NOT_ENDED` 409 for the open month, `ALREADY_APPROVED` is answered as success for the same key and 409 for a different key); nothing blocks (D2; `NEEDS_YOU_REMAINS` 409 with the counts); the PIN; expected totals equal the fresh totals (`CHANGED_UNDERNEATH`). In one transaction: sets state APPROVED, `approvedAt`, `approvedById`, issues the document number (D12), stores the document hash and a frozen snapshot of the rows (so the PDF and the Excel of an approved month never change), locks the month (every attendance fix and day or overtime decision answers `PERIOD_APPROVED`, section 11), writes the audit entry, creates the HR and Accountant notifications (D27) and emits the `timesheets.month_approved` event Payroll reads. `getApprovedHours` returns hours only for APPROVED months. No money anywhere.

---

## S8. Month approved (step 12)

**Purpose and who.** What S1 looks like after approving; the same viewers.

**Paper shows.** S1 with: subtitle "Approved and sent to payroll on 19 Oct, 11:42. The hours are locked; to change them, ask HR." (13/18); the header actions `Export ▾` and a green status `Approved ✓` (fill `success-bg`, 1 px `success-border`, text `success-fg` 13/16 600; not a button, no hover); the KPI cells: hours `5,360 h`, overtime `3 h 45` with caption "3 h 45 approved · nothing left to decide", late `6`, and the fourth cell green (fill `success-bg`, 2 px top border `success-fg`, label `APPROVED AND SENT TO PAYROLL` in `success-fg`, a check mark in place of a number, caption "19 Oct, 11:42 · Faith Njeri, Branch Manager"); the months list tag "Approved"; the chip `Needs you · 0`; row statuses turn green ("Clock-out fix approved", "Overtime 35 min approved").

**Production adds.** The Timesheets menu badge and the Home "Needs you" count drop by this month's items at once; Decide, Fix and Excuse buttons vanish everywhere; the drawer and S5 are read-only (S4, S6); the document number `TSH-0009` appears under the approved line and links to the signed PDF in the Document view; the page shows the part-approved and not-approved amounts in the overtime caption ("3 h 25 approved · 0 h 20 not approved"). A month with HR corrections after approval (Segment 2) shows `A payslip was corrected after approval.` in a `Callout` (reads the Payroll event, later).

**Server.** The S1 reads with `approval` filled and `capabilities.canApprove=false`.

---

## 9. Chapter 9 phone (what changes)

The phone screens (My time, My rota, Report a problem, My requests) are built and unchanged except: (1) Report a problem's helper line says it goes to the Branch Manager ("Your Branch Manager will answer."; the Store Manager for the Central Store, HR for a manager's own); (2) for a day in an approved month the form says `This month is approved. Tell HR.` and the Send button is replaced by `Call HR` (a link to the HR contact line the Rules store holds), and a request that was created anyway goes straight to HR (D29); (3) the department head sees no Timesheets link (D7). The person is told overtime answers (D28). No new phone layouts.

## 10. The PDF and Excel documents

**PDF** (Paper steps 05 and 06; the kit's `WorkforceDocument` landscape, 1123 × 794 px). Server rendered (D14); the in-app Document view shows the same file.
- **Page.** A4 landscape, 297 × 210 mm. Paper's margins (at 96 dpi): top 40, sides 54, bottom 24; in print: top 10.5 mm, sides 14.3 mm, bottom 6.4 mm; the footer sits inside the bottom margin (at least 6 mm of safe area is kept; if a printer needs more the page is scaled to 96 %). A 10 px navy bar (`#14284B`) runs across the very top edge of every page. Sizes in the document are px at 96 dpi, converted to pt at 0.75.
- **Fonts.** Times New Roman as drawn (embedded as Tinos, D14). Title "Timesheet · Nyeri Town" 22/26 700 navy (page 1), 17-ish on later pages ("Timesheet · Nyeri Town · September 2026", 600 navy, with the number at the right); sub 12/16 `#47433D`; stamp 12/16 700, `0.14em`, 2 px navy border, padding 6/14; document number 22/26 700 navy right-aligned; "Approved 19 October 2026, 11:42" 11/14 `#47433D`. Figures: label 9/12 `0.12em` uppercase `#47433D`, value 18/22 700 navy. Table header 11/14 700 navy with a 2 px navy top rule and 1 px navy bottom rule; department band fill `#EEF1F7` (**no token; kept in `lib/document-palette.ts`**) with 1 px navy bottom rule, text 11/14 700 `0.08em` navy, and "9 people" 11/14 `#47433D` right; body rows 11/14 `#111111`, padding 4, 1 px `#E4E2DE` rule; numbers right-aligned. Palette: navy `#14284B`, rule `#D8DEE9`, ink `#111111` (the kit's document palette).
- **Header (page 1).** Round logo 40 px, title and line "September 2026 (1 to 30 September) · Wendo Coffee Bistro", the stamp centred, the number and approval time at the right; a 1 px `#D8DEE9` rule under the header. **Figures band:** six cells (PEOPLE, PLANNED, WORKED, OVERTIME AUTHORISED, LATE MARKS, ABSENT DAYS), 1 px `#D8DEE9` outer border and cell rules.
- **Table.** Columns and widths: Person 170, Department 100, Planned 80, Worked 80, Overtime 80, Late 70, Absent 70, Leave 60 (all numeric right-aligned), Decided by (the rest, left padding 24). Groups by department A to Z, people A to Z inside; each department has its band with the head count. **Page 1 rule (D16):** whole departments up to 20 people (Paper: Barista 9 and Kitchen 8; Pastry 5 would make 22 so it moves to page 2); a department is never split unless it alone exceeds 26 people (then "BARISTA, continued" and a repeated header). Page 1 ends with the italic line "Continued on page 2: Pastry and Service (14 people), the rules used this month and the signature." (12/16, `#47433D`); the last page has no such line.
- **Later pages.** A slim header (title with month, number at the right), the column header, up to 26 people. The last page carries the **rules box** (1 px `#D8DEE9`, padding 14/18, three columns: "RULES USED FOR THIS MONTH" (Overtime, with its weekly cap), "LATENESS" (grace and deduction rule with version), "ABSENCE") from the Rules versions in force for the month (`rulesUsed`), 12/16 serif; then the **signature block**: the signer's first and second name in the signature font (Alex Brush, 38 px, as `signatureName`), a 1 px navy line, "Faith Njeri · Branch Manager" 12/16, "Signed with PIN · 19 Oct 2026, 11:42" 11/14, and at the right the **QR** (76 px) with "Scan to open TSH-0009" 11/14. The rules box and signature never split (D16).
- **Footer on every page.** Left: "Generated by Wendo RMS · TSH-0009 · Page 1 of 2 · Exported by Faith Njeri, Branch Manager, 19 Oct 2026, 11:45" (11-ish/14, `#47433D`); right: "Counted in payroll: September 2026". Page numbers are real ("Page n of N").
- **The draft stamp.** Until the month is approved the stamp reads `DRAFT · NOT APPROVED` (same box, navy), the number reads `TSH-draft` with no approval line ("Not approved yet"), a light diagonal watermark "DRAFT" (navy at 8 %) crosses each page, the footer right reads "Not counted in payroll until approved", and the signature block is replaced by an empty line "Not signed · the site's manager signs by approving the month" with no QR. A range export adds the line "Range: 14 to 20 September 2026"; an extract of an approved month adds "Extract: ..." (D13). A one-person extract (S5) lists one department band.
- **Decided-by wording** (one line, ellipsis at the column end; the full text is in Excel): `Matches the rota, approved by the system`; `Overtime approved by {Name}, {Role}`; `Overtime approved in part (0 h 20 of 0 h 35) by {Name}, {Role}`; `Overtime not approved by {Name}, {Role}`; `Clock-out fix approved by {Name}, {Role}`; `Approved leave, 3 days`; `Absent Wed 9 Sep, no leave; unpaid by the Rules`; `Service tail within the allowance`; two items join with "; ".
- **Number formats.** Hours `h:mm` (`176:00`, `0:35`, no thousands in a cell); the figures band in whole hours with separators (`5,360 h`, `3 h 45`); late minutes `5 min` (zero shown `0`); absent and leave days `1 d`, `3 d`; zero shows `0`. Dates "19 October 2026, 11:42" (24 h Nairobi).
- **Past one page.** 31 people in the sample take two pages; 100 people take four (20, then 26, 26, rules and signature with the rest); a month with 200 people takes eight. The server never scales type to squeeze; it adds a page. The file name is the page title; PDF metadata carries title, author "Wendo RMS", and the number.

**Excel** (Paper step 07; D31). Three sheets named **Timesheet**, **Daily hours**, **Summary**, opened in Excel, Google Sheets or Numbers. Paper draws a picture of a spreadsheet application, so these values come from the picture by eye (no tokens): header row bold navy text on a light blue-grey fill, a ruled bottom edge; amounts right-aligned in a monospace-looking figure format; the total row at the bottom with a thicker top rule and bold.
- **Timesheet sheet.** Row 1 banner (D17) then a header row; columns A to I: `Person`, `Department`, `Planned (h)`, `Worked (h)`, `Overtime (h)`, `Late (min)`, `Absent (d)`, `Leave (d)`, `Decided by`. One row per person in the same order as the PDF (department, then name A to Z). **Real numbers:** hours are decimals (177:30 is 177.50), formatted `0.00`, stored unrounded (177.0833 shows 177.08) so sums are exact; late minutes whole numbers; days whole or half numbers; `Decided by` is text, wrapped. Total row `Total` with `=SUM()` formulas (Planned, Worked, Overtime, Late, Absent, Leave). Filters on and a frozen header row and first column. The sample shows "... 17 more rows, same columns" only as an illustration.
- **Daily hours sheet.** One row per person per day: `Person`, `Department`, `Date`, `Planned in`, `Planned out`, `Clock in`, `Clock out`, `Worked (h)`, `Overtime (h)`, `Late (min)`, `Result`, `Decision`. Dates are real dates (`yyyy-mm-dd`), times are real times.
- **Summary sheet.** Totals by department (people, planned, worked, overtime, late, absent, leave) and the rules used (name, version, from date).
- File name `Timesheet-Nyeri-Town-2026-09.xlsx`. Never signed; the banner says which document it matches. No macros, no external links.

## 11. The month status machine

States per site-month: **OPEN** (from the 1st; the month has not ended), **TO_APPROVE** (from 00:00 Nairobi the day after the last day, derived, D6), **APPROVED** (the site's approver signed; document number issued). Payroll's stages (Calculated, Reviewed, Approved, Published, Paid) belong to Segment 2: Timesheets only reads and shows them; `Paid` appears on the month row from Segment 2 (before it exists an approved month says "Approved").

| State | Days and clock fixes | Overtime decisions | Requests | Approve | Export |
|---|---|---|---|---|---|
| OPEN | System refreshes; the manager fixes (Edit time) | Allowed, can be changed | Open; answered by the manager | Disabled with the reason (D5) | Draft |
| TO_APPROVE | Same | Same | Same | Allowed when nothing blocks (D1, D2) | Draft |
| APPROVED | Locked for everyone (`PERIOD_APPROVED`); fix answers "This month is approved. Tell HR." | Locked | New ones go to HR (D29) | Not offered | Approved (number, signature, QR) |

There is no reopen, no early close, no automatic close (Owner). After approval a change is a payslip correction by HR or the Accountant (Segment 2). A late clock event that arrives for an approved month is stored and flagged `AFTER_APPROVAL`; it never changes the approved hours and is listed for HR (the Segment 2 read). A person who joins after the month's start only has their days.

## 12. Payroll's six stages (context only, step 01)

Timesheets approved (by each site's manager) → Calculated (the system) → Reviewed (HR) → Approved (the Accountant, with a PIN) → Published (HR) → Paid (the Accountant, which locks). Timesheets owns stage 1: "Payroll waits for any site that has not approved." The stage line, amber for current and green for done, is Segment 2's.

## 13. Permissions table and the 404 versus 403 rule

Capabilities from `workforce-access.ts`. "own" is the person's own site or department. (Decisions D7 to D10, D24.)

| Role | `timesheet.read` | `timesheet.approve` (days) | `overtime.approve` | `timesheet.close` (approve the month) | `timesheet.export` | `overtime.note` | `time.fix` |
|---|---|---|---|---|---|---|---|
| Staff | no (own time only, `time.own`) | no | no | no | no | no | no |
| Department head | no (removed, D7) | no | no | no | no | own dept | no |
| Branch Manager | own branch | own | own | own | own | no | own |
| Store Manager | Central Store | own | own | own | own | no | own |
| HR Manager | all | **no** | **no** | **no** | all | no | all (D10) |
| Accountant | all | no | no | no | all | no | no |
| Director | all | no | no | Head office only | no | no | no |
| System Admin | all | no | no | no | no | no | all (as built) |

`timesheet.reopen` is deleted. **Refusal rule:** a site the person may not see answers **404** (the same "not found" as a missing one, so another site's existence is never revealed); a site the person may see but may not act on answers **403** with the reason code. Nobody decides their own day, request or overtime (the item goes to the next person up). Every route keeps `authenticate`, `attachWorkforceSubject` and `requireCapability(...)`; no new `requireRole` list.

## 14. Notifications and audit events

**Told** (the Inbox/Notifications row and the menu badge, wording added to `notification-copy.ts`; never a pay figure, only hours):
- HR and the Accountant: `Nyeri Town approved September 2026.` (on approval; D27).
- The Branch or Store Manager: items needing them (the menu badge counts clock-out fixes, overtime, requests); the Director for Head office.
- The person: overtime answered (D28); a request answered (as built); a request on an approved month moved to HR (as built wording).
- The Director's reminders for sites that have not approved after the 5th of the next month are Segment 6's (the Director Home card).

**Audited** (through the audit writer, in the same transaction; never pay figures, never a PIN):
`timesheet.month_approved` (site, month, headcount, hours, overtime hours, document number, method PIN, whether the approver's own hours are included); `timesheet.overtime_decided` (extended: decision, approved minutes, reason); `timesheet.overtime_noted`; `timesheet.exported` (D32); `timesheet.auto_approved`, `day_decided`, `request_*` (as built). **Retired** (history stays readable): `timesheet.period_closed` (AUTO), `period_reopened`, `period_signed`. The Audit log's Area filter "Workforce" shows them.

## 15. Accessibility and keyboard

WCAG 2.1 AA. One focus order top to bottom, left to right: top bar, header actions (Export, Approve), KPI cells that are actions (the fourth), months list (one tab stop, arrows move), filters, table (one tab stop into the grid, arrows move rows, Enter opens), pager. Dialogs and the drawer trap focus, give it to the first field or × and return it to the opener on close; Escape closes; Enter never signs. Colour is never the only signal: amber rows also say "to decide", green says "approved", the selected month has the dark bar as well as the fill. Contrast: `neutral-500` zero cells (`#847E76` on white, 4.0:1) are not used for meaning and carry the full word in the accessible name ("0 minutes late"); text under 13 px is only the small-caps labels. Targets 44 px on touch (the 42 px rows get a full-row target). Live regions: the KPI strip announces changes politely after a decision ("Needs you: 2"); the toast uses `role="status"`; blocked states use `role="alert"`. Reduced motion removes the row highlight and the drawer slide. Screen-reader names are given per screen above.

## 16. Gap list against the built slice 4a (consistent with `segment-1-review.md`)

| Built today | Work | Side |
|---|---|---|
| Period closes by itself at 18:00 on the 2nd day after the month; the sweep closes it | Remove the auto-close step; keep the sweep's refresh and 3-day escalation; month state derived (D6) | Back end |
| Close early, HR Reopen, manager PIN signature on a report (`close-service`, `reopen-service`, P2 to P4) | Delete; add Approve the month (S7) with PIN, document number, snapshot, lock | Both |
| `timesheet.close` for HR and System Admin; `timesheet.reopen`; head's `timesheet.approve` and `overtime.approve`; HR's `timesheet.approve` and `overtime.approve` | New table (section 13) and its test; add `timesheet.export`, `overtime.note` | Back end |
| Department head decides overtime inside an allowance; `OVERTIME_NEEDS_MANAGER` | Remove the head's decision path; the head's note only (D24) | Back end |
| Overtime: approve or decline | Approve all, part or none; minutes, reason, PIN, version (S6); new status `APPROVED_PART` | Both |
| `reportNumber` allocated at creation (TSH-000n) | Allocate at approval (D12) | Back end |
| Closed period refuses every fix, HR included; HR reopens | Approved month refuses every fix, "Tell HR" (D10, D29) | Back end |
| Page with a period header, week picker, a person's week; the Close early dialog; the Reopen dialog; the report page (`report/`) | Rebuild: months list, KPI strip, table, range picker, drawer, full month, Overtime dialog, Approve dialog, Approved state; delete the week picker, `close-dialog`, `reopen-dialog`, and the old report screen | Front end |
| T1 periods list (periods, not months) | Months list read (S1) including the open month "so far" (D18) | Back end |
| T2 period read | Month read with KPIs, needsYou, rulesUsed, otherSites | Back end |
| T4 person's period (weeks) | Person read with last 7 days, needLook, neighbours; days read (S5) | Back end |
| Export: CSV of the report | PDF and Excel (section 10) | Both |
| Menu: Timesheets for HR, Accountant, Director, department head | Branch and Store Managers only; the Director reaches Head office another way (D8); `nav-table.ts` and its test | Front end |
| The green "approve all clean days" band (left out earlier) | Stays out: clean days approve themselves | None |
| Excuse lateness as a decision | Becomes a quiet optional button on S5 (D11); not an exception | Both |
| Requests page, My time, My rota, Report a problem | Keep; only the wording changes (section 9) | Front end |
| Home cards for timesheets "Waiting for you" | Light touch only (Segment 6) | None |
| `timesheetCutoff` rule field | Leave unused (D30) | None |

## 17. Paper looks wrong or inconsistent (recorded, Paper not edited)

1. Hours worked is **5,356 h** on the page and in the months list but **5,360 h** in the Approve dialog, the PDF and the Excel total (D19). One must be fixed in Paper; the spec follows one number everywhere.
2. The sample PDF number is **TSH-0009** (Excel and PDF) while the review says **TSH-0019**; both are samples (D12).
3. Step 02 shows "Approve September" enabled while 3 things need the manager and step 11 shows "Still to decide: Nothing": the two frames are different moments; the blocked form is not drawn (D1).
4. A late mark of 5 minutes appears for Cynthia Wairimu although the Rules' grace is 5 minutes ("Grace 5 min; deducted after 3 late days"). Either the sample should be 6 minutes or "late recorded" counts any lateness; the spec records any lateness and leaves the sample alone. The Excel total of late minutes (97) does not equal the sum of the PDF's late column (5 + 8 + 10 + 25 + 52 = 100), and the PDF shows five people with late time while the figure says 6 late marks.
5. The sidebars in steps 02 to 12 still show the **Waiting for you** row and a badge "4", and the Timesheets badge "3" stays on step 12 after the count is 0 (known; `nav-table.ts` is the authority).
6. Page 2's department "Pastry" count says "5 people", Service "9 people": together 14 as the continuation line says; correct. The PDF header in the Paper frame shows the Paper step bar over the page (not part of the document).
7. The Excel frame draws a spreadsheet application, so there are no values to match; the file format is specified in words (section 10).
8. Overtime caption on step 02 ("1 h 30 approved · 2 h 15 to decide") is right for 3 h 45; step 12's "3 h 45 approved" assumes the rest are approved in full.
9. The table row height in Paper is 43 px and the full-month rows 35 px; the kit has 42 and none for 35 (a `dense` row is added).

## 18. What production adds beyond Paper (summary list)

Blocked approval with a reason and a "Show them" link (D1); disabled approval for the open month with a reason (D5); a stepper for "Approve part" (D3); idempotent, versioned writes and a 409 "changed underneath" path (D25); wrong-PIN and no-PIN states (D26); sort and rows-per-page on the people table (D22); a months pager (D21); a Draft stamp, watermark and unsigned block (section 10); range and extract exports (D13); synchronous and background export, failed-export and offline states (S3); a one-person export from the full month; an Excuse button for lateness (D11); a head's-note path in the data (D24); responsive rules at narrow desktop and phone (D23); loading, empty, error, no-access, switch-off states on every screen; long-name, 200-person, part-month and night-shift handling; notifications to the person and to HR and the Accountant (D27, D28); audit of every export (D32); keyboard and screen-reader behaviour (section 15); the QR verify payload (D15).

## 19. Tests the build must include

Back end: pure tests for `needs-you`, `so-far`, month state by date (Nairobi versus UTC, February, a 31-day month), overtime part stepping and minutes, the access table (section 13) and route matrix, `approve` (blocked, double submit with one key, a different key, stale totals, wrong PIN, not the approver, other site 404), the lock (`PERIOD_APPROVED` for fixes, decisions, requests), PDF page planner (20 on page 1, whole departments, a department over 26, rules and signature never split), Excel numbers (sums exact, decimals), and a database flow test. Front end: pure view logic (KPI copy, status words, range rules), components as static markup per role, the nav table rows, and a browser run on the lane database at 1440 and 390 for S1 to S8 with the kit's visual gate per screen.
