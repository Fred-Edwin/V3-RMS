# UX walk, phase 3: Waste and Branch day

Walked 11 Oct 2026 on lane 5 (branch `feat/ux-phase-3`, Blocks 1 to 6). Phone at 390 wide for heads and members, desktop 1440 for the Branch Manager and the read-only roles. Every record was made through the screens. Paper was not re-opened for this walk; where a screen looks off it is noted, not measured. Console errors: none on any screen.

How to read it: **Size** S (a line or two of copy/CSS), M (one screen reworked), L (new flow). **Redraw** = needs a Paper redraw before building.

## Top 5

| # | Finding | Size | Redraw |
|---|---|---|---|
| 1 | **Wrong PIN on the phone shows no words.** The box clears and turns red, but "That PIN is not right. Try again." sits behind the sticky footer (message y 767 to 785, footer starts y 761). Desktop shows it fine. | S | no |
| 2 | **"No, I'll recount" ends in a wall of text.** The sign screen lists all 129 matching items as one paragraph; the one difference is below it. Kitchen opening, 130 items. | M | yes |
| 3 | **The Kitchen's 130-item count is one flat list.** About 14 screens of scrolling (list is 7,930 px in a 560 px window), no sections, no search, no jump. "Check and sign" stays off until the last box is filled, with no link to the blanks ("5 items still to count."). Sections only appear after counting, on the check screen. | M | yes |
| 4 | **Heads and members start on an unrelated page.** Sign-in lands on the old barista dashboard ("You're off today"). Waste or Day takes menu, then link: 2 taps before any work. | M | maybe |
| 5 | **Names and roles are not in the owner's format.** "Grace T." on every waste row and in the reversed sheet; "Signed by: Barista Member" or "Branch Manager" with no name on every sign screen; Activity shows role "Chef" for a Kitchen member. Test names with brackets add "Faith T." oddities, but the format is wrong in principle. | S | no |

**The rest: 29 more findings (numbers 6 to 34) in the table below.**

## Tap counts (from signed in, current vs proposed)

| Task | Now | Proposed | How |
|---|---|---|---|
| Member logs two waste items | 13 (menu, Waste, Log, then per item: result, digit, reason, Add; Review; Confirm) plus two searches typed | 11 | land on Waste for waste-only roles; "You often log" quick-picks cut the search once history exists |
| Member evening count, Barista 40 items | about 89 (menu, Day, Count; 40 boxes at one digit plus Next; Check and sign; 4 PIN; Send) | about 86 | land on Day (-2), fourth digit signs (-1). The real cost is typing, not taps |
| Kitchen member count, 130 items | about 269 | about 266 | same two savings; 130 boxes is the cost. Sections and a "next blank" jump cut scrolling, not taps |
| Head's morning opening | 4 (menu, Day, Check the opening, Yes) | 2 | land on Day; "Yes" on the Day card itself |
| Branch Manager closes the day, from Today, blockers clear | 7 (Close the day, tap the PIN box, 4 digits, Close the day) | 6 | PIN box focused when the drawer opens (-1). Keep the final button; a close is not undone |
| BM counts for a department | Count for, items, Check and sign, tap PIN box, 4 digits, Send | -1 | focus the PIN box on the sign step |
| Member reverses own waste | 3 (Reverse, reason, Reverse entry) | 3 | fine |
| BM reverses a waste entry | 3 from the row; 5 if opened in the drawer first (drawer has no Reverse) | 3 | add Reverse to the drawer |

I could not time a person. For the Kitchen count I measured the scroll length and the taps; the keypad is the phone's own number keyboard with Next (one tap per item) and works well. A draft was saved to the server and came back after a reload (125 of 130 items kept). It saves after a short delay, so a figure typed just before leaving is lost (finding 34).

## All findings

| # | Screen | What happens | Why it is friction | Suggested fix | Size | Redraw |
|---|---|---|---|---|---|---|
| 6 | Phone Waste, empty list | Two buttons: "Log waste" in the middle and "Log more waste" at the foot | Two ways to do one thing; "more" is wrong when there is nothing | Show only the foot button; in the empty state say "Log waste" there | S | no |
| 7 | Phone Log waste, first use | "YOU OFTEN LOG: No usual items yet. Search for the item." | Noise that helps nobody | Hide the heading until there are usual items | S | no |
| 8 | Phone Check and log (waste) | Header "2 items, nothing has moved yet" and a banner "Stock goes down only when you confirm. Nothing is deleted later; a wrong entry can be reversed." | Same message twice, and the second is long | Keep the header line; cut the banner to one short sentence or remove it | S | no |
| 9 | Phone Waste list after saving and after a reverse | Green banner "2 items logged at 23:06" stays after a reverse; "Milk reversed. The stock went back." is announced to screen readers only | Two contradicting messages; no visible feedback after a reverse (desktop has a toast) | Replace the banner with the latest result and show it visibly | S | no |
| 10 | Phone Waste, department list | The info box "Everyone in the department sees these entries. You can reverse only your own..." is shown to the head too, who can reverse nothing; box is narrower than the other boxes | Says what they cannot do; width jumps | Show to members only; full width | S | no |
| 11 | Phone Waste, sheet and rows | "Reversed by Grace T."; avatar initials "GT" in the header but "GN" in the menu | Wrong format, and two initials for one person (test names have brackets; real names will not, but the format is still wrong) | "Grace Njoki.Barista member" everywhere; one initials rule | S | no |
| 12 | Desktop Waste, reversed rows and KPIs | Value shows "0"; "KES 0, 0 entries" | Zero money should read "—" | Show "—" for zero money; keep "0 entries" | S | no |
| 13 | Desktop Waste, entry drawer | No Reverse button; the Reverse is a plain text link in the row | Open the drawer, close it, then find a link; text links look weak | Add Reverse to the drawer; make the row link a small button | S | no |
| 14 | Desktop Waste, reverse dialog | Choosing "Other, add a note" makes the dialog grow about 21 px; the status shows "Reversed 23:08 · other", not the note | The dialog jumps; the note the BM typed is not visible in the list | Reserve the note space; show the note (or a "note" marker) on the status and in the drawer | S | no |
| 15 | Desktop sidebar (Branch Manager) | "Audit log" appears twice, under Branch and under Procurement | Looks like two screens | Show once, under Branch | S | no |
| 16 | Desktop Dashboard (Branch Manager) | "Needs your action" says nothing pending; the open Branch day with blockers is only a badge on the sidebar | The most important daily job is not on the home page | Add the day state and its blockers to "Needs your action" | M | yes |
| 17 | Phone Day home (evening) | "Opening not checked" and "No delivery today" shown as open circles beside the one to-do; "Count sent" still lists "Opening not checked" greyed | Three look like to-dos; one is a dead end after noon | Use a dash for "not applicable"; hide the opening row once it cannot be done | S | no |
| 18 | Phone count list (Barista 40, Kitchen 130) | Every row repeats "Count in pcs" or "Count in kg" under the name | 130 repeats of one word | Put the unit beside the box ("pcs") | S | no |
| 19 | Phone Check and sign (Kitchen) | One category is named "Items" (items with no category) | Meaningless bucket name | Name it "No category" | S | no |
| 20 | Phone Check and sign | Fourth PIN digit enables the button but does not sign; "Sending" takes a few seconds | The owner's rule is that the fourth digit signs | Sign on the fourth digit, or say the button is the confirm and keep it | S | no |
| 21 | Phone Check and sign | The PIN box is half-covered by the sticky footer when focused | You cannot see what you typed | Scroll the box fully above the footer | S | no |
| 22 | Phone opening "Same as last night?" | "Yes, same as last night" commits at once: no PIN, no confirm, no undo, no visible toast (the Day card changes to "Opening checked 8:30 am") | The brief says "check and sign"; a one-tap commit is fast but unsigned | Owner decision: keep one tap (recommended, it is the lowest-risk path) and show a toast; or ask for the PIN | S | no |
| 23 | Phone opening recount (Kitchen) | "No, I'll recount" opens a blank 130-item count | Recount everything to fix one figure | Let the head tap only the items that differ on the same list | L | yes |
| 24 | Desktop Today | Each department counted adds another "Opening not checked: X" row ("5 more to know about"), plus an amber chip on each card | Noise grows with every count; none can be acted on (the morning has passed) | Show one line: "Openings not checked: 5 departments"; drop the chips after noon | S | no |
| 25 | Desktop Today | Five red "Count for X" rows when heads are simply late; no way to remind the head | The only fix offered is doing their count | Add "Remind" next to "Count for" (needs a notification: later list) | M | yes |
| 26 | Desktop Count for a department drawer | Boxes carry no unit (Baking powder: ?); the phone shows it | Risk of a wrong count (kg vs pcs) | Show the unit beside each box | S | no |
| 27 | Desktop Close the day drawer | PIN box is not focused (focus lands on the close icon); the preview list is clear and good | One extra tap; the Branch Manager must find the box | Focus the PIN box | S | no |
| 28 | Desktop Close the day drawer and Today | "Every delivery is confirmed: Five departments counted what arrived" when nothing was sent | Confirms something that did not happen | "No deliveries today" when none were sent | S | no |
| 29 | Desktop day file | "Openings checked, 0 of 5" has a green tick | A green tick on a 0 of 5 result | Amber, or no tick, when not all are done | S | no |
| 30 | Desktop day file and Activity | Used value "KES 443,598.54" in Activity but "443,599" elsewhere; minus sign "−2" in one table and "-160" in another; Activity role "Chef" for a Kitchen member | Three number and role styles | One rounding rule and one minus glyph; use department roles ("Kitchen member") | S | no |
| 31 | Desktop Correct a count | Opens on the first item (Aluminium foil), not the one you meant; typing 101234 for 10 showed a change of KES 8,098,240 with no warning; "Other" says note optional in the label | Easy to correct the wrong thing; no sanity check | Add "Correct" on each item row; warn when the change is large; keep the note required for "Other" | M | yes |
| 32 | Desktop hub Today (Director, Accountant, Store Manager, Admin) | Branch picker starts on Nyeri Highway (no day yet): "No open day at Nyeri Highway yet" | First screen is empty for the branch with the activity | Start on the last branch used, or on the first branch that has an open day | S | no |
| 33 | Desktop History | Saturday's closing value shows "0" not "—"; no search box (only date and status) | Zero money rule; table convention says search first | "—" for zero; add search | S | no |
| 34 | Phone count (both departments) | Draft is saved to the server after a short delay; a figure typed just before a reload is lost; nothing says "saved" | You cannot tell when it is safe to leave | Save on every figure (or on blur) and show "Saved" | S | no |

Read-only roles (Director, Accountant, Store Manager, System Admin): Waste and Branch day show the branch picker and no action buttons, as designed. Not walked: the Branch day state of a department with a waiting delivery was seen on Today but "Confirm for Barista" was opened, not completed; the member's Past days and the History day-file Documents tab were not opened (the Past days header name is the known item below).

## Two known items (report only, not built)

- **No flag when waste takes a department below zero.** Recommendation: show it in the Branch Manager's Waste entry drawer ("Barista is now at −8 L") and as a red row on Today before the close. The API already returns `wentNegative`, but only to roles that cannot log, so the drawer is the cheapest place. Size M, redraw yes, contract change for the drawer.
- **A member's Past days header shows the head's name** ("Kitchen · Kelvin Kings (Kitchen head, Town)"). Recommendation: show the department only. Size S, no redraw.

## Setup notes

- The lane database was not fresh (226 items, 11 suppliers). `seed-rehearsal-reference.ts` fails on a name clash ("Dairy & Eggs" vs the existing "Dairy & eggs"); the lane already had the reference data, so it was skipped. Fix the case in the script when convenient.
- To walk the morning opening I ran this lane's API with a clock set 15 hours back (a preload file in the session scratchpad, not in the repo), then restored the real clock. Nothing in the repo changed.
- Lane data I created or changed: the waste entries (both reversed), five department counts, one closed day with one correction on Aluminium foil (8 to 10), then the day was reset to "none" with the seed. PINs for all `@wendo.test` users are 1234 again.

## Fix status (12 Oct 2026)

Built and checked in the browser: findings 1, 3, 5, 6 to 19, 21, 24, 26 to 30, 32 to 34, plus the owner's additions (steppers, prefilled recount, differences first, the dashboard card, the Correct column and size warning, the landing on Day). Finding 22 already had its toast. Finding 25 (Remind) was not built (owner). Finding 20 (fourth digit signs) was built on the phone sign screens, and the recount list now has group headings. The Activity "Chef" role label (30, part) is a back-end label, left. Paper proposals: page "Inventory · UX walk phase 3 proposals (12 Oct)". Frontend 771 tests and backend inventory 3,667 tests pass.
