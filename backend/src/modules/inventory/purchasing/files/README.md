# purchasing / files

**Design:** approved (Paper step 35 "When a photo does not upload", plus the photo slots on receive, invoice, payment and "Add a document") · **Code:** built (6 Oct 2026).

Stores the photos and PDFs on a purchase file: the delivery note, the supplier's invoice, a proof of payment, and extra documents. Other folders attach a file by its `id`.

## Rules
- Images (JPEG, PNG, WebP) and PDFs only, read from the file's own bytes, never its name or declared type. Largest file 10 MB.
- A storage failure is `503 UPLOAD_FAILED` (the screens' "Could not upload" with Retry) and leaves no database row. A database failure removes the stored object.
- The hub rule (D-15): uploads belong to the hub Site; a non-hub actor is refused.
- **Blind rule:** an invoice photo or a proof of payment is financial data, so a caller without `payables.read` (the Store Attendant) cannot get a link to it. A delivery note photo stays open to them.
- `thumbnail` is always `null` from the server; a screen asks for a short-lived link (5 minutes) when it needs the picture.

## Endpoints (mounted under `/inventory/purchasing`)
| Method | Path | Capability |
|---|---|---|
| POST | `/uploads` | `orders.request`, `orders.receive`, `orders.approve`, `payables.record_deposit`, `payables.record_invoice` or `payables.record_payment` |
| GET | `/uploads/:id/url` | `orders.read` or `payables.read` (invoice and payment files need `payables.read`) |

## Exports for other folders
`purchaseFileService.resolve(siteId, id)` (turns a file id on a request into the stored file, refusing an id from another site) and `toFileRef(file)`.

## Coupling
Uses `suppliers/supplier-files` (type sniffing, size limit, file-name cleaning) and `suppliers/supplier-storage` (Cloudflare R2, in-memory in dev and tests). Both are the shared upload plumbing; if a third sub-module needs them they should move to `_shared`.
