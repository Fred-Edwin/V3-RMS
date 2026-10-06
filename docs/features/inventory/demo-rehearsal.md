# Demo rehearsal checklist (agent use)

Run in a real browser against production (`v3-rms.vercel.app`). Check each line: it loads, has data, the action works, the wording reads well. Do live edits only on DEMO rows (see [demo-data.md](demo-data.md)). Record Pass, Fail or Note in the Result column.

## Part 1. Catalog, Suppliers, Restock levels, Audit log

| # | Role | Check | Result |
|---|---|---|---|
| 1.1 | Store Manager | Catalog: 214 items, categories, strip counts make sense, search "samrat" matches by supplier | |
| 1.2 | Store Manager | Open an item: pack, used by, sellers with prices, history | |
| 1.3 | Store Manager | Add item "Demo — Test item"; edit it (Review change step); retire it with a reason; restore | |
| 1.4 | Store Manager | Restock levels: mix of OK, Low, Out; Whose levels switch (Central Store, Kitchen, Barista); suggestion text | |
| 1.5 | Store Manager | Edit a demo level, Review changes, save, see history, Put back | |
| 1.6 | Store Manager | Suppliers list (7); open Samrat: Overview, Contacts, Payment (Show hides/reveals), Catalog, Documents | |
| 1.7 | Store Manager | Meadows Contacts shows the demo contact; edit it | |
| 1.8 | Store Manager | Add a Cheque method on a supplier with a reason, then remove it | |
| 1.9 | Store Manager | Documents: upload a file titled "DEMO test", download it, delete it (find out if uploads work) | |
| 1.10 | Store Manager | Audit log: the edits above appear, filters (area, who, when) work | |
| 1.11 | Store Attendant (phone width) | Sees Low/Out only, no numbers or money; "Add it now" item flow | |
| 1.12 | Accountant | Reads the Central Store; sees supplier Payment tab; no catalog edit buttons | |
| 1.13 | Branch Manager | Reads; **no Payment tab** on a supplier; no write buttons | |
| 1.14 | Director | Reads everything incl. Payment tab; no write buttons | |

## Part 2. Purchasing and Receiving (mock, System Admin with the Demo bar)

| # | View as | Check | Result |
|---|---|---|---|
| 2.1 | System Admin | Demo bar visible; "Demo data" banner; load "A normal day"; something in every tab | |
| 2.2 | Store Manager | "An order awaiting approval": wrong PIN 0000 then 1234; price flag; Send on WhatsApp dialog; Print LPO (A4); Cancel with reason | |
| 2.3 | Store Manager | Needs restocking: tick items, change supplier, Create order | |
| 2.4 | Store Attendant (phone) | Restock and send for approval (no prices); My orders; returned order shows note and Edit and send again | |
| 2.5 | Store Attendant (phone) | To receive: short line, price-change confirm, delivery note number, photo (a "fail…" file shows retry), PIN | |
| 2.6 | Accountant | Add invoice 27,486 (matches), then 27,986 (variance, reason, disputed), duplicate warning on INV-05121 | |
| 2.7 | Accountant | Settle dispute; To pay overdue first; Pay M-Pesa and Cheque; overpay blocked; Print payment advice | |
| 2.8 | Accountant | Closed file: Documents, + Add a document, audit log on the right; Reverse a payment (Store Manager PIN); Void invoice | |
| 2.9 | Accountant | Supplier Samrat: What we owe, Orders tab, Statement tab, Export PDF, Export CSV, print statement | |
| 2.10 | Audit log | "Purchasing and payments" view; search LPO-0044 | |
| 2.11 | Director, Branch Manager | Read only everywhere; Branch Manager has no Payment tab | |
| 2.12 | All | Phone width: Demo bar folds to a tab; no horizontal scroll | |
| 2.13 | All | Console clean; no failed network calls | |

## Results, 6 Oct 2026 (first pass, production, desktop 1440 and phone 390)

**Passed:** 1.1 Catalog (214 items, strip, supplier-code search with "MATCHED" caption) · 1.2 item page · 1.3 add, edit with Review change, retire with reason, restore · 1.4 Restock levels (mix of Out 2, Low 4, rest OK) · 1.5 edit a level, Review changes, save, Put back · 1.6 supplier page and Payment tab (account masked behind Show) · 1.7 Meadows contact present · 1.10 Audit log shows every edit above · 1.11 Attendant is sent away from Restock levels and sees no prices in the catalog · 2.1 Purchasing mock loads (banner, six tabs with counts, Demo bar, "A normal day").

**Failed or needs a decision:**
1. **Supplier document upload fails in production: "Document storage is not configured."** Step 1.9 cannot be shown until storage is set up (owner action). The Documents tab itself loads, empty.
2. **Search by supplier company name finds nothing** ("samrat" returns no items). It matches our item name and a supplier's own name or code for the item (works with a code such as 145016). The Catalog README says "supplier names"; reword it, and demo with a code.
3. **Mixed real and mock numbers on supplier pages.** Samrat's "What we owe" card shows KES 8,050 (mock) while its stat tiles show Spend KES 0 and Receipts 0, and the suppliers list says "KES 0 owed to 0 suppliers".
4. **The Restock review says low items appear on Purchasing "right away".** The Purchasing mock uses its own sample items (Kabras Sugar, Salt Cooking Oil), so a level changed on Restock does not appear there. Do not promise that link in the demo.
5. **"DEMO ·" is visible to the client** in the Audit log (21 rows at 04:54), the Restock change history and the suppliers list (Meadows contact line). Decide before the demo whether to keep the marker or swap it for neutral wording.
6. **Item page says "Price from a signed receipt on 28 Sept"** for seeded supplier prices, though no receipt has been signed.
7. **Catalog strip:** "Added this week 214" and "Needs setup 145" (guessed pack sizes) read oddly for a catalog that was loaded in one go.
8. **Toast covers the "Change history" button** on Restock levels for a few seconds after saving.
9. **The avatar shows "JM"** for every user on the phone layout (Store Manager and Attendant both).
10. **Each save takes a few seconds** against the live API (create, edit, retire, restock save).

**Second pass (same day), passed:** 1.12 Accountant sees the Payment tab · 1.13 Branch Manager (King'ong'o) has no Payment tab and no write buttons · 1.14 Director sees the Payment tab and no write buttons · 2.2 Store Manager approves LPO-0011 (wrong PIN shows "That PIN is not right", 1234 approves, toast, counts move) · printed LPO (signed by both with PIN timestamps, QR, supplier acknowledgement) · purchase file page (stage tracker, totals, Send on WhatsApp, Print, Copy link, Items/Documents/Activity) · closed file LPO-0002 (five documents, audit log, payment with Print advice and Reverse) · printed payment advice · supplier Statement tab and printed statement · 2.6 Accountant invoice drawer (+500 variance, advance applied, reason required, "saved as disputed") · demo state survives a page reload.

**More findings from the second pass:**
11. **Mock supplier details differ from the real supplier record.** The printed payment advice and statement show Samrat's KRA PIN `P051234567X` and address "Kimathi Way, opposite Nyeri Town Hall"; the real Samrat page shows `P051163853Y` and a P.O. Box. A client who compares will notice.
12. **The mock persona is "Joseph Mwangi"** (Store Manager) and "Margaret" (Accountant) on the LPO, history and audit log, while the real logins are named "Store Manager" and "Margaret Accountant". Explain it as sample data.
13. **Statement shows two "owed" figures.** Closing balance reads (1,950.00) (advance held as credit) while Total owed reads 8,050.00 (the late invoice). The printed statement explains the brackets; say it aloud.
14. **The sidebar drops links for a moment** after changing "View as" in the Demo bar (Receiving, Purchasing, Suppliers, Catalog, Audit log vanish, then return).
15. **Browser quirks of the test tool, not product faults:** radio-button mouse clicks in the Retire dialog timed out (keyboard worked).

**Not run:** 1.8 (Cheque payment method add and remove), the Attendant's phone Purchasing views (2.4, 2.5), Accountant pay, reverse and void (2.7, 2.8), phone width for the Demo bar (2.12), console and network check (2.13). The pay, reverse and void rules are covered by the mock's own engine tests.

## Afterwards
List what failed or reads badly, fix it, re-run those lines. Remove anything added to real suppliers (cheque, documents).
