# Workforce shared kit

The screen pieces and behaviour rules every Workforce screen uses, built once to the owner-approved Paper designs. Later sessions compose these pieces; they do not re-draw them. Front end only. Import from `features/workforce/_shared` (`index.ts`), never from a file inside it.

See every piece in every state at **`/dev/workforce-kit`** (a dev page; every page under `app/dev/` returns 404 in production). Each section is labelled with its Paper node (file "Wendo RMS · Approved designs").

**Status:** two passes on branch `feat/workforce-ui-kit`, awaiting the owner's review. Pass 1 (owner-approved): behaviour rules, KPI strip, tags, chips, avatar, ring, timelines, layouts, dialogs, undo, date field, states, notifications. Pass 2 (this one): the gap audit, built so later sessions only compose. Nothing pushed. The back end is untouched.

## What each piece is for

| Piece | File | Use it for |
|---|---|---|
| Behaviour rules | `lib/interaction.ts` | The shared hover (pointer devices only), focus ring, pressed, disabled and motion classes, plus the 30 s undo window and the 8 s "Still loading" wait. Every piece composes these. |
| KPI strip | `components/kpi-strip.tsx` | The band of numbers at the top of Employees, HR Home, Branch Manager Home. Actionable cells (warning edge, number, arrow) are buttons. |
| Status tags | `components/status-tag.tsx` | `StatusTag` (tone + words) and `WorkforceTag` (by key). Also checklist chips. |
| Filter chip, filter bar | `components/filter-chip.tsx` | "Needs finishing 3" chips and the bar layout. Real tables feed it from `ui2/data-table`, which owns URL state. |
| Avatar | `components/person-avatar.tsx` | `PersonAvatar`, `AvatarStack`, `PresenceDot`. Colour comes from the name. |
| Completeness ring, probation bar | `components/completeness-ring.tsx` | The file-completeness ring and the probation bar. |
| Timelines | `components/timeline.tsx` | `LifeTimeline` ("Life at Wendo") and `ComingUpTimeline`. |
| List and detail | `components/list-detail-layout.tsx` | Two columns, caramel bar on the chosen row; one column on a phone. |
| Wizard | `components/wizard-layout.tsx` | Top line with draft indicator, step rail, "The file so far" panel, footer. |
| Reason chips | `components/reason-chips.tsx`, `lib/reason.ts` | A short list plus "Other". `legendStyle="sentence"` and `hint="required"` give the question form ("If you decline, say why"). |
| Dialogs | `components/change-dialog.tsx` | `KitDialog` (shell; `plain` is the approval-dialog paint), `ChangeSummary`, `OldToNew`, `DialogButton` (`size="lg"` is 38 px), `ChangeDialog`, and **`WorkforcePinDialog`**: a summary list, one dots field, a caption, Cancel and the brown button. |
| PIN field, code boxes | `components/pin-field.tsx` | **`PinField`**: one wide bordered field with a dot per digit, for a signed act (the last digit calls `onComplete`; Enter never does; the phone number pad is kept). **`CodeBoxes`**: four boxes with red borders on a wrong code, for the payslip code. |
| Person radio list | `components/person-radio-list.tsx` | A short list of people to pick one from (avatar, name, grey line, "Recommended"), real radios. Added in slice 1b for "Assign a head". |
| Key-value rows | `components/key-value-rows.tsx` | Label left, value right under an ink rule; mono values, tone, old to new. |
| Undo toast | `components/undo-toast.tsx`, `lib/undo.ts` | The 30 second Undo after an answer. |
| Single-day date field | `components/single-date-field.tsx` | A date field in a dialog (approved picker, single-day mode). |
| States kit | `components/states.tsx`, `lib/states-copy.ts` | Loading, empty, error, offline, saved-on-phone; words by key per screen. |
| Notifications | `components/inbox-row.tsx`, `lib/notification-copy.ts` | The five-part Inbox row (button **outlined by default**; `emphasis: 'primary'` only for one lone card) and the 40-row wording table. |
| **Table look** | `ui2/table.tsx`, `ui2/data-table/data-table.tsx`, `components/table-cells.tsx` | The existing table with search, filters, numbered pager and URL state, drawn the Workforce way: `<DataTable tableLook="workforce" rowSize="compact?">` or `<Table look="workforce">`. Cells: `AvatarCell`, `NumberCell`, `StatusText`, `NeedsYouLine`. Selected row: `data-state="selected"`. Nothing changes for a table that does not ask. |
| **Page parts** | `components/page-parts.tsx` | `PageHeader` (24 px title; `size="lg"` 28 px), `PeriodStepper`, `UnderlineTabs`, `SegmentedControl`. Tabs and segments move with the arrow keys (`lib/roving.ts`). |
| **Callout** | `components/callout.tsx` | Notes, status cards and banners: tones neutral/info/success/warning/error; variants `tint`, `bar`, `dashed`; kicker, title, square bullet, action below or at the end. |
| **Panels and rows** | `components/panel-parts.tsx` | `Panel`, `SettingRows`, `StatBoxes` (`figures`, `compact`, `times`, `compare`), `ChecklistRows`, `NoteRows`. |
| **Choices** | `components/choice-controls.tsx` | `ChoiceChips`, `OptionList`, `RadioCards`, `ActionCards`, `RemovableChip`, `AddChip`, `ChipLegend`. The first three are real radios. |
| **Forms** | `components/form-parts.tsx` | `FormField` (label, control, helper or error, wired with `aria-describedby`), `FIELD_CLASS`, `TimeField` (masks, fills the minutes, validates). |
| **Time helpers** | `lib/time.ts` | `formatHms`, `formatMmSs`, `formatHoursMinutes` ("41 h 05"), `formatHoursMinutesUnit` ("8 h 02 m"), `formatDuration` ("1 h 30"), `maskClock`, `parseClock`, `minutesBetween`. Pure, tested. |
| **Schedule** | `components/schedule-parts.tsx`, `lib/shift-palette.ts` | `ShiftChip`, `PickShiftButton`, `ShiftLegend`, `ShiftSwatchPicker`, `ShiftGrid` (presentational: no data, popover or publish), `TwoLineRow`. |
| **Phone** | `components/phone-parts.tsx` | `PhoneDarkHeader`, `TimerChip`, `PhoneHero`, `PhoneButton`, `ClockCard`, `WeekBars`, `DayStrip`, `PhonePrompt`, `DayCard`, `TimeRow`. |
| **Home rows and drawer** | `components/home-parts.tsx` | `AttentionRow`, `MiniBar`, `WorkforceDrawer` (on `ui2/sheet`), `DrawerSection`. |
| **Printed document** | `components/workforce-document.tsx`, `lib/document-palette.ts` | `WorkforceDocument` (A4 794 × 1123 or landscape 1123 × 794: navy bar, header, body, signature "Signed with PIN", QR, footer), `DocHeading`, `DocParagraph`, `DocumentCanvas`. |

Added in slice 2 (Rota): **`WorkforceFrame`** (`components/workforce-frame.tsx`: the top bar, compact bar and canvas every Workforce screen sits in; People's `PeopleFrame` re-exports it), **`useRemote` and `useAction`** (`hooks/`, moved from People), `useWorkforcePermissions().scopeOf(capability)`, an empty-cell variant on `ShiftGrid` (a quiet button that opens a picker) with `data-row` / `data-day` on cells, `DocumentCanvas width`, and **`signatureName`**: a printed signature shows only the first and second name (brackets dropped), the full name stays in the line under it.

Added in slice 4a (Timesheets): **`StatBoxes row`** keeps the before-and-after boxes side by side on a phone (default: they stack), **`TimeRow`**'s day column is 52 px and does not wrap (two-digit days), and the capability list has `timesheet.close` and `timesheet.reopen`.

Rules enforced inside the pieces (not left to screens): one brown button per screen (the dialog and wizard footers have the only one; lists use outlined), a button a role may not use is hidden (an action is passed only if allowed; the pieces never render a greyed role-blocked action, and a chip becomes a button only when the screen passes `onSelect`), Escape closes a dialog or drawer and gives focus back to the opener, the first field has focus when a dialog opens, and Enter never completes a signed act (no `<form>`; the PIN field signs on its last digit).

No piece holds a role name. Words come in as props or from `states-copy.ts` / `notification-copy.ts`.

## Parity manifest

"Computed" = the key elements' `getComputedStyle` in the gallery were compared with Paper's `get_computed_styles` / `get_jsx` values (size, weight, line height, letter spacing, colour, padding, border). "By eye" = looked at in the gallery next to Paper's `get_screenshot` (done for the dialogs 17W2-0 and 1BBO-0 and the phone home 19XI-0). "By values" = built from Paper's `get_jsx` values and seen in the gallery, without a screenshot comparison. "Approved" = pass 1, reviewed and approved by the owner, not re-compared in pass 2. No pixel-diff tool was used. Nothing below is pending.

| Paper node | Piece | States built | Width checked | Verdict |
|---|---|---|---|---|
| 1Q58-0 | Behaviour rules | hover (pointer only), focus ring, pressed, disabled with reason, reduced motion | 1280 and 390 | matches the rule text; hover/pressed built beyond Paper |
| QX1-0 / SUY-0 | KPI strip | plain, actionable, hover, focus, phone stack | 1280; 390 | computed: matches (two greys use the nearest token) |
| R3E-0 / 11LC-0 / QJ9-0 | Status tags | all tones, row and header size, checklist marks | 1280 | computed: matches |
| R2T-0 | Filter chips | default, chosen, attention, hover, focus, disabled with reason | 1280 | computed: matches |
| R3E-0 / 11LC-0 / QJ9-0 | Avatar, stack, presence | initials, photo, photo failed, presence, 24/34/48/60 | 1280 | approved (pass 1) |
| 11LC-0 / RD3-0 | Completeness ring, probation bar | ring 20 to 100, progress variant; bar green/amber/red | 1280 | approved (pass 1); amber uses the nearest tokens (below) |
| 11LC-0 / POH-0 | Timelines | done, future (dashed), coming-up, good | 1280 | approved (pass 1) |
| R3E-0 | List and detail | chosen, hover, focus, phone one column | 1280, 390 | approved (pass 1); caramel bar uses `caramel-600` |
| R5O-0 / RB9-0 / RD3-0 / RDS-0 / RB3-0 | Wizard | step current/upcoming/done, panel, footer, top line | 1280; 390 stacks | approved (pass 1) |
| VM5-0 | Dialog shell, summary, buttons | open, busy, disabled with reason | 1280 | computed: 580 wide, title 20/600/26 |
| **1J7K-0 / 1DAK-0 / 1KGT-0** | **PIN dialog, `PinField`** | one dots field, wrong PIN, disabled, first-use set PIN, Escape returns focus, 4th digit signs, Enter does not | 1280 | **computed: dialog 540 wide, padding 28/26, title 20/26/600, field 40 high 18/22, 0.3em, ink border, buttons 38 high 14/18; fixed** |
| **1PNG-0** | **`CodeBoxes`** | default, wrong code (red on all four), disabled | 1280 | **computed: 44 × 52, 22/28 dot, red `error-fg` border** |
| **R3F-0 / R3L-0 / 18BH-0 / 1O9D-0** | **Table look** | header, 56 px rows, 42 px compact, hover, chosen row, search, pager, avatar cell, mono numbers, status words, needs-you line | 1280 | **computed: header 36, 11/14 mono, 0.06em, `neutral-600` text, ink rule; rows 56 and 42, `neutral-200` border; chosen row 3 px caramel bar + warm fill.** Audit log's own header is 10 px with 0.08em; the Workforce look uses the Employees header for all (owner's brief) |
| **16DF-0 / 1KEL-0 / 18AS-0** | **`PageHeader`, `PeriodStepper`** | md, lg with actions, stepper disabled ends | 1280 | **computed: 24/30/600/-0.02em (28/34 for Rules), grey line 14 or 13 px; Paper's title is 24 px, not 26** |
| **1KEU-0 / 1D6Z-0** | **`UnderlineTabs`, `SegmentedControl`** | chosen, hover, focus, arrow keys, 10 tabs scroll | 1280 | **computed: tab 9/14 padding, 2 px ink underline, 13/16 (600 chosen); segment chosen 8/14 ink, others 7/14 + 1 px border, 32 high** |
| **16W3-0 / 1B9X-0 / 1S4P-0 / 1ISM-0 / 19XC-0 / 1PO3-0** | **`Callout`** | tint (five tones), bar, dashed, bullet, action below, action at end | 1280 | **by eye for the neutral dialog note (17W2-0, bullet, border, text); by values for the error, warning, bar and dashed forms** |
| **17W2-0 / 1JA8-0 / 1BBO-0 / 1KFG-0 / 1IRJ-0 / 17WK-0** | **`Panel`, `SettingRows`, `StatBoxes`, `ChecklistRows`, `NoteRows`** | figures, compact (amber number only), times (filled cell), compare (mono 20, red side tones only its value, green after), tick states | 1280; boxes stack on a phone | **by eye against `get_screenshot` of 17W2-0 and 1BBO-0; corrected after the first compare (compact boxes do not fill; compare is a separate size)** |
| **18DN-0 / 1AUB-0 / 1CPF-0 / 19FR-0 / 1B9N-0** | **Choice controls** | chips (md, sm), option list (tick), radio cards (1 and 2 columns), action cards (primary, outlined, disabled with reason), removable, add | 1280 | **by eye for the radio cards and radio dot (1BBO-0); by values for the rest; arrow keys tested** |
| **18X4-0 / 1AMN-0** | **`FormField`, `TimeField`** | default, focus, error, disabled, half-typed time fills in | 1280 | **by values; field 36 high, 1 px `border-strong`, espresso border + 12 % ring on focus** |
| **16G6-0 / 16FP-0 / 18XZ-0 / 19AL-0 / 16EK-0** | **`ShiftChip`, grid, legend, swatches, `PickShiftButton`, `TwoLineRow`** | five tones, long, chosen ring, flagged, changed-from, disabled, day off, thin footer | 1280; grid scrolls on a phone | **computed: chip 74 × 26, 11/14 mono; table 794 wide, header 32, row 42, footer 36, day column 84, person 150, hours 56; pick-shift 84 × 32 dashed** |
| **19US-0 / 19XI-0 / 1CGJ-0 / 1CHM-0 / 199C-0 / 19FF-0 / 19FR-0** | **Phone pieces** | header (back, figure), timer chips, hero, clock card (before, on shift with progress), week bars, day strip, prompt, day card (today, changed, day off), time row (ok, short, problem) | 390 (emulated, touch) and 1280 | **by eye against `get_screenshot` of 19XI-0 (avatar gradient corrected after it); other phone screens by values; tap targets measured: all 44 or more (the "Report a problem" button keeps Paper's 30 px look with a 44 px hit area)** |
| **1ACQ-0 / 1ADN-0 / 1B9N-0** | **Attention rows, mini bar, drawer** | button row, bar row, tones, drawer open, Escape returns focus | 1280 | **by values: drawer 480 wide with a 48 px tile, rows with a 3 × 34 bar; Escape and focus return tested** |
| **1E9O-0 / 19JN-0** | **`WorkforceDocument`** | portrait, landscape, signature + QR, footer | 1280 | **computed: 794 × 1123 and 1123 × 794 (Paper's landscape is 794 high, not 848); signature 38 px Alex Brush; QR 76** |
| (rule 06) | Reason chips | none, chosen, Other with text, sentence legend with hint | 1280 | built from the chip style |
| (rule 03) | Undo toast | counting, drained | 1280 | not drawn in Paper; built beyond |
| 1S6R-0 | Single-day date field | empty, chosen, error, future allowed, past only | 1280 | uses the approved picker |
| 1Q6R-0 / 1Q84-0 | States kit | loading (+8 s line), nothing yet, nothing found, error, offline, saved marker | 1280 | matches Paper values |
| 19PW-0 / 19S3-0 / 19TC-0 | Inbox row, wording table | one per kind, unread, with and without action | 1280 | amber bar uses `caramel-600` |

## Built beyond Paper

Paper draws no hover, pressed, focus or disabled. These were built in the same visual style and are listed so the owner can see them.

| Item | What was built |
|---|---|
| Hover, pressed, focus, disabled | Pointer-only hover (one-step tint), `scale(0.98)` press, the 3 px espresso keyboard ring, 60 % opacity with the reason as text. |
| Wizard step "done", presence dot, KPI and list phone layouts, unread dot, loading pulse, Undo toast, reason chips "Other", old-to-new row, red dialog button, "Trying…" | As in pass 1. |
| Tag tones without a drawn example | Late (error), Overtime (info), Pending (warning), Approved (success), Declined (error), No login, Contract missing. **Owner decision 1: keep.** |
| Picker single-day mode | `ui2/date-range-picker` gained `single`, `maxDate`, `minDate`. |
| `/dev` guard | **One `app/dev/layout.tsx` returns 404 in production for every page under `app/dev/`** (owner decision 6). |
| Dots on a PIN field | Empty positions show faint dots so the field reads as four digits; Paper draws only the filled state. |
| Timer chip amber | Not drawn in the screens read; built from the warning and caramel tokens. |
| "Life at Wendo" on a phone | **A vertical list** (owner decision 5); Paper draws four 200 px columns and no phone version. |
| Table: hover row, focus ring | Row hover `neutral-50` on pointer devices; keyboard rows get the inset espresso ring (as the existing table does). |
| Callout `actionAt="end"` | The banner with the button at the right (Paper draws the Undo banner as plain text and a button). |
| Radio and chip groups | Real radio inputs with arrow keys; Paper draws the look only. |
| `TimeField` | Masks as you type, fills the minutes on blur, says "Use a time like 14:30." for a time that is not real. |
| `ShiftGrid` cells | A cell is a button only when the screen passes `onSelect`; every cell has a spoken name ("Victor Maina, MON 12, 06–14"). |
| Phone back button and "Report a problem" | 44 px touch areas around Paper's smaller drawn shapes. |
| Drawer | Closes with Escape and the ×, and returns focus; Paper draws neither. |
| `ui2/number-pad.tsx` | One-line fix: the server snapshot was a new object on every call, which made React log "getServerSnapshot should be cached" in the PIN dialog. Not a visual change. |

## Tokens Paper uses that the design system lacks

Values come from `get_jsx` / `get_computed_styles`; none was hard-coded in a piece. The nearest token was used and is named here. **Owner decision 4: no tokens added; the nearest are kept for amber.**

| Paper value | Where | Used instead |
|---|---|---|
| `#E0A020` amber stroke and probation fill | Completeness ring, probation bar | `caramel-500` (`#D9A65E`) |
| `#B27A0A` amber number and bar | Ring percent, probation, Inbox amber bar, thin-day footer, late-row bars, "Also at Highway Sat" | `warning-fg` for text; `caramel-600` for bars and the flag border |
| `#FBF1DE` / `#E9D3A8` mid-day amber tint | Mid-day shift chip and swatch, "EXTRA" cell | `warning-bg` / `warning-border` |
| **Lavender `#F1ECF6` / `#D9CCE8` / `#5B3F7A`** | **Early bake shift (chip, swatch)** | **A mix of the info and error tokens (`color-mix`) in `lib/shift-palette.ts`. It reads greyish next to Leave. If the owner wants the true lavender, add one token trio and change that file only.** |
| **Navy `#14284B`, rule `#D8DEE9`, ink `#111111`** | **Printed documents (top bar, headings, hairlines, body)** | **Kept as the document's own palette in `lib/document-palette.ts`, like the LPO print page (`#0B2A4A`, `#D5DCE4`). The design system has no navy token. The two documents use different navies.** |
| `#3A2A1A` / `#5A4630` grey timer chip, `#BFE3C4` chip dot, `#3F7A49` chip border | Phone timer chip | Mixes of `sidebar-top` with white; `success-border`; `success-border` |
| `#B5A79A` mono label on the dark band | Phone header kicker | `sidebar-fg-item` (`#B5AEA5`) |
| `#EBDFD2` progress track, tan avatar gradient | Clock card, hero | `espresso-200` mixed with white; `espresso-100` to a mix of `espresso-200` and `espresso-700` |
| Paper `espresso-650` (`#6E421F`), `750` | Clock card kicker, Home card label | `primary` (`espresso-700`); not in `tokens.wds.css` |
| `#FAF9F7` panel fill | "The file so far" | `neutral-50` |
| `#6B6760`, `#A09B93`, `#8A857D`, `#8F897F`, `#6B655C` greys | KPI caption, arrows, dialog ×, faint text | `neutral-600`, `neutral-400`, `text-muted`, `text-faint`, `text-secondary` |
| `#CFCBC4` outlined border | Cancel, chips, fields | `border-strong` (`#D2CFC9`) |
| `#EEECE8` row hairline | Rota and table rows | `neutral-100` |
| `#FBF6EE` chosen radio card, `#FBEAE7` / `#E5B7AF` error box | Radio cards, wrong-code box | `caramel-100` at 55 % with white; `error-bg` / `error-border` |
| `#FBF3E4` / `#EAD3A5` / `#6B4A0F` warning box | Payslip owner notice | `warning-bg` / `warning-border` / `warning-fg` |
| `#9A2B1C` | Error rules and text | `error-fg` (`#97281D`) |
| `#1715128C` (55 %) dialog scrim, `#1715124D` drawer shadow | Dialogs, drawer | `neutral-950` at 55 % via `color-mix`; `shadow-wds-drawer` |
| Paper's focus ring on fields is 12 % espresso | Fields, shift ring | `color-mix` of `primary` at 12 % (the design system's own ring is 40 %) |

## Decisions

Pass 1's seven questions are answered (tags kept, notification colours follow the Kind word, Inbox rows outlined, amber uses the nearest tokens, "Life at Wendo" becomes a vertical list on a phone, `/dev` guard added to every page, the last PIN digit signs and Enter never does). Pass 2's were settled by the owner on 17 Oct 2026 by accepting the kit's defaults:

1. **Lavender.** No new token; Early bake keeps the derived mix in `lib/shift-palette.ts`. Revisit only if it is hard to tell from Leave in use.
2. **Navy for documents.** Stays the printed page's own palette in `lib/document-palette.ts`.
3. **Audit log header.** The Workforce look uses the Employees header (11 px, 0.06em) everywhere; the Audit log is not redrawn.
4. **Landscape rota print.** 1123 × 794, as Paper draws it.
5. **Page title size.** 24 px, with `size="lg"` for the 28 px Rules heading, as Paper draws it.
6. **Radio card selected edge.** Full 1 px espresso border with the warm fill, as Paper draws it.
7. **Timer chip amber.** The warning and caramel tokens as built; change when a screen draws it.
8. **Drawer first focus.** The × takes focus on open, as built.
