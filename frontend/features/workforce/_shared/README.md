# Workforce shared kit

The screen pieces and behaviour rules every Workforce screen uses, built once to the owner-approved Paper designs. Later sessions compose these pieces; they do not re-draw them. Front end only. Import from `features/workforce/_shared` (`index.ts`), never from a file inside it.

See every piece in every state at **`/dev/workforce-kit`** (a dev page, 404 in production). Each section is labelled with its Paper node (file "Wendo RMS · Approved designs").

**Status:** built on branch `feat/workforce-ui-kit`, awaiting the owner's review. Nothing pushed. The back end is untouched.

## What each piece is for

| Piece | File | Use it for |
|---|---|---|
| Behaviour rules | `lib/interaction.ts` | The shared hover (pointer devices only), focus ring, pressed, disabled and motion classes, plus the 30 s undo window and the 8 s "Still loading" wait. Every piece composes these. |
| KPI strip | `components/kpi-strip.tsx` | The band of numbers at the top of Employees, HR Home, Branch Manager Home. Actionable cells (warning edge, number, arrow) are buttons. |
| Status tags | `components/status-tag.tsx` | `StatusTag` (tone + words) and `WorkforceTag` (by key: complete, needsFinishing, bankMissing, monthly, clocksIn, ...). Also checklist chips (`mark="done"` / `"open"`). |
| Filter chip, filter bar | `components/filter-chip.tsx` | "Needs finishing 3" chips and the bar layout (search, chips, dropdowns at the right). Real tables feed it from `ui2/data-table`, which owns URL state. |
| Avatar | `components/person-avatar.tsx` | `PersonAvatar` (initials or photo, 24/34/48/60 px, optional presence dot), `AvatarStack`, `PresenceDot`. Colour comes from the name. |
| Completeness ring, probation bar | `components/completeness-ring.tsx` | The file-completeness ring (`variant="status"` or the small `"progress"` one) and the probation bar. Thresholds are in `lib/status-colour.ts`. |
| Timelines | `components/timeline.tsx` | `LifeTimeline` ("Life at Wendo") and `ComingUpTimeline`. |
| List and detail | `components/list-detail-layout.tsx` | Two columns, caramel bar on the chosen row; one column on a phone. |
| Wizard | `components/wizard-layout.tsx` | Top line with draft indicator, step rail, "The file so far" panel, footer. |
| Reason chips | `components/reason-chips.tsx`, `lib/reason.ts` | A short list plus "Other" (needs words). Real radios, so arrow keys work. |
| Dialogs | `components/change-dialog.tsx` | `KitDialog` (shell), `ChangeSummary` (the "What changes when ..." box), `OldToNew`, `DialogButton`, `ChangeDialog` (the lot), `WorkforcePinDialog` (PIN for a signed act, reusing the shell's `SignSheetDialog`). |
| Undo toast | `components/undo-toast.tsx`, `lib/undo.ts` | The 30 second Undo after an answer. The screen owns what Undo does. |
| Single-day date field | `components/single-date-field.tsx` | A date field in a dialog; opens the approved picker in single-day mode. |
| States kit | `components/states.tsx`, `lib/states-copy.ts` | `ListSkeleton`, `EmptyState` (nothing yet / nothing found), `ErrorBlock`, `OfflineStrip`, `SavedOnPhoneMarker`. A screen asks for its words by key: `statesCopy('rota', 'nothingYet', { range })`. |
| Notifications | `components/inbox-row.tsx`, `lib/notification-copy.ts` | The five-part Inbox row, and the 40-row wording table as a typed module. |

Rules enforced inside the pieces (not left to screens): one brown button per screen (the dialog and wizard footers have the only one, everything else is outlined), a button a role may not use is hidden (an action is passed only if allowed; the pieces never render a greyed role-blocked action), Escape closes a dialog and gives focus back to the button that opened it, the first field has focus when a dialog opens, and Enter never completes a signed act (no `<form>`; the PIN field signs on its last digit).

No piece holds a role name. Words come in as props or from `states-copy.ts` / `notification-copy.ts`.

## Parity manifest

"Computed" = the key elements' `getComputedStyle` in the gallery were compared with Paper's `get_computed_styles` / `get_jsx` values (size, weight, line height, letter spacing, colour, padding, border, radius). "By eye" = checked in the gallery against the Paper screenshot. A piece marked **pending** was built from Paper's exact values but not yet compared side by side; the owner's review is that check. No pixel-diff tool was used.

| Paper node | Piece | States built | Width checked | Verdict |
|---|---|---|---|---|
| 1Q58-0 | Behaviour rules | hover (pointer only), focus ring, pressed, disabled with reason, reduced motion | 1280 and 390 (touch, reduced motion emulated) | matches the rule text; hover/pressed built beyond Paper |
| QX1-0 / SUY-0 | KPI strip | plain, actionable, hover, focus, phone stack | 1280 desktop; 390 phone. Computed: 30/600/34, -0.025em, 10 px mono caption, 2 px edge, 16/20 padding, 6 px gap | matches (two greys use the nearest token, see below) |
| R3E-0 / 11LC-0 / QJ9-0 | Status tags | all tones, row (2 px) and header (3 px) size, checklist marks | 1280. Computed: 2/8 padding, 12/16, square, tone colours | matches |
| R2T-0 | Filter chips | default, chosen, attention, hover, focus, disabled with reason | 1280. Computed: 32 px, 12 px padding, 8 px gap, ink fill when chosen | matches |
| R3E-0 / 11LC-0 / QJ9-0 | Avatar, stack, presence | initials, photo, photo failed, presence on/late/off, 24/34/48/60 | 1280 by eye | pending (sizes and tile colours from Paper values) |
| 11LC-0 / RD3-0 | Completeness ring, probation bar | ring 20/49/50/67/84/85/99/100, progress variant; bar green/amber/red | 1280 by eye; thresholds unit-tested | corrected: amber has no token (see below); otherwise pending side-by-side |
| 11LC-0 / POH-0 | Timelines | done, future (dashed), coming-up, good | 1280 by eye | pending |
| R3E-0 | List and detail | chosen, hover, focus, phone one column | 1280, 390 | pending (caramel bar uses `caramel-600`, as the Home card bar does) |
| R5O-0 / RB9-0 / RD3-0 / RDS-0 / RB3-0 | Wizard | step current/upcoming/done, panel, footer, top line | 1280; 390 stacks | pending |
| VM5-0 | Dialog shell, summary, buttons | open, busy, disabled with reason. Computed: 580 wide, title 20/600/26/-0.02em | 1280 | matches (scrim differs, see below) |
| (rule 06) | Reason chips | none, chosen, Other with text | 1280 | built from the chip style; no separate Paper node |
| (rule 03) | Undo toast | counting, drained | 1280 | not drawn in Paper; built beyond |
| 1S6R-0 | Single-day date field | empty, chosen, error, future allowed, past only | 1280 | uses the approved picker; single-day mode added |
| 1Q6R-0 / 1Q84-0 | States kit | loading (+8 s line), nothing yet, nothing found, error (+reference, retrying), offline strip, saved marker | 1280 | matches Paper values; pulse on bars is beyond Paper |
| 19PW-0 / 19S3-0 / 19TC-0 | Inbox row, wording table | one per kind, unread, with and without action | 1280 | amber bar uses `caramel-600` (see below) |

## Built beyond Paper

Paper draws no hover, pressed, focus or disabled. These were built in the same visual style and are listed so the owner can see them.

| Item | What was built |
|---|---|
| Hover | Pointer devices only (`hover: hover` and `pointer: fine`). Chips, list rows, KPI action cells, buttons: a one-step neutral tint; brown buttons go to `primary-hover`. |
| Pressed | `scale(0.98)`, 150 ms, strong ease-out, off under reduced motion. |
| Focus | The design system's 3 px espresso ring, keyboard only. |
| Disabled | 60 % opacity, not clickable, and the reason shown as text under the control (and as a tooltip). |
| Wizard step "done" | A green circle with a tick (Paper shows only the current and upcoming step). |
| Presence dot on the avatar | Paper draws the status dot only beside the "ON SHIFT" label; the corner dot on an avatar is new. |
| KPI strip on a phone | Cells stack with a hairline between. |
| List and detail on a phone | One column; the detail replaces the list. |
| Wizard on a phone | Steps run along the top, panel goes under the form. |
| Unread dot on an Inbox row | A small brown dot before the area label. |
| Loading bars | A gentle pulse (off under reduced motion). |
| Undo toast | Whole piece: message, seconds left, Undo, a thin line that drains over 30 s. |
| Reason chips | The chip style reused for reasons; "Other" opens a text box that takes focus. |
| Old to new row | Struck-out old value, arrow, new value. |
| Red dialog button | For a destructive confirmation (rule 04). |
| Error "Trying…" | The Try again button's busy state. |
| Tag tones without a drawn example | Late (error), Overtime (info), Pending (warning), Approved (success), Declined (error), No login (outlined), Contract missing (warning). They follow the same tone rules but are not drawn as tags in the chapters read. |
| Picker single-day mode | `ui2/date-range-picker` gained `single`, `maxDate`, `minDate` (all optional; defaults leave every existing use unchanged). In single mode: one click picks the day, no To field, only the "Today" quick pick, calendar icon and full date on the trigger. |
| Dev page guard | The other `/dev` pages have no production guard and sit outside the login gate. `/dev/workforce-kit` returns 404 in production. |

## Tokens Paper uses that the design system lacks

Values come from `get_jsx` / `get_computed_styles`; none was hard-coded. The nearest token was used and is named here.

| Paper value | Where | Used instead |
|---|---|---|
| `#E0A020` amber ring stroke and probation fill | Completeness ring, probation bar | `caramel-500` (`#D9A65E`) |
| `#B27A0A` amber number | Ring percent, probation "Day 80", Inbox amber bar | `warning-fg` for text; `caramel-600` for the bar |
| `#FAF9F7` panel fill | "The file so far" | `neutral-50` (`#F6F5F3`) |
| `#6B6760`, `#A09B93` | KPI caption and detail, KPI arrow | `neutral-600` (`#635E57`), `neutral-400` (`#A8A39B`) |
| `#CFCBC4` outlined tag/button border | Neutral tags, Cancel | `border-strong` (`#D2CFC9`) |
| `#EAF3EA` / `#BFD8BF`, `#FBF1DE` / `#E9D3A8` | Checklist chips and header tags | `success-bg`/`border`, `warning-bg`/`border` |
| `#9A2B1C` | Error block top rule, "Problem" text | `error-fg` (`#97281D`) |
| `#1715128C` (55 %) scrim | Dialog scrim | `neutral-950` at 55 % via `color-mix` (the token `--wds-scrim` is 35 %) |
| `#FBF6EE` chosen row, `#D9B994` avatar | Head picker, Housekeeping avatars | not used by a kit piece |
| `#8D8982`, `#8A857D` faint greys | "When", axis marks, dialog × | `text-muted` |
| `#6E421F`, `#5B3417` (Paper `espresso-650`, `750`) | Home card label | not used; not in `tokens.wds.css` |
| Paper `--color-espresso-600` is `#B0610F` | the picker's Apply and the wizard ring | the repo's `selected-edge` is `#B0610F`; `espresso-600` there is `#8B5A32` |

## Open questions for the owner

1. **Tag colours for Late, Overtime, Pending, Approved, Declined.** Paper shows these on screens I did not read for this kit; I used warning/error/info/success by meaning. Say if any differs.
2. **The notification table colours its own "Kind" column inconsistently** (Notice ended by itself and Pay run published are labelled Information and Done but drawn amber; New phone signed in uses `#2F5D7C`, not the info colour). The module follows the **label**, so the bar colour follows the kind word. Confirm.
3. **One brown button per screen versus an Inbox full of rows.** The template draws the row action brown. A list of rows would have many. `InboxRow` takes `emphasis: 'outlined'` for lists; which should lists use?
4. **Amber.** Paper's ring uses an amber (`#E0A020` / `#B27A0A`) that is not in the tokens. Add two tokens, or accept `caramel-500` / `warning-fg`?
5. **"Life at Wendo" on a phone.** Paper draws four 200 px columns. On a phone the kit keeps the line; it needs to scroll sideways or turn into a vertical list. Not drawn, so not decided.
6. **Dev pages and production.** The other `/dev` pages have no guard. Worth adding one for all of them?
7. **PIN dialog and Enter.** It reuses Inventory's `SignSheetDialog`, where the fourth digit signs. Rule 09 reads "the PIN field does", so that is kept; say if a signed act should also need a button press.
