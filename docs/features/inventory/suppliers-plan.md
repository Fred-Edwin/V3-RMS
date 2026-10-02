# Suppliers — Expansion Plan

**Status:** draft for owner approval, 2026-09-30.
**Why:** the current supplier record (name, one contact, phone, email, free-text
location, payment terms/days) cannot hold what the client's real supplier files
contain: regular and one-off suppliers, several contacts, bank/M-Pesa details,
what is bought from each and at what price, and the paper documents. Central
Store go-live and staff training on purchasing depend on this.
**Production today (checked 2026-09-30):** 0 suppliers, 0 items, 0 receipts.
Nothing to migrate in production, so the new shape ships clean and the real
data is loaded straight into it.

## 1. Decisions (owner, 2026-09-30)

| # | Decision |
|---|---|
| 1 | Supplier **type**: Regular, Occasional, One-off, Market |
| 2 | Supplier **code**: automatic, padded, `SUPPLIER-0001`, unique, never reused, not editable |
| 3 | Supplier **status**: Active, On hold, Archived |
| 4 | **Payment methods**: Bank transfer, M-Pesa Paybill, M-Pesa Till, M-Pesa Send Money, Cash |
| 5 | **Catalog**: several suppliers per item; price updates automatically from signed receipts |
| 6 | **Documents**: automatic history plus file upload (photos/PDFs), stored in Cloudflare R2 |
| 7 | **Payment details visible to** Store Manager, Accountant, Director (owner is fine widening to Attendant later; not now) |
| 8 | **Address**: one required free-text field; map link optional |
| 9 | Ordering details (delivery days, cutoff, lead time): **out of scope** |
| 10 | **Pay now stays.** All suppliers currently invoice, so all are set to Invoice to follow; Pay now remains because Receiving and Supplier AP depend on it |
| 11 | **Category** stays the shared item/supplier category list, one per supplier |

## 2. Supplier record

**Identity:** code (auto), business name (required), trading name, status,
type, category, KRA PIN, VAT registered (yes/no), notes.

**Contacts (many):** name, role (Sales rep, Accounts, Delivery, Owner, Other),
phone, WhatsApp, email, primary flag (exactly one primary).

**Address:** one required free-text field, optional map link.

**Terms:** Pay now or Invoice to follow, payment days (invoice only), credit
limit (optional).

**Payment methods (many, one default):**

| Type | Fields |
|---|---|
| Bank transfer | bank name, branch, account name, account number |
| M-Pesa Paybill | paybill number, account reference |
| M-Pesa Till | till number |
| M-Pesa Send Money | phone, registered name |
| Cash | none |

**Catalog (one row per supplier and item):** item, supplier's own name/code,
buy unit, pack size, last price and date, preferred flag.

**Documents:** automatic timeline (receipts, invoices, payments, disputes) plus
uploaded files with type (Invoice, Delivery note, Receipt, Price list,
Contract, Tax document, Other), date, note, optional link to a receipt or invoice.

**Read-only summary:** total spend, last purchase date, receipts count, average
days to pay, price alerts, short deliveries.

**Housekeeping:** created/updated by and at; duplicate check on name and phone
at creation; quick-add from the receiving screen (name + phone, complete later).

## 3. Data model changes (additive migration)

`Supplier` (existing) gains: `code` (unique per org), `tradingName`, `status`
enum, `type` enum, `kraPin`, `vatRegistered`, `notes`, `creditLimit`,
`address` (renamed from `location`, now required), `mapUrl`, `createdById`,
`updatedById`.

| New table | Purpose |
|---|---|
| `SupplierContact` | many per supplier; partial unique index enforces one primary |
| `SupplierPaymentMethod` | many per supplier; `type` enum, typed columns for the fields above, `isDefault`; every change writes an audit row |
| `SupplierItem` | (supplier, item) unique; supplier's item name, buy unit, pack size, `lastPrice`, `lastPriceAt`, `isPreferred` |
| `SupplierDocument` | R2 object key, file name, mime type, size, doc type, doc date, note, optional `goodsReceiptId` / `supplierInvoiceId`, uploaded by/at |
| `SupplierAuditLog` | who/when/what for payment-method and status changes |

Rules:
- **Code** comes from the existing `ReferenceCounter` (`nextReference`, prefix `SUPPLIER`, pad 4), inside the create transaction.
- **Existing rows** (local/dev only): backfill code in creation order; move `contactName`/`phone`/`email` into one primary `SupplierContact`; copy `location` into `address` (empty becomes "—"); status Active; type Regular.
- **Preferred supplier** on `InventoryItem` (`preferredSupplierId`) is kept and kept in sync with `SupplierItem.isPreferred`; retire it in a later cleanup, not this change.
- **Price update:** when a goods receipt is signed, upsert `SupplierItem.lastPrice/lastPriceAt` for each line in the same transaction. The existing price-change alert compares against the supplier's own last price where one exists, otherwise the item's current cost.
- Every query includes `organizationId` (hub org, per D-15).
- Archived/On hold suppliers are excluded from the receiving picker; existing history is untouched. Archiving is refused only if there is an open (unpaid) invoice.

## 4. API (new section in `API_CONTRACT.md`, frozen after approval)

Roles: **SM** = Store Manager, **ACC** = Accountant, **DIR** = Director,
**ATT** = Store Attendant. All routes use `authenticate` + `requireRole`; every
body has a Zod schema.

| Method | Path | Roles |
|---|---|---|
| `GET` | `/inventory/suppliers` (filters: status, type, category, search) | SM, ACC, DIR, ATT (ATT sees code, name, type, primary phone only) |
| `GET` | `/inventory/suppliers/:id` (payment methods only for SM, ACC, DIR) | SM, ACC, DIR |
| `POST` / `PATCH` | `/inventory/suppliers[/:id]` (extended body) | SM |
| `POST` | `/inventory/suppliers/quick` (name + phone, type One-off) | SM, ATT |
| `PATCH` | `/inventory/suppliers/:id/status` | SM |
| `GET/POST/PATCH/DELETE` | `/inventory/suppliers/:id/contacts[/:cid]` | SM (read: SM, ACC, DIR) |
| `GET/POST/PATCH/DELETE` | `/inventory/suppliers/:id/payment-methods[/:pid]` | SM, ACC (read: SM, ACC, DIR) |
| `GET/PUT/DELETE` | `/inventory/suppliers/:id/items[/:itemId]` | SM (read: SM, ACC, DIR) |
| `GET` | `/inventory/suppliers/:id/documents` (timeline + uploads) | SM, ACC, DIR |
| `POST` | `/inventory/suppliers/:id/documents` (multipart) | SM, ACC |
| `GET` | `/inventory/suppliers/:id/documents/:docId/download` (returns a short-lived signed URL) | SM, ACC, DIR |
| `DELETE` | `/inventory/suppliers/:id/documents/:docId` | SM |
| `GET` | `/inventory/suppliers/:id/summary` | SM, ACC, DIR |

Errors: 404 (not in org), 409 (duplicate name+phone unless `confirmDuplicate`),
409 (archive with open invoices), 422 (file type/size), 403 (role).

**Files:** images and PDFs only, 10 MB max, type checked by content not just
extension. Bucket is private; downloads are signed URLs that expire in minutes,
issued only after the same role/org check as the supplier itself.

## 5. Screens (Paper, then build)

Extends the Milestone One Suppliers screens; desktop and mobile each.

1. **Suppliers list:** adds code, status pill, type, filters for status and type.
2. **Supplier detail:** tabs Overview, Contacts, Payment, Catalog, Documents; header shows code, status, type, terms.
3. **New/edit supplier:** grouped form (Identity, Address, Terms); contacts and payment methods managed in their own tabs with add/edit drawers.
4. **Payment tab:** methods list, default marked, account number masked with "Show".
5. **Catalog tab:** item rows with supplier price, last-updated date, preferred toggle; "Add item" picker.
6. **Documents tab:** timeline mixed with uploads, upload drawer, download.
7. **Quick-add supplier** on New goods receipt (small drawer).
8. Empty, loading and error states from the existing states kit, not new artboards per screen.

Per-screen visual gate against Paper applies during the build.

## 6. Sequencing

| Step | Work | Depends on | Owner |
|---|---|---|---|
| 1 | Approve this plan | | Owner |
| 2 | Paper designs for §5 | 1 | Design session, owner approves |
| 3 | Backend: migration, models, services, tests, contract doc (parallel with 2, except documents) | 1 | Build |
| 4 | Create the R2 bucket and access key; add env vars to production and CI | | Owner |
| 5 | Backend: document upload/download against R2 | 3, 4 | Build |
| 6 | Frontend: screens against the approved design and real endpoints; browser verification | 2, 3 | Build |
| 7 | Deploy through the normal `main` pipeline | 5, 6 | Build |
| 8 | Real-data loader script, dry-run locally, owner runs it in production | 7 | Build, owner |

Steps 2 and 3 run in parallel. Step 4 is the only external dependency; if it
slips, everything else ships and Documents upload follows (the automatic
history works without it).

## 7. Tests

- Service tests: code numbering (including concurrent creates), one-primary-contact rule, one-default-payment-method rule, duplicate detection, status transitions, archive block, price upsert on receipt sign, price alert against supplier price.
- Role/scope tests: ATT never receives payment methods, KRA PIN, credit limit or documents; every repository call is org-scoped.
- Contract tests: response shapes frozen; a scan proves the ATT list response has no payment-method keys.
- Upload tests: rejects wrong type, oversize, and cross-org download; signed URL not returned to unauthorised roles.
- Existing supplier, receiving and AP tests are kept and updated where the shape changes.

## 8. Loader for real data

After step 7. A single idempotent script (upsert by business name) that reads a
reviewed data file (suppliers, contacts, payment methods, catalog rows), reports
what it would create in a dry run, and refuses to run against production
without `ALLOW_PRODUCTION_SEED=true` and an explicit confirm variable. Owner
runs the production command; nothing here touches production from a dev session.
The data file is built from the client's supplier files and reviewed row by row
before any load.

## 9. Open items

1. Client's actual bank/M-Pesa/KRA details are needed for the loader; if any are missing the fields stay blank.
2. Cloudflare R2: bucket name, region, access key, and secret, added to production `.env` and GitHub secrets.
3. Confirm with the client that Market vendors also invoice (owner says yes).
4. Confirm whether Accountant should be able to edit payment methods (planned: yes).
5. Out of scope, recorded for later: ordering details, supplier scorecard beyond the summary, multiple addresses, purchase orders.
