# Stock, Counting and Waste: what each screen needs and what the back end provides

Written 8 Oct 2026 by the orchestrator (Stage 2), from a screen-by-screen review of the Paper page "Inventory · Counting redesign (Oct 7)" (file `01M3TP8J54R83RHC9FJ7RAHGKG`, page `p-G-0`): steps 1 to 29, 24B, 24C, 40 to 51 and the Screens index (chapter 10). Steps 30 to 39 were dropped (the Attendant keeps the phone screens at every width, as a centred column inside the same shell). The endpoint numbers (`C1`…, `S1`…, `W1`…) are the ones frozen in `stock-count-waste-contract.md`. Roles: AT Store Attendant, SM Store Manager, SA System Admin, DIR Director, ACC Accountant, BM Branch Manager. "Desktop roles" = SM, SA, DIR, ACC, BM.

**Reading rule for every row:** a desktop role reads every screen; a write control is drawn only when the server's `can` flag (or `GET /inventory/permissions/me`) says the person may use it, and is hidden otherwise. The Attendant never receives a stock figure (expected stock, on-hand, difference, variance value, restock level) from any endpoint.

## 1. The Attendant's phone count (Chapter 1, steps 1 to 7; Chapter 7, steps 40 and 41)

| Step | Screen | Needs from the back end | Actions | Endpoint |
|---|---|---|---|---|
| 1 | Pick a section | Today's sections in the order for today (Manager's shelf order, or this person's own order for today), item count, "last counted" as a date, "Yesterday / 6 days ago" text; whether this person already has an open count; "Find an item to count" search across sections | Open a section (starts or resumes a count), "Review and sign" (disabled until something is counted), "Log waste", "Reorder" link (design default, see 8) | C8, C9 |
| 2 | Count the shelf | One count's lines for the picked section(s), in order: item, unit, the number typed, skipped flag, check mark. Progress "12 of 37 counted · 1 skipped", "Saved 07:19". No expected, ever | Type a number, **Next** (saves and moves on), **Skip** (empty box), **0** (a real zero), find an item | C5, C10 |
| 3 | Section done, check items again | When the person finishes a section: the items that exceed the Manager's range, **by name and the number she typed only** (no figure, no direction) | Recount 2 items, Continue as counted (after one recheck nobody asks again) | C11, C10 |
| 4 | Recount, once | The same items one at a time, tagged RECOUNT, with "Up next" | Type a number, **Keep** (key shows the figure she first typed) | C10 |
| 5 | Review before signing | All counted lines with tabs All / Skipped / Zero / Rechecked and their counts; each number can be changed | Tap a number to change it, **Sign and submit** | C5, C10, C12 |
| 6 | Sign with PIN | Summary "37 items · 4 zero · 1 skipped" | Four-box PIN; wrong PIN shakes and nothing is written | C13 |
| 7 | Submitted | Reference CNT-…, "Counted Samrat · 36 of 37", counted-between times, tracker Counted → Submitted → Checked → Approved | **Count another section**, Log waste | C5 |
| 40 | Reorder sections for today | The sections with drag handles, "for today only" | Drag, Done (saves this person's order for today; tomorrow it is the Manager's again) | C14 |
| 41 | Move an item to another section | Section list with "current section" | Pick a section; moves at once, is logged, the Manager sees it in Count setup and can undo | C21 |

Needs from the server that the old code did not have: sections, per-day order, items-in-sections, many counts a day, a section "busy" rule, a rechecked flag per line, a skipped flag per line, an item move log.

## 2. The Manager reviews (Chapter 2, steps 8 to 11) and the signed record (Chapter 9, 47, 48)

| Step | Screen | Needs | Actions | Endpoint |
|---|---|---|---|---|
| 8, 48 | Counts, desktop | KPI strip (Waiting for you / In progress / Exceeded the range 7 days / Longest without a count), chips All / Waiting for you / In progress / Approved plus "Unsectioned 3 →", table (Reference, Sections, Counted by, Signed, Items, Differences "4 exceed · 32 within", Status), "Recount of CNT-…" link, search, numbered pager, rows per page | **Review** (SM, SA, on a count waiting), Start count, Count setup, Log waste, search an item (design default: opens the item's stock card) | C1, C2 |
| 9 | Review a count | Header (sections, counter, signed time), KPI strip (Counted / Within range / Exceeds · needs a decision / Not counted / Net difference), tabs Needs a decision / Within range / Not counted / All, per line: item, section, unit, expected, counted, difference and percent, value, **what the records show** (a sentence about prep use, dispatch, last count), Decision cell; "32 within range · net −KES 193" group with **Accept all 32**; "Not counted" banner; "0 of 4 decided" footer with **Approve and sign** (disabled until every outside-range line is decided); "Change range" link opens Count settings | Decide a line, Accept all within range, bulk-select lines, Approve and sign | C5, C27, C28 |
| 10 | Decide a line | The line with cause chips: Prep use not logged (SUGGESTED), Spoilage or spill, Miscount, Loss or theft, Other (add a note); links "Log a missing movement instead" and "Ask for a recount"; "Several lines can take one cause" | One tap decides; Change later until signing | C27 |
| 11 | Approve and sign | Dialog: every adjustment (item · cause · KES), "32 within range · accepted together", net difference, "Director is not alerted / is alerted", "Brown sugar was not counted, so nothing is written", PIN | Approve and sign (PIN), Cancel | C28, C29 |
| 47 | An approved count, Count again | Same layout, read only: decisions as words ("Written off as Spoilage, approved 16:25"), the footer says "A signed count is never edited. Count again starts a new count that links back to this one" | **Count again** on an exceeds line (SM, SA) → step 49. No checkbox column on a signed count (design default) | C5 |
| 15 | Count signed (the Manager's own) | KPI strip (Applied to stock · Flagged to the Director · Not counted), flagged lines with cause and "Not seen yet", timeline (Counted, Signed with your PIN, N lines applied ADJ-3410 to ADJ-3446, Director told about 3 lines), who can read it | Print record, Start count | C5 |

Needs from the server: the "what the records show" story per line (prep use, dispatch, last count, delivery) and the suggested cause; per-line `can`; expected stock frozen at the counter's sign time; within-range judgement against the range in force at that time (frozen on the count); a derived "short three counts running" flag.

## 3. The Manager counts (Chapter 3, steps 12 to 15; Chapter 9, step 49)

| Step | Screen | Needs | Actions | Endpoint |
|---|---|---|---|---|
| 12 | Start a count | Sections with checkboxes, items, "Longest since a count" tag, last counted and by whom, a side panel "Your count: 41 items · Others · 1 section", "Select all 4 sections", "Reorder sections" link | Pick sections, **Start counting**, Cancel. The Attendant never sees this page (they use step 1) | C8, C9 |
| 49 | Start a count, item picked | Recount banner "Recount of CNT-2026-1012 · Eggs" with link, the picked item chip, "+ Add another item", whole sections below | Start counting (a count scoped to items, linked to the old line) | C8 (`?recountLineId=`), C9 |
| 13 | Counting with expected stock | Same lines as step 2 plus **expected**, **difference**, **value** and a live result chip per line (Matches / Within range / Exceeds the range / Over 5% so it will exceed / Not counted / "Rechecked, same count" / Recount link), progress, "Saved 11:20" | Type, Enter saves and moves on, Tab skips, Recount a line, **Review and sign** | C5, C10 |
| 14 | Sign your count | Dialog: "Applied when you sign · needs no approval: 37 lines within the range −KES 120", "Outside the range · flagged to the Director · 3 lines" each with its cause, "The Director sees these lines with your causes", net, PIN. The cause chips are not drawn here (design gap, see 8) | Sign and apply | C12, C13 |

## 4. Waste (Chapter 4, steps 16 to 23)

| Step | Screen | Needs | Actions | Endpoint |
|---|---|---|---|---|
| 16 | Pick what was wasted (phone) | "You often log" items (this person's most logged), search, "Added · 1" list | Tap an item, Review N items | W1 |
| 17 | How much, and why (phone sheet) | Item, unit, quantity box with number pad, reason chips Expired / Spoiled / Damaged in store / Prep error | Add | local until W2 |
| 18 | Check, then confirm (phone) | The added list with Edit, optional note, "Stock goes down only when you confirm" | Confirm and log waste, Back to edit | W2 |
| 19 | My waste today (phone) | Own entries today, time, qty, reason, **Reverse** on each own entry of today, reversed entry struck through with "Reversed 09:12". The Attendant sees no value on the drawn phone screens (item cost is allowed by the owner rule but not drawn: see 8) | Reverse, Log more waste | W3 (`scope=mine`) |
| 20 | Reverse a wrong entry (phone sheet) | Entry summary, reason radio (Logged the wrong item / Wrong quantity / Other), "The 2 kg goes back into stock" | Reverse entry, Keep it | W4 |
| 21 | Waste, desktop | KPI strip (Today KES, Last 7 days, Most wasted, Reversed 7 days), chips Today 4 / Last 7 days 21 / Reversed 2, table (Time, Item, Qty, Reason, Logged by, Value, Status), numbered pager | Log waste, Reverse (SM, SA any entry; AT own same day) | W3 |
| 22 | Log waste drawer (desktop) | Item search, per-line qty with unit, reason chips, value per line, total waste value, note, info "valued at today's cost" | Log N items | W1, W2 |
| 23 | Reverse any entry (dialog) | Entry, logged by and time, value, "Stock goes up by 2 kg. The waste total drops by KES 360", reason chips (required) | Reverse entry. **No PIN** (owner, 8 Oct 2026; the index and state copy said PIN, the drawn dialog has none) | W4 |

The Attendant's waste flow covers everything required: **log** (16, 17), **check before it is logged** (18), **my waste today** (19), **reverse own, same day** (20). Nothing is missing. Not drawn, so not built: an Attendant waste screen with values (see 8).

## 5. Count setup, settings and the Director (Chapter 5, steps 24 to 26; Chapter 8, 45 and 46; Chapter 9, 50 and 51)

| Step | Screen | Needs | Actions | Endpoint |
|---|---|---|---|---|
| 24 | Count setup | Sections in shelf order (name, item count, "manual section" or supplier), "Not in any section · 3 new items", "+ Add a section"; the selected section's items on one scrollable list (no pager, owner rule §4a.5): item, unit, last counted (date; "6 days ago" in amber), "Section" move menu, "Moved here from Summer by Linnet · 13 Oct 07:12 · Undo move"; footer "1 item moved by the Attendant since your last visit"; top bar Print blank sheet, Count settings, "Unsectioned 3" | Drag sections, drag items, move to another section, undo a move, add a section, Save order | C15, C16, C17, C18, C22 |
| 24B, 24C, 50, 51 | Add items to a section (drawer) | Search as you type with bold matches ("3 matches for 'oat'"), Category / Type / Department filters, tabs "Not in any section 3" and "In other sections 138", rows with category · type · unit and "New, no supplier" or "In Summer · moves here", clear (×), no-matches message with "Clear search", "Showing 1–4 of 138" | Tick items, **Add N items** | C19, C20 |
| 25 | Count settings | "Worth up to KES 500" and "And at most 5 % of expected" (both must hold), "How this plays out, last 7 days: 212 within range, 19 outside" with a what-if line, repeat shortfalls toggle, Director alert amount read only | Save settings | C23, C24, C25 |
| 45 | Count settings, Director | Same drawer; range and toggle read only; alert amount editable with "3 counts went over KES 5,000. At KES 8,000 it would have been 1" | Save alert amount | C23, C24, C26 |
| 26 | Director's Counts | KPI strip (Flagged to you · not seen, Net difference 7 days, Short 3 counts running, Longest without a count), chips Flagged to me / All counts / Repeat shortfalls, table (Count, Item, Difference, Value, Cause, Counted by, Status), note "You can read everything here. Only the Manager changes counts." | **Mark seen** (DIR, SA) | C3, C4, C30 |
| 46 | The Director alert | In-app row and a push: "Eggs short KES 5,200 in CNT-2026-1015"; quiet hours 22:00–05:00 hold the push | Open the count → step 26 | server side effect of C13, C29 |

## 6. Stock (Chapter 6, steps 27 to 29; Chapter 8, step 42)

| Step | Screen | Needs | Endpoint |
|---|---|---|---|
| 42 | Overview | Items tracked, Low or out, Negative stock, Counts today (signed, in progress); "Today's counts" list; "Longest without a count" (sections and items) | S1 |
| 27 | All items | KPI strip, search with filters (Category, Type, Department, Section), chips All / Low or out / Negative, table (Item, Section, On hand, Restock level, Value, Last counted, Status OK / Low / Negative), numbered pager | S2 |
| 28 | Stock ledger | Opening / In / Out / Closing KPI strip, search by item or reference (ADJ-3402, CNT-2026-1013), date control with quick picks and a two-month calendar, Section filter, chips (Had adjustments, Had waste, Negative stock only), one row per item (opening, in, sent out, Prep use, waste, adjusted, closing, value), Export, pager | S3, S4 |
| 29 | One item's stock card | On hand now, value, last counted, period strip, one row per day with source references (ADJ, DSP, GRN), "Show · By day", chips Days with movement / Adjustments only, quiet periods collapsed | S5 |

All of Chapter 6 is read only for every desktop role. The Attendant does not reach it. Money values follow `catalog.see_costs`, which every desktop role holds.

## 7. Print (Chapter 8, steps 43 and 44)

| Step | Page | Needs | Endpoint |
|---|---|---|---|
| 43 | Blank count sheet, A4, four pages | Printed at, every section in shelf order with item and unit, empty boxes, no stock figures, one signature line at the end | C7 (SM, SA, AT) |
| 44 | Count record, A4 | Sections, counted by, time, counted / differences / net value, "Differences and what was decided" (item, expected, counted, difference, KES, decision), note about skipped items, **both signatures in the signature font with "signed with PIN" and times**, "This copy is for the Manager and shows expected stock" | C6 (desktop roles) |

## 8. Ambiguities and decisions

Settled by the owner on 8 Oct 2026 (this session):
1. **The Manager's own count: every line applies at signing**; lines outside the range are also flagged to the Director, who only marks them seen.
2. **No PIN on waste reversal** (as drawn in step 23). The only PIN-signed actions are signing a count and approving a count.
3. **"Log a missing movement" and "Ask for a recount" write nothing.** Log a missing movement records the kind (Dispatch, Prep use, Delivery, Waste) and the line reads "Movement logged · Dispatch" (step 44); the real movement is logged in its own flow and explains the line. Ask for a recount marks the line "Recount asked" and opens step 49 with that item picked; the new count is reviewed on its own.
4. **First sections:** the migration makes one section per supplier that has items, puts every item without a supplier in a manual section "Others", and adds an empty manual section "Packaging". After that, a new item with no supplier lands in "Not in any section" as drawn.
5. **Director:** two things. *Flagged* = every outside-range line of a count the Manager signs herself appears in "Flagged to me" until marked seen. *Alert* = any line whose value reaches the alert amount raises a push on that count's sign or approval, held during quiet hours 22:00–05:00. **No inbox row** (the Inbox is chat only today); the Flagged list is the in-app place.
6. **Open counts:** one open count per person, and a section can be in only one open count at a time.
7. Design defaults confirmed: a "Reorder" link on step 1 (and on step 12) opens step 40; a "Move" action on an item row opens step 41; the Director opens Count settings from a **Count settings button on their Counts page** (owner, 8 Oct 2026; no sidebar link, because Paper shows the Manager's page behind the drawer); a signed count has no checkbox column (step 47); routes under `/app/inventory/stock` as in the Screens index.

Still **needs owner decision** (not drawn, so not invented; the contract gives each a default that the build briefs follow unless the owner says otherwise):
- **N1 (step 14).** Where the Manager picks the cause for her own outside-range lines. Default: the same cause chips inline in the sign dialog, required before "Sign and apply".
- **N2 (steps 40, 41, 24).** The control that opens the move sheet on step 41, the "Section" move menu on step 24, and adding a section (name input). Default: a Move action on the row opens the drawn sheet; the "Section" link on step 24 opens a small menu of sections; "+ Add a section" adds an inline name field.
- **N3 (steps 19, 21).** Attendant waste values. The owner rule says the Attendant sees item cost; the phone screens draw none. Default: the API sends item cost; the phone screens show none, as drawn.
- **N4 (step 12).** What the Attendant does if they open `/counts/new`. Default: redirect to the phone count (step 1).
- **N5 (steps 8, 9).** How a count is abandoned. Not drawn; no cancel endpoint. A stuck open count is finished or signed by its owner (skipping is allowed), so it cannot block anyone for good except the sections it holds. Deferred; raise if it happens.
- **N6 (step 8, all desktop pages).** The top-bar "Search an item ⌘K". Default: it searches items (S2) and opens the item's stock card.
- **N7 (step 7 tracker).** "Checked" means the Manager has decided every outside-range line (before she approves). Default as stated.
- **N8 (steps 45, 46 alert).** The alert push text is as drawn; the in-app row is dropped (decision 5), so step 46's inbox row is not built, only the push.
- **N9 (step 43).** The Attendant prints the blank sheet from a phone-friendly link on step 1's header menu. Default: no extra control; the Manager prints from Count setup, the Attendant is not given a print button (the index lists AT as allowed to see it, not as having a drawn control).
- **N10 (step 28).** "Open a day for its entries" (stock card) is described in the old notes but not drawn. Default: the day row expands in place to its individual entries (S5 returns them per day on request).
- **N11 (steps 9, 28, 29, 44).** Paper shows dispatch references like `DSP-0418` and `DSP-0121`, but a dispatch in the database has **no persistent number**: only a daily per-branch `sequenceLabel` ("Dispatch 4 · Nyeri Town · 17 Sep"). Default: wherever Paper draws a `DSP-nnnn`, the screens show the `sequenceLabel`, and a search for "DSP" matches it; numbering dispatches (a `DSP` counter) belongs to the Dispatch rebuild, which will then change those strings with no screen change. GRN, ADJ, PREP and CNT references do exist.
- **N12 (step 29).** "5 days and 1 earlier period" is drawn but its rule is not written. Default: the card shows one row per day that has a movement, newest first, for the 5 most recent such days, and one collapsed row for everything older in the period; `show=entries` lists every entry unpaged. The chip "Adjustments only" keeps only days that have an ADJUSTMENT.
