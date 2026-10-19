# Workforce Segment 1A (Timesheets rework): front-end decisions

Written 19 Oct 2026 on branch `feat/workforce-1a-timesheets-frontend` (lane 2). Owner's standing rule: **production-ready, not Paper-only**. Each row is a question the spec or Paper left open (or that real use needs answered), what was built, why, and what changing it takes. Spec rows are cited as D1, D2 and so on ([decisions-1a-spec.md](specs/decisions-1a-spec.md)); back-end rows as X1 and so on ([decisions-1a-timesheets-backend.md](decisions-1a-timesheets-backend.md)). Code: `frontend/features/workforce/timesheets/` (`months/`, `person/`, `overtime/`, `approve/`, `exports/`, `requests/`, `mine/`, `_shared/`). Nothing changes for a branch whose new clock is off.

## Decisions

| # | Question | Choice | Why | What changing it takes |
|---|---|---|---|---|
| F1 | Export: Paper draws a popover under the button. | A **dialog** (`KitDialog`, 440 wide) with the same content: two format cards, whole month or the range, the draft-or-signed line, one button. | The app has no popover primitive; the dialog gives focus trap, Escape and focus return for free. | Build a popover on Radix `popover` and keep the content. |
| F2 | The PDF "opens in the Document view" (Chapter 17). | It **downloads straight away**, with the server's file name. | The Document view is not built. | Open the blob in the Document view once Chapter 17 exists. |
| F3 | Export over 10 s: "we will tell you when the file is ready". | The dialog shows "Still preparing" after 10 s and keeps waiting; a refusal shows the server's words and code. | The back end is synchronous (X22); no job or notification exists. | Needs the back-end job first. |
| F4 | Week quick picks (S2): the approved range picker has fixed quick picks. | **Not built.** One date control only: the approved range picker limited to the month (to today for the open month), plus a quiet "Whole month" link when narrowed. A second week Picker was built first and removed on the owner's say-so (two date filters is one too many). `weekPicks` in `month-words.ts` is kept, unused, for custom quick picks. | Changing the shared picker would touch every screen that uses it. | Add custom quick picks to `ui2/date-range-picker.tsx` and use `weekPicks`. |
| F5 | Table headers sorting (D22). | **Not built**: the shared table has no sortable headers; the server's default order (department, then name) is what shows. | Table convention is the kit's. | Add sortable headers to `ui2/data-table`; the API already takes `sort` and `dir`. |
| F6 | Which month opens (D20). | The oldest "To approve" month **on the first page** of the list, else the open month. The month is in the address (`?month=`). | One list read. A branch with more than 5 unapproved months is unrealistic. | Ask the list for the oldest waiting month. |
| F7 | A day that needs a look: "Answer the request". | Goes to the **Requests inbox** (`/app/workforce/requests`). | The request dialog needs the inbox row shape, which the drawer does not have. | Fetch R3 and open `RequestDialog` in place. |
| F8 | Excuse button for lateness (D11). | **Not built**: a person's day rows carry no day id, so the T6 decision cannot be addressed. | The back end does not send it. | Add `dayId` to the days read, then a small outlined button on a late row. |
| F9 | Evidence that cannot be read (spec S6). | The overtime dialog shows "We could not read the record for this day" with Try again; it does **not** decide without it. | A decision needs the item's `version`. | None needed. |
| F10 | "Edited by {Name}, {Role}" on a day. | "Edited by a manager". | The read gives only an id (X35). | Resolve the name server side. |
| F11 | Drawer width. | The kit's 480, not Paper's 500. | One drawer for all Workforce. | One class in `WorkforceDrawer`. |
| F12 | Narrow widths (D23). | Below 1100 px the Dept column hides, and the always-zero Leave column hides below 1600 px so the Status words fit at 1440 (found in the live walk with 24 people); below 768 the people become cards; the months list stacks above the table; dialogs and the drawer are full width. | Spec. No manager phone designs exist. | Breakpoints in `people-table.tsx`. |
| F13 | Fourth KPI cell when approved. | The strip got a `tone: 'success'` (green fill, edge, words), added to the shared kit. | Paper step 12. | The kit's `kpi-strip.tsx`. |
| F14 | Menu (D7, D8). | Only the Branch and Store Managers keep **Timesheets**; a new **Head office timesheets** row for the Director (opens the same page on the Director's own site); HR, the Accountant and heads lose the link, and the route gate no longer lets a head in. HR and the Accountant reach it by address (Payroll links it later, Segment 2). | Owner's review; D8. | Rows in `nav-table.ts`, one clause in `route-access.ts`, their tests. |
| F15 | Home's "Timesheets close" event read the removed periods route. | Now reads the months list: "Timesheet ready to approve", dated the first day it can be approved. | The route is gone; Home is otherwise Segment 6's. | Segment 6 replaces the cards. |
| F16 | Report a problem on an approved month (spec section 9). | The helper line says the manager will answer; for a day in an approved month the form shows "This month is approved. Tell HR." and the button reads **Send to HR** (the server sends it straight to HR, D29). **"Call HR" is not built**: no HR contact line exists in the Rules store. | Nothing to link to. | Add the contact to Rules, then link it. |
| F17 | A wrong or missing PIN, a stale version, a double tap. | Wrong PIN: "That PIN is not right.", the field clears. No PIN set: the server's sentence. Stale: "This changed while you were looking. Check it again." and the item reloads. Approve and the overtime decision disable while saving; approve carries one idempotency key per dialog, renewed after a stale refusal. | D25, D26. | n/a |
| F18 | "Sept". | The browser's British locale writes "Sept"; the words helper writes "Sep" as the spec does. | A real difference found in the tests. | `timesheet-words.ts`. |
| F19 | Stale data. | The page re-reads when the tab returns after 60 s and after every action; no toast. | Spec S1. | `use-refresh-on-focus.ts`. |
| F20 | Back to the month from the full-month page. | The crumb keeps site, month and days; the **table's own filters** (search, chip, page) are not carried. | They live in the table's address state. | Pass them through the crumb link. |

## Beyond Paper (built in the same style)

Blocked approval with its reason and "Show them" (D1); the disabled button with the date reason for the open month (D5); the part-approval stepper (D3); the 409 "changed underneath" paths; the offline, slow and failed export states; the "Nobody worked" and "Not found" states; the Head office timesheets row; the months pager; sort order from the server; the narrow-width cards; "Not yet employed" days; the two-shift and night-shift day rows; the Report a problem approved-month wording.

## Back-end changes made in this session

None.

## Not checked in a browser

The browser tool lost its connection part-way (see the status line in the README). Checked live in a browser: the Branch Manager's months list, month panel, drawer and full-month page on real data. Checked through the API only: HR cannot approve, both exports for both states, the approved-month lock, the audit entries (the back end's own proof run: 122 checks, 0 failed). **Not walked in a browser: the Approve dialog click-through, the export download click, the overtime dialog click-through, the Director's row, the 1440 width.**
