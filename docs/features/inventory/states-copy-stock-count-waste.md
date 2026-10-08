# State copy: Stock, Counting and Waste (draft, 8 Oct 2026)

One reusable states kit (loading, empty, error, permission) plus this table of lines per screen. Plain voice: short, says what happened and what to do next, no blame, no jargon. Not wired into `states-copy.ts`; the orchestrator lands it. Step numbers are the Paper page "Inventory · Counting redesign (Oct 7)". The Attendant uses the phone screens at every width.

Rules for every row: **loading** is a quiet skeleton with the line below; **empty** says what will appear and offers the one action; **error** says what failed, that nothing was lost, and offers Try again; **permission** says who can do it and never shows a disabled button (the button is hidden).

| Screen (step) | Loading | Empty | Error | Permission |
|---|---|---|---|---|
| Pick a section, phone (1) | Getting today's sections | No sections are set up yet. Ask the Store Manager to set them up in Count setup. | Could not load the sections. Nothing was changed. Try again. | Counting is for the Store Attendant and Store Manager. |
| Count the shelf, phone (2) | Opening Samrat | This section has no items. Ask the Store Manager to add some. | Could not save the last number. It is kept on this phone. Try again. | You can count here only while a count is open for you. |
| Section done, check items again (3) | Checking your numbers | Nothing to check again. Carry on. | Could not check this section. Carry on or try again. | (none) |
| Review before signing (5) | Gathering your numbers | You have not counted anything yet. Go back and count, or skip what you will not do today. | Could not load your numbers. They are saved. Try again. | Only the person who counted can sign. |
| Sign with PIN (6) | Signing | (none) | Could not sign. Check your PIN and try again. Nothing was sent. | You have no PIN yet. Ask the System Admin to set one. |
| Submitted (7) | (none) | (none) | Could not confirm the count was sent. It is saved. Try again. | (none) |
| Reorder sections for today (40) | Getting today's order | (none) | Could not change the order. It stays as it was. Try again. | Reordering is for the Store Attendant and Store Manager. |
| Move an item (41) | Moving it | (none) | Could not move it. It stays in its section. Try again. | Moving items is for the Store Attendant and Store Manager. |
| Counts list (8, 48) | Getting counts | No counts yet. Start the first one. | Could not load counts. Try again. | You can read counts. Starting one is for the Store Manager. |
| Review a count (9, 47) | Opening CNT-2026-1013 | This count has no lines. | Could not load this count. Try again. | You can read this count. Deciding lines is for the Store Manager. |
| Decide a line (10) | Saving your decision | (none) | Could not save. The line is still undecided. Try again. | Deciding lines is for the Store Manager. |
| Approve and sign (11, 14) | Signing and writing adjustments | (none) | Could not approve. Nothing was written. Try again. | Approving needs a PIN. Set yours in Settings. |
| Start a count (12, 49) | Getting sections | Nothing is set up to count. Open Count setup. | Could not start the count. Try again. | Starting a count is for the Store Manager and Store Attendant. |
| Count signed (15) | (none) | (none) | Could not confirm the signature. Check Counts before you start again. | (none) |
| Pick what was wasted, phone (16) | Getting usual items | No usual items yet. Search for the item. | Could not load items. Try again. | Logging waste is for the Store Attendant and Store Manager. |
| How much, and why (17) | (none) | (none) | Could not read that number. Check it and try again. | (none) |
| Check, then confirm (18) | Logging waste | (none) | Could not log it. Nothing was recorded. Try again. | (none) |
| My waste today, phone (19) | Getting today's waste | You have logged no waste today. | Could not load your waste. Try again. | You see your own entries. |
| Reverse a wrong entry, phone (20) | Reversing | (none) | Could not reverse it. The entry stays. Try again. | You can reverse your own entry on the day you logged it. |
| Waste, desktop (21) | Getting waste | No waste logged in this period. | Could not load waste. Try again. | You can read all waste. Logging and reversing are for the Store Manager. |
| Log waste drawer (22) | Logging waste | (none) | Could not log it. Nothing was recorded. Try again. | Logging waste is for the Store Manager and Store Attendant. |
| Reverse any entry (23) | Reversing and returning the stock | (none) | Could not reverse it. Nothing changed. Try again. | Reversing needs a PIN and is for the Store Manager. |
| Count setup (24) | Getting sections and items | Nothing set up yet. Add your first section. | Could not load Count setup. Try again. | You can read the setup. Changing it is for the Store Manager. |
| Add items drawer (24B, 24C, 51) | Looking for items | Every item is already in a section. | Could not search. Try again. | Adding items is for the Store Manager. |
| Add items, no matches (50) | Looking for items | No item called "oatmilk". Check the spelling, or try part of the name. Clear the search to see everything not in a section. | Could not search. Try again. | Adding items is for the Store Manager. |
| Count settings (25) | Getting settings | (none) | Could not save. Your old settings still apply. Try again. | The range is the Store Manager's. The alert amount is the Director's. |
| Director's Counts view (26, 46) | Getting flagged counts | Nothing flagged. Counts over your alert amount appear here. | Could not load counts. Try again. | Flagged counts are for the Director. |
| Count settings, Director (45) | Getting settings | (none) | Could not save the alert amount. The old one still applies. Try again. | Only the Director sets the alert amount. |
| All items (27) | Getting items | No items match. Clear the filters. | Could not load items. Try again. | You can read all stock. The Attendant does not see stock. |
| Stock ledger (28) | Getting movements | No movements in this period. | Could not load the ledger. Try again. | You can read the ledger. The Attendant does not see it. |
| Stock card (29) | Getting this item | No movements for this item yet. | Could not load this item. Try again. | You can read stock cards. The Attendant does not see them. |
| Overview (42) | Getting today's picture | No counts today. Start one. | Could not load the overview. Try again. | You can read the overview. Starting a count is for the Store Manager. |
| Printed pages (43, 44) | Getting the page ready | (none) | Could not make the page. Try again. | Printing is for the Store Manager. |
| Director alert (46) | (none) | No alerts. | Could not load alerts. Try again. | Alerts are for the Director. |
