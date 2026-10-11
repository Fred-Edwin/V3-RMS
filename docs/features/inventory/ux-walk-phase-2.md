# UX walk, phase 2: Dispatch and deliveries

Walked 11 Oct 2026 on branch `feat/ux-phase-2` (Phase 1 merged in, `1a6b86b1`), lane 6. Phone roles at 390 px, desktop roles at 1440 px. Roles walked: Store Manager, Store Attendant, Kitchen head, Kitchen member, Barista head, Branch Manager. Real data was created through the screens (two requisitions, five dispatches, three discrepancies).

**Not walked in detail:** the Attendant's On the way and Done tabs, the member History screen, a separate Barista member login (same screens as the Kitchen member), Director, Accountant, Admin.
**Paper was not opened.** Anything marked "check Paper" needs a look at the design before it is changed.
**Console:** no errors, apart from the one 401 from the wrong PIN I entered on purpose.

## Top 5

1. **F1** The count confirm screen shows the sent figure before the PIN ("You counted 0.5, 1 were sent"). The reason sheet also says "marked short" or "extra". This breaks the rule that branch people never see the sent figure before signing. Check Paper first, then fix.
2. **F2** A requisition with one open shortage disappears from On the way and To confirm for the Branch Manager. The waiting alert for the other department never shows, and the queue has no Discrepancies tab.
3. **F3** Several differing lines on one delivery means one drawer, one cause and one PIN per line. The blame-bearing first cause is also already selected.
4. **F4** The Attendant needs 13 taps plus a 4-digit PIN to send two departments. An "all packed" page sits in between, there is no "pack as asked", the carrier is a dropdown, and the 4th digit does not sign.
5. **F5** People are not told what happened. Kitchen and Barista heads still read "Approved · With the Central Store" after the count. The Barista head is never told the Branch Manager counted for them. Member menus have no Deliveries badge. The Store Manager and Attendant land on the Item catalog.

The other 17 findings are in the table.

## Tap counts (menu to done)

| Task | Now | Proposed | How |
| --- | --- | --- | --- |
| Store Manager adds a carrier | 4 plus typing | 4 | fine as is |
| Attendant packs and sends 2 departments | 13 plus 4 digits (and 2 more the first time, for the carrier) | 6 plus 4 digits | land on To pack, "Pack as asked", skip the "all packed" page, pre-pick the only carrier, 4th digit signs |
| Member counts 3 lines, 1 gap, signs | about 9 plus typing, 4 digits (and 2 more with a photo) | 5 | land on Deliveries, recount inline, 4th digit signs |
| Branch Manager confirms for a department | 6 to 9 | 4 | drop the middle summary page, 4th digit signs |
| Store Manager records a finding (1 line) | 5 plus 4 digits | 4 | 4th digit signs |
| Store Manager settles 2 lines of one delivery | 10 plus 8 digits | 4 plus 4 digits | one drawer, one PIN |
| Store Manager cancels a dispatch | 6 to 7 | 4 | visible "Cancel this dispatch" link, 4th digit signs |

## Findings

| # | Screen | What happens | Why it is friction | Suggested fix | Size | Paper redraw |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Head and member confirm screen; reason sheet | Shows "You counted 0.5, 1 were sent" before the PIN. The sheet says "marked short" or "extra". | Breaks the "never see the sent figure before signing" rule. Direction hints at the figure. | Before signing, show only "counted X, differs". Reveal the figure after signing. Check Paper first, because it may be drawn this way. | S | yes (confirm screen) |
| F2 | Branch Manager queue | A requisition with any open shortage is filed under discrepancies. It is gone from On the way and To confirm. A Barista delivery 3 hours uncounted showed nowhere. The queue has no Discrepancies tab. | The waiting alert cannot show. The manager cannot find the requisition from the queue. | Tab logic in `requisitions-tabs.ts`: judge each department on its own, or show the requisition in both places. Add a small count to Discrepancies. | M | no |
| F3 | Store Manager Discrepancies | Each differing line is its own discrepancy. Two lines from one delivery means two drawers and two PINs. The first cause ("Packed short at the store") is already selected and blames the packer. | Slow, and it pre-blames a person. | Group by delivery with "Record findings for DSP-NYR-0004 (2 lines)": one drawer, a cause per line, one PIN. Leave the cause unselected. | L | yes |
| F4 | Attendant pack and send | 13 taps for 2 departments. "All packed" page sits before the final review. No tick-all. Carrier is a dropdown, even for one carrier (it is remembered after the first time). Packing order is by category, the member's count order is alphabetical. | Too many taps, and an extra page with one button. | "Pack as asked" per department. Go straight to the review after the last Done. Pre-pick a single carrier. | M | yes (small) |
| F5 | Head and member homes, menus | After the count, the Kitchen head still reads "Approved · With the Central Store". The Barista head is never told the Branch Manager counted for them. The shortage is not mentioned. Member menus have no Deliveries badge. Kitchen head and member land on the old "preparation queue / You're off today" dashboard. | People do not know what to do or what happened. | Section states on the home card ("Counted, 1 short, Store Manager looking", "Counted for you by Faith Njeri.Branch Manager"). Badge on Deliveries. Land on Deliveries when one is on the way. | M | yes (card states) |
| F6 | PIN fields (Attendant final review, member confirm, Branch Manager confirm on behalf, Store Manager finding, reverse, cancel) | One plain field plus a button. The 4th digit does not sign. Phase 1 sheets use four boxes and the 4th digit signs. | Inconsistent. One more tap each time. | Reuse the phase 1 four-box PIN. Keep the button only where a form has other fields. | S | no |
| F7 | Many places | Item names are cut to the first word and the verb ignores the plural: "the 0.5 arrow", "The 1 aluminium are held", "Count the arrow again", "1 extra match". | Wrong, and it looks careless in front of a manager. | Use the full item name and a plural-aware sentence. | S | no |
| F8 | Many places | "1 lines" in: dispatch list, final review left-out row, Branch Manager confirm summary, cancel dialog, dispatch header, "1 items approved" on the head home, "counted all 1 lines". | Grammar. Phase 1 fixed only some places. | One shared plural helper. | S | no |
| F9 | Branch Manager and Store Manager dispatch files | Zero money shows "0" or "KES 0". Other screens show "—". | Looks like the item is free. | Show "—". | S | no |
| F10 | Attendant final review and sent, member confirm, finding drawer | "Packed by", "Signed by" and "Recorded against" show only the role ("Store Attendant", "Kitchen Department Member"). | The owner's format is Name.Role. Note: seed users have the role in their name, so file lines read "Peter Mwangi (Store Attendant) · Store Attendant". Real data will read better. | Show "Peter Mwangi.Store Attendant" everywhere. | S | no |
| F11 | Dispatch files (Store Manager, Branch Manager) | "…" holds the Cancel action while the text says "You can cancel until then". On the Branch Manager file "…" holds only Print, and Print is itself a dropdown. | Hidden action, and a pointless menu. | A small visible "Cancel this dispatch" link under the next-step text. Remove the menu on the Branch Manager file. | S | yes (small) |
| F12 | Branch Manager confirm for a department | Count, "Check and confirm", a summary page, "Go to the PIN", PIN, Confirm. Also "The Barista head counted all 1 lines" when the Branch Manager did the count. | Extra step, and it names the wrong person. | Drop the summary page. Say "Faith Njeri.Branch Manager counted for the department". | M | no |
| F13 | Branch Manager dashboard | "Nothing pending right now" while a delivery is waiting and a shortage is open. No sidebar badge. This is phase 1's F2, still open. | No signal. | Add delivery waiting and shortage rows to "Needs your action" and a badge. | M | no |
| F14 | Landing pages | Store Manager and Attendant open on the Item catalog. | The first screen is not their work. | Attendant lands on To pack, Store Manager on the queue (rows in `nav-table.ts`). | S | no |
| F15 | Member reason sheet | One sheet per flagged line ("Line 1 of 2"). For an extra line the choices still include "Not in the box" and "Damaged". | Extra taps, and options that cannot apply. | One sheet for all flagged lines. Reasons that fit the direction. | M | yes |
| F16 | Member Deliveries, Earlier today | The badge says a green "Counted" even when a line was short. | Hides the problem. | "Counted · 1 short". | S | no |
| F17 | Store Manager sidebar | The badge sits on Queue and counts the empty seed requisition. Discrepancies shows no count while 3 are open. | The count is on the wrong link. | Badge on Discrepancies. | S | no |
| F18 | Branch Manager requisition file | The Kitchen panel shows Sent but not what Kitchen counted. The header badge says "Packing and sending" when everything has left. | Cannot see the gap on the file. | Add Counted and Gap columns. Badge: "On the way". | S | no |
| F19 | Header avatars | Same person, different initials: "JM" and "PA"; "JK" and "JT". | Looks like a bug. | One source for initials. | S | no |
| F20 | Attendant sent screen, delivery note | During signing the screen shows "0 lines" and "Leave at least one department in" for a few seconds before it moves on. The note page on a phone is cut off at the right (it is A4). The print button opened the page twice in my test (this may be my test stub, unconfirmed). | Two contradicting messages, and no progress shown. | Show "Signing…" only. Check the double open in a real browser. | S | no |
| F21 | Store Manager finding and cancel drawers | Option text: "A loss: no, a packing error on its own report line". "The store recorded 1 but sent 0.5" is wrong (the store sent 1, the branch counted 0.5). | Confusing wording. | Rewrite the cause descriptions. | S | no |
| F22 | Extra requisition (phase 1 area) | Branch Manager sees "Pastry, Service and Housekeeping haven't sent yet" for an Extra. | Nobody was asked to send. | Note only. | S | no |

## Fixed (11 Oct 2026, not committed)

Owner decisions: F1 dropped (the confirm screen shows the sent figure on purpose); F4 Option A only; F2 rule changed (what is still moving wins; a gap files under Discrepancies only when nothing else is moving).

- **Built:** F2 (tab order in `requisitions-tabs.ts`), F4A ("Pack as asked", single carrier pre-selected, 4th digit signs), F6 (4th digit signs on every PIN sheet, including confirm on behalf), F7, F8, F9, F10, F12 (confirm on behalf is count, check, PIN; the "counted by" sentence), F13 (Branch Manager dashboard rows plus sidebar badges; `discrepancies` added to the existing `/requisitions/badges` answer, no new endpoint), F14, F16 ("Counted · N lines differ" on Earlier today), F17 (Store Manager badge sits on Discrepancies, not Queue), F18 (Counted and Gap columns; badge "On the way" once every department has left), F19 (one `lib/initials.ts`), F20 (only "Signing…" while signing), F21 (cause wording), delivery note signature block and print colours.
- **Built from the approved Paper Chapter 14 (11 Oct):** F3 (one drawer per delivery, no cause preselected, one PIN, on the Discrepancies list and the dispatch file), F5 (section states on the head's home card, Deliveries badge, landing on Deliveries once per sign-in), F11 (visible "Cancel this dispatch" link, one Print button that opens the store and branch copies), F15 (one reason sheet for all flagged lines, reasons that fit the direction).
- **Checked in a browser:** Store Manager Discrepancies badge and grouped drawer, Branch Manager dashboard rows and badges, head home "Counted for you". **Not checked:** the delivery note on a phone, whether Print opens the page twice, print colours, the member Deliveries badge, the landing redirect, and the count flow with the one-sheet reasons.
- **Found in the owner's walk (11 Oct), fixed:** a requisition sent without some departments still counted and listed all five (rail, "1 of 5 in", "5 departments"). Skipped departments are now left out of every count and list (`sectionsInPlay`). The first click on Requisitions after a dev-server restart looked dead because the page was still compiling (dev only).
- **Test data:** the lane-6 Phase 2 data was cleared before the walk and rebuilt through the screens.
- **Earlier test data changed:** DSC-NYR-0003 was reversed through the screen (PIN 1234) so DSP-NYR-0004 has two open lines; both are still open.

## What worked well

- The To pack screen (waiting time, "Start here"), the pack screen (progress bar, nothing jumps), the quantity sheet (cannot send more than asked), the wrong-PIN message, the "Where it is" trail, the done screens, "Keep the finding" as the safe choice in risky dialogs, and "What this does" previews.
- The Attendant and the members never see money anywhere I looked.
- The blind count is blind until the confirm screen (see F1).

## What I added or changed in lane 6

- **Setup (before the walk):** two department members, and one PIN hash for all `@wendo.test` users. The reference seed failed on a category clash and was skipped, because the DB already had 226 items.
- **Carrier:** "Wendo van KCB 214K" (Vehicle).
- **Requisitions:** REQ-NYR-0002 (Afternoon, Kitchen 3 lines, Barista 1) and REQ-NYR-0003 (Extra, Kitchen 3, Barista 1), both approved. REQ-NYR-0001 (empty seed) untouched.
- **Dispatches:** DSP-NYR-0002 (Kitchen, counted, 1 shortage), 0003 (Barista, confirmed by the Branch Manager on behalf), 0004 (Kitchen, counted, 2 differences), 0005 (Barista, cancelled, line back in To pack).
- **Direct SQL on a record I created:** DSP-NYR-0003 `signed_at` moved back 3 hours, to test the waiting state. Its timeline now shows the "On the way" time earlier than the "Packed and signed" time.
- **Discrepancies:** DSC-NYR-0001 recorded then reversed (open again), DSC-NYR-0002 open, DSC-NYR-0003 settled ("branch counted wrong").
- **Browser:** the lane's old Chrome held the profile after a login change, so I closed it. Open logins were lost, no data.
