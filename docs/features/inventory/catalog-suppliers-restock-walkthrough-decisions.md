# Catalog, suppliers and restock levels walkthrough: decisions

Design only. Paper page "15 · Catalog, suppliers and restock levels walkthrough (client)" in the V3-RMS file. Draft, awaiting owner approval. 36 screens in 8 chapters, plus 3 added screens (1b, 9b, 18b). The Supplier statement, Supplier orders tab and printed statement are in the Purchasing walkthrough and are not redrawn.

## Who does what

| Person | Device | Can do |
|---|---|---|
| Store Manager (Isabel Njoki) | Desktop | Add, edit, retire and restore items and categories. Add and edit suppliers, contacts, payment methods, catalog lines and documents. Set Central Store restock levels. Put a supplier on hold or archive it. |
| Store Attendant (Linnet Wanjiru, Peter Kariuki) | Phone | Find an item. Add a missing item directly, no approval. Never sees stock figures, expected stock or costs. |
| Department Head (Frederick, Kitchen; Joy, Service; Steven, Barista) | Phone | Set restock levels for their own department, at any time. Put an old level back in one tap. |
| Accountant (Margaret) | Desktop | Sees supplier payment details. Is told when they change. |

- Payment details are visible to Store Manager, Accountant and Directors only. Attendants never see them.
- Changing payment details needs a reason, is logged, and tells the Accountant. No PIN, because no money moves.

## Settled by the owner

1. The word is **Restock level** everywhere. "Par level" is retired.
2. Restock levels show a **suggestion** from recent use (average use per day times days of cover). New items show "Needs 14 days of use first".
3. **Attendants may add an item directly**, with no Store Manager approval. It shows under **Needs setup** so Isabel can add category, price, supplier and used-by departments.
4. **Department Heads can change their levels at any time.** There is no 24-hour window for them. Every change is logged and can be put back from the history.
5. A supplier can sell an item in **its own pack** (for example Samrat sells sugar in 2 kg packets as well as 50 kg bags). The supplier line carries the pack.
6. Duplicate items: **retire the duplicate and note what replaced it.** No merge for now.

## How things work

**Add an item (Store Manager).** One drawer, one form. Name, then three type chips using the product and database names: Stocked, Raw ingredient and Prepped, each with a one-line explainer. The fields below change with the type: Prepped hides the buying fields, Raw ingredient hides Used by. Then how it is bought: "I buy it by the bag. One holds 50 kg. I use it in kg." The screen shows the price per kg while typing. Pack size and conversion are one entry. Category, used-by departments and restock level are on the same drawer. A similar name shows a warning inside the drawer before saving. Who sells it is added after, from the item page or the supplier page (kept as its own step on purpose).

**Edit an item (Store Manager).** The same form, filled in. Changing something that matters (pack or unit, type) shows a "Review change" step with a summary and a reason, so nothing changes silently.

**Item page.** Shows pack, used by, restock level, who sells it with prices, and a history of every change. Edits that matter (unit or pack, type, retire) show a summary first and ask for a reason.

**Restock levels (Store Manager).** One page for the Central Store: on hand, status (OK, Low, Out), level, and the suggestion. Edit in the rows, then Review changes. The summary says which items will turn Low. Each change is logged. History per item with Put back.

**Add a supplier.** Only name, type, phone, address and how we pay them. A duplicate warning appears first. The supplier page shows a checklist (Profile 4 of 7) for the rest: contact person, bank or M-Pesa details, KRA PIN.

**Summary strips.** Four screens open with a strip of four numbers: Catalog (items tracked, needs setup, low or out, added this week), Restock levels (out, low, no level set, suggestions differ), Suppliers (active, on hold, profile not finished, owed) and a supplier's Catalog tab (items they sell, price alerts, last receipt, spend over 90 days). Cells that need attention carry a coloured top edge and an arrow. They are drawn as one-tap filters for the list below (assumption, not yet confirmed). Dimmed copies appear behind the drawers and dialogs that open from these screens.

**Add a supplier details.** Category is optional. There is no map link on the address.

**Documents tab.** Search by file name, a date range, Added by, All / Uploaded / Automatic, sort, and type chips with counts. The footer says "Showing 5 of 27".

**Supplier page.** Tabs: Overview, Contacts, Payment, Catalog, Documents. Account numbers are hidden until Show. Catalog prices update from signed receipts. A price set by hand is logged. Add several items at once with prices.

**Attendant adds an item (phone).** In receiving, search finds nothing, so "Add as a new item". Name, what it is, how it arrives (1 tin = 400 g). No prices or stock. Back to the delivery to count.

**Department Head (phone).** Big minus and plus steppers, the suggestion under each item, a review sheet, then a history with Put back.

## Fixing mistakes (nothing is deleted)

| Mistake | Fix |
|---|---|
| Item added twice | Retire the duplicate, note what replaced it. Open orders keep their lines. Restore any time. |
| Wrong unit or pack | Edit with a reason after a summary. Stock stays in kg. Old receipts keep their numbers. |
| Item retired by mistake | Show retired, then Restore. |
| Supplier added twice | Warning first. If one slips through, archive it. Archiving is blocked while invoices are unpaid; Put on hold instead. |
| Wrong bank or M-Pesa details | Change with a reason. Accountant told. Old and new (hidden) are kept. |
| Wrong supplier price | Prices come from signed receipts. Correct the receipt in Purchasing. A hand-set price can be set again. |
| Wrong restock level | Change again, or Put back from the history. |
| Attendant adds the wrong item | It shows under Needs setup. The Store Manager corrects or retires it. |
| Supplier put on hold by mistake | Make it active again. |

Every change appears in the Audit log under Catalog, Suppliers or Restock levels, with who, when and why.

## Running example (Mon 12 Oct 2026)

- 08:55 Linnet adds **Tomato paste** (1 tin = 400 g) while receiving 24 tins from Samrat Supermarket Ltd.
- 09:41 Isabel creates **Brown sugar** (1 bag = 50 kg, Dry goods, Kitchen and Barista, restock level 100 kg, usual price KES 8,900 per bag = KES 178 per kg). A similar item, Sugar, white, triggers the duplicate warning.
- 09:58 Isabel adds Samrat as the seller at KES 8,900 per bag, preferred.
- 10:05 Wheat flour pack changes from 25 kg to 24 kg ("Supplier changed the pack").
- 10:20 Restock levels: Sugar, white 150 to 180 kg (suggestion: 12 kg a day for 15 days). Cooking oil 60 to 100 L, which turns it Low (80 L on hand).
- 10:30 Isabel adds **Kagumo Poultry Farm** (SUPPLIER-0008, Invoice to follow, 14 days). Profile 4 of 7.
- 10:48 Frederick (Kitchen): Chapati dough 12 to 14 kg, Kachumbari mix 6 to 8 kg.
- 11:02 Isabel retires Sugar, brown (added twice), replaced by Brown sugar.
- 11:15 Isabel changes Samrat's bank account (reason: supplier changed bank). Margaret is told.

Samrat Supermarket Ltd (SUPPLIER-0001) sells Brown sugar 50 kg bag KES 8,900, Sugar white 50 kg bag KES 9,150 (up 6% since 28 Sep), Sugar white 2 kg packet KES 380, Cooking oil 20 L jerrican KES 5,200, Wheat flour 24 kg bag KES 3,400. Samrat owed: KES 42,180.

## What changed compared with the old design

- Item type named Stocked, Raw ingredient or Prepped (owner decision, 1 Oct 2026, replacing the plain-language labels; mobile shows "Raw"), one-sentence units, pack and conversion merged (new).
- Preferred supplier removed from the item drawer; set where prices are (new).
- Item page with suppliers, prices and history (new).
- Needs setup filter and Profile checklist (new).
- Restock levels become one page with suggestions and a review step (the old drawer showed 2 rows). Department levels get steppers and history (new).
- Attendant can add an item (new).
- Change history, reasons and Put back on item, price and level edits (new).
- Table headers use the current style (no fill). Audit log is in the sidebar.
- Store Manager phone copies of these screens are not drawn; they come after the build.

## After the supplier document review (added 1 Oct 2026)

Drawn from the owner's visit to the Central Store and the seven supplier document sets (Samrat, Summer Limited, Demka Dairy, Meadows, Palora, Washan Groceries, Wakubiu Coffee). Added screens are numbered 1b, 9b and 18b so the other step numbers stay put until the owner approves; they get final numbers then. On the Purchasing page of the approved file: 20b and 21b.

**How items and suppliers relate.** One catalog item is one thing the store counts and issues, under OUR name, kept in its usage unit. Each supplier that sells it has its own line: their name for it, their code (if printed), their pack, their price. Lines are rows, never columns. The same supplier can have two lines with different packs. Something is a separate item when no department would use either interchangeably (cups 300 ml vs 500 ml, still vs sparkling water). Renaming our item never touches their name.

**Changes drawn**

1. **Cheque as a payment method.** Supplier Payment tab shows a Cheque row (payable to, bank, optional note). New drawer "Add a payment method" (18b), with Cheque chosen. It needs a reason, is logged, tells the Accountant, and needs no PIN. The Audit log shows "cheque method added". Purchasing: "Record payment" lists Cheque, and picking it changes the reference label to "Cheque number" (20b). The payment advice for a cheque shows Method: Cheque, Cheque number, bank (21b).
2. **Several packs for one supplier and item.** No redraw. The existing "Add who sells it" drawer ("different pack gets its own line") and the Catalog tab already say it.
3. **Housekeeping** added to "Used by departments" in the Add item drawer (steps 2 and 3). The Edit item drawer for a Prep-only item has no Used by. The catalog Department filter and the restock scope list include Housekeeping.
4. **Their name and code.** Two optional fields on "Add who sells it" (step 6). The supplier Catalog tab (step 20) shows their name and code under each item. The item page (step 7) shows them under each supplier. Catalog search matches their names and codes, and says why a row matched (1b).
5. **Supplier-facing documents use their name and code (owner approved).** The printed LPO (step 9) shows the supplier's name and code first and "Our item: …" second. The WhatsApp message (step 8) lists the lines with their names and codes. Internal screens show OUR name first with theirs second: the order page, the purchase file, and the invoice screens on desktop. The phone "Check the goods" screen was left with our name only, because the extra line pushed the Next button off the screen; to settle with the owner.

**Also drawn**

- **Review a unit change with no history (9b).** For a seeded item: "No stock has been counted yet, so no figures change", "No receipts yet", "No open order uses this item".
- **Confirm preferred.** Where seeding picked the cheaper supplier as preferred, the Catalog tab shows "Preferred · confirm" until the Store Manager confirms it.
- **Price on first receipt.** A supplier linked from the Store sheet with no invoice price shows "To confirm" and "first receipt sets it" on the item page.
- **Store Manager sets every department's levels.** The Restock levels page has a "Whose levels" switch: Central Store, Kitchen, Pastry, Barista, Service, Housekeeping. Each change is logged. Department heads still set their own on their phones, including a Housekeeping head (not drawn; same screens as chapter 7).

**Out of scope for now.** Non-stock purchases (paint, equipment, repairs). Rule of thumb: counted in the store and issued to a department is stock, including packaging and cleaning supplies; used up or installed in one go is non-stock. If asked: "not in this version".

**Seeding notes for planning.** Items from the sheets without pack details start with usage unit = buy unit and no pack size, so most seeded items will show Needs setup. Terms default to Invoice to follow, 14 days. Where two suppliers sell the same item, the cheaper per usage unit is marked preferred and flagged for confirmation.

**Placeholders in the drawings.** Supplier codes other than 190035 (Zesta Chilli Sauce, Samrat) and the supplier names on the LPO lines are made-up examples.

## Open questions for the owner

1. **Suggested level formula.** Average daily use over the last 14 to 30 days times days of cover (the drawn example uses about 15 days for dry goods, 5 days for perishables). Is that the right default, and who sets the days of cover per item?
2. **Needs setup for attendant-added items.** They stay under Needs setup until the Store Manager finishes them. Should an item added by an attendant be usable on orders before that? The drawn flow says yes for receiving, not for ordering.
3. **Supplier documents.** Upload is for Store Manager and Accountant only, not attendants. Confirm.
4. **Retire with open orders.** The drawn rule lets existing order lines stay and blocks new ones. Confirm.
5. **Contacts and Documents tabs** are redrawn in the new style but not changed in behaviour.

## Type names (owner decision, 1 Oct 2026)

Stocked (was "Bought, used as is"), Raw ingredient (was "Bought, for Prep"; mobile shows "Raw"), Prepped (was "Made in Prep"). Used on the catalog filter chips and type column, the add and edit drawers (each type has a one-line explainer), the item page subtitle and unit captions. The attendant phone form offers Stocked and Raw ingredient only, each with a short explainer; attendants cannot create Prepped items because those come from a Prep run.
