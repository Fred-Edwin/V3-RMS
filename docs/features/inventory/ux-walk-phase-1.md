# UX walk, phase 1: Requisitions (head to Branch Manager)

Walked 11 Oct 2026 on branch `feat/block6-contract`, lane 4. Kitchen head on a 390 px phone, Branch Manager on a 1440 px desktop. Full path done: start, add item, send with PIN, manager sees it, approve and sign, head sees "Approved". No console errors. No Paper comparison needed; no layout looked off.

## Top 5

1. **F1** Branch Manager lands on "To approve (0)" while a sent list waits under "Collecting".
2. **F2** Dashboard "Needs your action" says nothing pending, and the sidebar has no badge.
3. **F3** "Send without this section" is hidden in a caret menu. It skips every missing department in one tap, with no confirmation, then the page says "all 5 sections in".
4. **F4** After sending, the head's home still says "Already started … Collecting" and never shows "waiting for the Branch Manager".
5. **F5** Empty list needs two taps (Change lines, then + Add an item) before any item can be added.

## Findings

| # | Screen | What happens | Why it is friction | Suggested fix | Size |
|---|---|---|---|---|---|
| F1 | BM Queue | Opens on To approve (0). The kitchen list sits in Collecting (2). | The manager sees "nothing waiting" and does not find the list. | Open on Collecting when To approve is empty and Collecting has a sent section. | S |
| F2 | BM Dashboard, sidebar | "Nothing pending right now" and no badge on Requisitions, though a section was sent. | The spec promises a badge. The manager has no signal. | Add a requisition row to "Needs your action" and a count badge (reuses the existing list endpoint). | M |
| F3 | BM requisition, Collecting | Main button is "Nudge Barista". The text says "approve once Barista is in, or send without", but that option is in the caret menu. One tap skips four departments with no confirm. Header then reads "all 5 sections in". | The usual goal is hidden, and the action is silent and misleading. | Show "Approve with Kitchen only" as a second visible button. Confirm sheet lists skipped departments. Header says "1 of 5 sections, 4 skipped". | M |
| F4 | Head home (phone) | After sending, the card reads "Already started. REQ-NYR-0003 · Collecting" with "Open afternoon". | Nothing says the list was sent or who it waits for. | Show the section state: "Sent 3:20 pm, waiting for the Branch Manager". | S |
| F5 | Head, empty list | "Change lines" opens a page whose only action is "+ Add an item". | Two taps to start. The label does not say "add". | Empty state gets a direct "Add an item" button. Rename the link "Edit list". | S |
| F6 | Head, history and home | Sent list shows the badge "Collecting". Stale empty Morning (0 lines) stays under "Earlier today". | The badge is the whole requisition's state, not the head's. | Show the head's own section state. Hide empty, unsent requisitions after the cycle ends. | S |
| F7 | Phone and desktop, many places | "1 lines", "1 changed" for a new item. | Wrong wording. | Singular and plural fix everywhere. | S |
| F8 | Send sheet (phone) | Lists the category and item name, not the quantity (12). "1 change" for a new item. | The head cannot check the quantity before signing. | Show "Gloves × 12". Say "1 new" for added lines. | S |
| F9 | BM requisition, approve drawer | Values show KES 0 for items with no price. | Looks like the item is free. | Show "No price yet" or a dash. | S |
| F10 | Add an item (phone) | "Kitchen items only" includes cleaning, packaging, "S4 Test …" items. Few show on hand. No quick filter. | Long scroll (about 100 items) to find an item. Test data in the demo. | Category chips under search. Remove test items from the demo seed. | M |
| F11 | Approved requisition (BM) | Approved quantity still looks like an editable box. The only next-step button is "Print". | Unclear whether it can still be edited. | Make it plain text once approved. | S |
| F12 | Head menu | "History" under Department has no label saying what it covers. Dashboard has no shortcut to Requisitions. | Floor staff must open the menu. | Rename to "Requisition history". Add a dashboard card (needs a nav-table change). | S |
| F13 | Phone vs desktop PIN | Phone uses four boxes; desktop uses one field. | Inconsistent. | Use the four-box PIN on both. | S |
| F14 | Sidebar (BM) | "Audit log" appears twice, under Branch and Procurement. | Duplicate link. | Remove one. | S |
| F15 | BM Collecting list | "1 of 5 in. Waiting for Barista." | Checked: Pastry, Service and Housekeeping do have tagged items (23, 26, 13), so they are real waits. **Not a bug.** | None. | n/a |

## Fixed on 11 Oct 2026 (owner approved the flow; no new endpoint, no migration)

The head's three screens became one working screen (the owner's "3 taps instead of 8"):

- **Head, one screen (F5 and the larger flow):** the Requisitions link opens the list directly. The cycle follows the time of day, with a Morning, Afternoon, Extra switcher on top. A cycle with no requisition is started quietly. The list is pre-filled from restock levels, with on hand and level on each row. Search is at the top. "Other items" opens below with + Add. A sticky "Send N items" signs and sends. Extra keeps a small start card (urgent switch). The old Change lines and Add an item screens only forward.
- **After sending (F4, F6, F8):** the same screen becomes a status view. Banner first, then the items with their quantities (and "you asked 20, approved 14" where the manager changed one), then Where it is. History and Earlier today show "Sent, waiting for approval" instead of "Collecting". The send sheet shows "Eggs × 1".
- **Manager (F1, F3):** the queue opens on Collecting when To approve is empty. "Approve with Kitchen only" is a visible button with a confirm line ("Send without Barista, Pastry…?"). After it, the header says "1 of 5 sections in, 4 sent without".
- **Small (F7, F9, F14):** "1 line" grammar, a dash instead of "KES 0" for unpriced items, one Audit log link for the Branch Manager.
- **Data:** restock levels set on 42 Kitchen and 13 Barista items in the lane 4 database (local only).

## Round two: owner walk and Paper comparison (11 Oct 2026, commits d20fbfda to 4f2bec6c)

Paper was redrawn first (Chapter 13 for the head, Chapter 2 for the manager), approved, then built. Where the built screen differed from Paper it was changed to match.

- **Head home (Paper 1, 2, 8, 9):** a Morning, Afternoon, Extra switcher (a dot and one word of state each) and one dark card. The card carries the cycle and the time, the state at the top right, the greeting, the big number ("11 items sent at 5:22 pm", "12 items are running low", "3 items on your list"), one button and the requisition number. "Need something extra?" for an Extra not started. A "Branch Manager changed N lines" notice. Earlier rows with "N items" and the status. The header reads "Kitchen · Sunday 11 October".
- **Head working screen and send sheet:** the header reads "REQ… · started 4:17 pm", the footer says "Saved", the switcher has no dot. The send sheet no longer squashes its list when "See every line" opens, and has no note box (as drawn). An empty list no longer shows two contradicting hints. Group headings align with their rows on the status view.
- **Manager list:** Collecting rows have no button; the row opens the requisition. "Start a requisition" is gone. The row button says "Approve". The "Waiting for…" line names every department that has not sent.
- **Manager file:** Print is a visible header button (once, not repeated on the Next step card). "Nudge" tells every department that has not sent, and the Next step names them all. "Approve with {names} only" and "Fill {department} in myself" are visible; the ▾ menu is gone. The approved quantity is a plain number until clicked, then an inline reason strip (Enter saves, a reason is required after approval). Items and Activity tabs no longer show counts.
- **Approve drawer:** the fourth PIN digit signs ("Your PIN · signs on the 4th digit"), "sent without" no longer wraps, and the banner after signing names who was told.
- **Print:** the signature and the line below show the plain name ("Faith Njeri · Branch Manager Nyeri Town").
- **A real bug found and fixed:** the reason dropdown in the Cancel dialog (and every select inside a dialog) opened underneath the dialog overlay and could not be clicked. The select list now sits above dialogs (`components/ui2/select.tsx`).
- **Walked in a browser with real users:** head start, add, send with PIN, recall and resend, add to an approved requisition (PIN) and the manager approving the addition, a quantity change after approval, approve with only, sign, cancel, Print, Documents, Activity, the Director's list. Not exercised: urgent set and clear, the Discrepancies and History lists with data, and the hub's To approve with a real row.

## Found, needs a back-end change

- **Extra starts with all five departments.** An Extra started by the Kitchen head lists Kitchen, Barista, Pastry, Service and Housekeeping, so the manager sees "Nudge the 5 that have not sent". Paper draws an Extra as one department ("Extra · Service only"). The Extra should create only the starter's section.
- **Activity is noisy.** Every autosave of a draft writes "Changed Barista's list · N lines". It should record the send, not each save.
- **Home data:** the draft card cannot show "started 4:03 pm" for a requisition other than the open one, and the "Needs you" strip has no data.
- **Names:** test users carry brackets ("Faith Njeri (BM Nyeri Town)", "Kelvin Kings (Kitchen head, Town)"); the tracker shows them. Real names will not.

## Left for later

- **F2** dashboard "Needs your action" row and the sidebar badge for the Branch Manager. The badge counts only To approve, so a partly sent requisition never raises it. Needs a back-end change to the badge count (M).
- **F10** category chips on the Other items list; remove "S4 Test" items from the demo data.
- **F11** the approved quantity box stays editable after approval on purpose (the spec lets the Branch Manager adjust until packing). It could carry a small "Editable until packed" hint.
- **F12** a Requisitions shortcut on the head's dashboard (a nav-table change).
- **F13** four-box PIN on the desktop approve drawer.
- **Names:** the status banner says "the Branch Manager", not their name, because the phone rules say titles, not names.
