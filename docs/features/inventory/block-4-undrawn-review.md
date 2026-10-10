# Block 4 (Branch day): what was built beyond Paper

For the owner. Written 10 Oct 2026 by the integration session (branch `feat/block4-integration`). Paper is direction; where it did not draw a screen, button or state, the sessions built it in the same style rather than leave it out. Each piece says who sees it and the exact steps to open it, so you can approve it or ask for a change. Logins are the lane test users (password `password123`, PIN 1234); on production use the real ones. The gap numbers (G1 to G33) are the sections of `branch-day-paper-spec.md` §9.

Wherever Paper and this list disagree, Paper wins.

To put a day in a known state on the lane: `cd backend && npx tsx src/scripts/seed-branch-day-dev-fixtures.ts --state=none|open|counting|ready|closed` (then set the head and member PIN: only `bm.town@wendo.test` gets 1234 from the script).

## 1. Check and sign for a big department (owner ruling, 10 Oct). Department head or member, phone

- **What:** up to 12 items the screen is exactly Paper's step 3b (names under each section). Above 12, each section is one line ("Dry goods · 21 items") and the names are gone; "See every figure" still lists every item. Kitchen has 130 items and the full list was a wall of text.
- **Open it:** `kitchen.head.town@wendo.test` (130 items) › Day › Count your department › fill every box › Check and sign. A department with 12 or fewer items shows the names.
- **Change it:** the limit is `CHECK_NAMES_LIMIT` in `phone/lib/count-logic.ts`.

## 2. The recount screen (G28). Department head or member, phone

- **What:** Paper never drew it. "No, I'll recount" opens the step 3 layout with the title "Recount the opening", the button "Check the difference", then the sign screen and "Opening recorded".
- **Open it:** `barista.head.town@wendo.test` › Day (in the morning, before 12:00 Nairobi) › Check the opening › No, I'll recount.

## 3. Loading, empty, error and permission states (G26). Every screen

- **What:** one shared kit with the wording table in `_shared/lib/branch-day-copy.ts`. Phone: a busy region with a status line ("Getting your department's past days"), empty ("No closed days yet. No closed days in this period."), error with Retry. Desktop: a skeleton that mirrors the page, "No open day at Nyeri Highway yet." on Today, filtered-empty lines on History.
- **Open it:** phone: `kitchen.member.town@wendo.test` › Past days (a member with no closed days). Desktop: `store.manager@wendo.test` › Branches › Day › Branch: a branch with no day. For loading, throttle the network in the browser tools. For error, stop the API and press Retry.

## 4. Wrong PIN, short PIN and refused writes (G3). Phone sign screens and every desktop drawer

- **What:** a wrong PIN clears the box, turns it red, says "That PIN is not right. Try again." under it (announced as an alert) and puts focus back in the box; the form is kept. Fewer than four digits keeps the button disabled. Any other refusal is a line above the button. In the Correct a count drawer a wrong PIN stays in the drawer; if the correction window has passed the drawer closes and the page reloads.
- **Open it:** phone: any department count › Check and sign › type 9999. Desktop: Branch Manager › Today › Close the day, or a closed day › Correct a count, with a wrong PIN.

## 5. The changed-figure marker on "Every figure" (G4). Phone

- **What:** on the list behind "See every figure", tapping a box edits it (the focused box with the number keypad); a figure changed since the screen opened carries a small amber ring. "Back to check and sign" returns with the new total.
- **Open it:** Day › Count › Check and sign › See every figure › change one figure.

## 6. "This branch has no department to count yet" (the 409 NO_DEPARTMENTS note). Phone

- **What:** a department added after today's day began has no day yet, so the server answers 409 `NO_DEPARTMENTS`. The phone says so plainly; Retry stays (tomorrow's first read creates the day). Also used when a branch has no active department at all.
- **Open it:** add a department in Departments after today's day started, give it a head, sign in as that head and open Day. (A Branch Manager's own Today is never affected: it creates the day.)

## 7. The delivery card on Day (G1, G2). Phone

- **What:** three variants: "Delivery confirmed · 8:48 am · nothing short" (or "N short, held for the Store Manager"); "Delivery not counted yet · DSP-NYR-0001 left the store and is waiting for your count" with a button "Count the delivery"; "No delivery today · Nothing has left the store for your department". The morning Day state has "Check the opening" as the active card.
- **Open it:** run the seed with `--state=open` and a `--block="Barista"` dispatch, then sign in as the Barista head for the waiting card. After the Barista delivery is confirmed it reads "Delivery confirmed".

## 8. Day sheet pages 2, 3 and 5, overflow and corrections (G17, G18, G19, G20). Desktop, printed

- **What:** only three of the six pages were drawn. Every other department page uses the same template; a long department continues on the next page with the heading row repeated and "Page N of M"; several corrections are listed on the cover with an asterisk on each corrected row; the old figure is struck through and the corrected one is in weight 600; a count made on behalf shows "Counted by the Branch Manager on behalf of the department" with the signature "Housekeeping, on behalf".
- **Open it:** `bm.town@wendo.test` › Branch › Day › History › open a closed day › Print the day sheet (a new tab; nothing is written). Kitchen's 130 items run to many pages. After a correction, Documents lists a second version and the sheet shows the strike.

## 9. Each other gap built, with where to open it

All are in the Branch Manager's Branch › Day unless a hub role is named; the hub roles open the same screens under Branches › Day.

Walked live in the integration session: G3, G5, G12, G14, G21, G22, G23, G24, G25, G33 and the hub read-only views. The rest (G6, G7 and G8, G9 results, G10, G11, G13, G15, G16, G27, G29 to G31) were checked in the build sessions and are described from their code and READMEs; look at those once by eye.

| Gap | What was built | Open it |
|---|---|---|
| G5 | "Close the day" stays disabled with `aria-describedby` pointing at the first red row | Today with a department not counted |
| G6 | Live updates: a count, a delivery confirmation or an opening updates the cards and red rows in place, announced in a status line | two browsers: sign a count as a head and watch Today |
| G7, G8 | Close pending, error and "Day closed" confirmation that stays on Today until you leave | Close the day |
| G9 | Top-bar "Search a day": results "DAY-NYR-0010 · Saturday 10 October · Closed", "No day matches."; Enter with nothing highlighted opens History | any Day screen, press ⌘K |
| G10 | "See every line" expands the receipt in place; "Hide the lines" collapses | Close the day drawer |
| G11, G32 | An open day's History row opens Today, not a file | History › an Open row |
| G12 | Sidebar badge on Today: the number of blockers; hidden at 0 | the sidebar |
| G13 | After tomorrow's opening is accepted, Correct a count disappears and the chip reads "Corrections are closed: tomorrow's opening has been accepted" | a closed day, the day after |
| G14 | "Change" in Correct a count: a searchable list of the day's items grouped by department; Escape closes only the list and focus returns to "Change item" | closed day › Correct a count › Change |
| G15 | "Other" makes the note required; the counter is 200 | Correct a count › Other |
| G16 | Activity pages with the kit pager (the screen asks the server for 100 and pages them) | day file › Activity |
| G21 | "Confirm for {department}" on the red delivery row (Branch Manager and System Admin) | Today with a delivery not confirmed |
| G22, G23 | "Count for {department}" on the red "has not counted" row, then the receipt and PIN in the same drawer, "Send for {department}" | Today with a department not counted |
| G24 | Hub Today: a Branch picker (the last branch used is kept in the address) | `store.manager@wendo.test` › Branches › Day |
| G25 | The Branch Manager's own Audit log row in the Branch group | `bm.town@wendo.test` sidebar |
| G27 | At 1024 and 768 the tables scroll inside their box; the department cards wrap 3 and 2, then one column | resize the window |
| G29, G30 | Sidebar rows for the Accountant, Store Manager and System Admin (the Director's were drawn); a head's and member's phone menu has Day (and Past days for a head) | each login |
| G31 | History filters: Status (All, Open, Closed, Corrected) and Branch (hub roles), date range, kept in the address | History |
| G33 | A member signs with their own name and PIN; "Signed by" shows the member's name and role | `kitchen.member.town@wendo.test` › Check and sign |

## Known limits

- **The Audit log shows the person's name only, no role.** The Branch day rows read "Faith Njeri (BM Nyeri Town)" with no role under the name. This needs a back-end change (the audit row carries a name, not a role).
- **"Stock ledger entry" has no page to open.** A correction's record in Activity is plain text: there is no screen for a single ledger entry yet.
- **"Delivery confirmed" has no time on the printed day sheet.** The contract's sheet carries the state only.
- **Activity is capped at 100 entries per day** (the screen pages them); a day with more needs a paged back end call.
- **Numeric pass against Paper:** the day file, History, Correct a count and the printed sheet were checked by eye against the spec's numbers, not with `get_computed_styles`. Paper had a different file open during integration, so the approved file could not be read. Today, a department's figures and the drawers were measured in the desktop build.
- **Two dev-data oddities, not product bugs:** the lane's stock has opening quantities below zero for some items (so Kitchen's Used value can be negative), and the dev seed now clears a re-pointed dispatch's count so the "delivery not confirmed" blocker can be cleared from the screen.
- **Department-head name on a member's Past days header:** a member sees the head's name under the title ("Kitchen · Kelvin Kings (Kitchen head, Town)"). Left as built; say if you want it hidden.
- **Accessible names:** the count boxes in the Count for a department drawer read "Cake box, 1 kg , in pcs" to a screen reader (a stray space before the comma). Harmless; not changed.
- **The enum-dropping contract migration is not part of this block.** It is a separate later session (see `block-1-release.md` §6c).
