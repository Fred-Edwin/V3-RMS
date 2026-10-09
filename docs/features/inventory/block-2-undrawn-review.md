# Block 2: what was built beyond Paper

For the owner. Written 9 Oct 2026 by the integration session (branch `feat/dispatch-integration`). Paper is direction; where it did not draw a button, state or screen, the session built it in the same style rather than leave it out. Each piece below says who sees it and the exact steps to open it, so you can approve it or ask for a change. Logins are the lane test users (password `password123`, PIN `1234`); on production use the real ones.

Wherever Paper and this list disagree, Paper wins.

## 1. One "Record a finding" link per differing line (Store Manager, desktop)

- **What:** when a delivery's count differs on more than one line, the dispatch file shows one card titled "N lines differ: record what happened to each". The card's button opens the oldest open finding. Each differing row in the table also has its own "Record a finding" link and shows its DSC- number. Paper drew the single-gap case only.
- **Who:** Store Manager (can record); Director, Accountant, System Admin see the card read only.
- **Open it:** sign in as `store.manager@wendo.test`. Requisitions › Discrepancies, open a delivery that has two or more gaps (or open its DSP- file from Requisitions › Dispatch). The card is under the title; the per-row links are in the lines table.

## 2. Compact banners on the Attendant's sent screen and the confirmed screen (phone)

- **What:** "2 of 3 departments sent" and the "Opened as DSC-…" notice use a tighter banner (less padding, no dot) than the success banner above them, to match Paper's measurements for those two.
- **Who:** Store Attendant (sent screen); department head or member (confirmed screen).
- **Open it:** Attendant › Dispatch › To pack, pack two departments, leave a third out, sign: the sent screen shows it. For the confirmed screen, count a delivery with a gap as a department head and confirm.

## 3. A second count of a flagged line is final (department head or member, phone)

- **What:** when a line differs, the screen flags it once and asks for a recheck; the second entry is final and goes through with its reason. Two people on the same department's delivery share one draft, so a member can start and the head can finish; whoever signs is recorded.
- **Open it:** sign in as `kitchen.head.town@wendo.test` (or `barista.member1.town@wendo.test`), Deliveries, open a waiting delivery, enter a quantity that differs, then enter it again.

## 4. Members have no "Count tonight" or "Waste" links (department member, phone)

- **What:** a department head's menu has Count tonight and Waste, which are links to the older pages. A member's menu shows only Deliveries and History (as Paper's phone-menus-by-role page draws). Those older pages refuse a member at the API, so a link would only lead to an error.
- **Decision for you:** if members should be able to count and record waste, that is a permission change (back end plus the menu), not a screen change.
- **Open it:** sign in as `barista.member1.town@wendo.test`, open the menu.

## 5. The Attendant sees the requisition number as plain text (phone)

- **What:** on the Attendant's cards the `REQ-` number is text, not a link, because the Attendant has no access to the requisition file (which holds money and the branch's own notes). Dispatch numbers (`DSP-`) are links to the dispatch file.
- **Open it:** `store.attendant@wendo.test`, Dispatch › On the way.

## 6. "Not numbered yet" for a department still to pack (Attendant, phone)

- **What:** a department left out of a partial send has no `DSP-` number yet, so its row on the sent screen reads "Not numbered yet" with "Still to pack" on the right. It gets its number when it is packed and sent.
- **Open it:** Attendant › Dispatch › To pack › a requisition with three departments › pack two, tick the third as left out at the final review, sign.

## 7. A 46px carrier select with a "Choose a carrier" first option (Attendant, phone)

- **What:** the carrier field on the final review is a native select 46px high ("Choose who carries it" as the first option) so a thumb can hit it. Retired carriers are not offered. Signing without a carrier is refused with a plain message.
- **Open it:** Attendant › Dispatch › To pack › pack every department › Review all.

## 8. Tab precedence when one requisition is in two states (Attendant and department heads)

- **What:** a requisition can be partly sent (one department on the way) and partly still to pack. It appears under the tab that needs action first (To pack for the Attendant), and appears under On the way too only through the dispatches that left. Paper drew one state per requisition.
- **Open it:** after step 6 above, look at Dispatch › To pack and On the way: the requisition is in both, with different departments.

## 9. No sidebar badge on Discrepancies

- **What:** the Requisitions row carries the count; the Discrepancies sub-link does not carry its own badge (Paper draws none there). Open ones show as a tab count on the Discrepancies screen.
- **Open it:** `store.manager@wendo.test`, sidebar › Requisitions.

## 10. The Branch Manager's read-only Carriers row (Branch Manager, desktop)

- **What:** the Branch Manager has a Carriers link under Manage that lists who carries the branch's deliveries, with no add, retire or restore buttons. Paper drew Carriers for the Store Manager only.
- **Open it:** `bm.town@wendo.test`, sidebar › Manage › Carriers.

## 11. Write errors in plain words, and the offline message (every write)

- **What:** each PIN-signed write (sign a dispatch, confirm a delivery, reverse, record a finding, cancel) shows a plain sentence under the PIN for a wrong PIN, and a separate sentence when the request cannot reach the server ("No connection. Your counts are kept; try again when you are back online." on the count side, "Your ticks are kept" on the pack side). A repeated tap or a retry after a lost reply does not double-post (each write carries a one-time key).
- **Open it:** on any confirm screen, enter a wrong PIN (`0000`); turn the network off in the browser tools and press Confirm.

## 12. Printed delivery notes (Attendant, and Branch Manager for their copy)

- **What:** one note per department. A long note runs onto a second page with "continued" and "lines X to Y". No money on any note. The branch copy shows the sent figure only after the count is signed.
- **Open it:** Attendant › Dispatch › On the way › Print the delivery note(s). Or open a DSP- file and press Print (Store Manager; Branch Manager from `/app/branch/requisitions/dispatch/:id`).

## 13. Reverse a finding (Store Manager)

- **What:** a recorded finding can be reversed with a reason preset and a PIN. Both entries stay on the file and in the audit log, and the missing items are held as unaccounted again. Paper drew the dialog; the file wording after a reversal ("The earlier finding was reversed at … both entries stay on file") is built.
- **Open it:** `store.manager@wendo.test` › Requisitions › Discrepancies › a recorded one › Reverse this finding.

## 14. Where Paper disagrees with itself (for you to decide)

- **Final review, chapter 5 (D5) against chapter 10.** Same screen, two sizes: D5 draws the "You are sending" label at 11/14 and the count at 30/36 with department names at 15/500; chapter 10 (the leave-out screens, drawn later) draws 10/12, 28/34 and 14/400, and a 40 px carrier select (the build has 46 px so a thumb can hit it). The build follows D5. If chapter 10 is the newer truth, it is a size change on one screen.
- **Phone pager.** Paper draws the page buttons 32 px square (G2, G3). The shared pager had 44 px touch targets; the Block 2 lists now use Paper's 32 px.
- **Header place line.** G3 says "WENDO RMS · HUB", N2b and the rest say "CENTRAL STORE". The build says "CENTRAL STORE".

## 15. Loading, empty and error states on every list and file

- **What:** a spinner-free skeleton while loading, a short sentence when a list is empty, and "Could not load …" with a Retry button when a request fails (one shared kit, not one per screen). Copy is in `_shared/lib/block2-words.ts`.
- **Open it:** stop the API container and open any Block 2 screen; start it and press Retry.
