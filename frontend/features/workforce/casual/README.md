# Casual pay (the phone)

**Spec:** `docs/features/workforce/specs/3-payslips-spec.md`, Paper Chapter 12 steps 30 to 36 (casual pay). **Status:** built and walked in a browser at 390 wide: a department head records (also offline, then retried), the Branch Manager approves with a PIN (wrong PIN refused in words), the head takes the worker's receipt, the pay sheet opens as a PDF (20 Oct 2026). Awaiting owner review. **API:** `docs/API_CONTRACT.md` §42 (`/workforce/casuals`). **Decisions:** `docs/features/workforce/decisions-3-payslips-frontend.md`.

Routes under `app/app/workforce/casuals/`: the head's day, `approve`, `preview` (the draft drawn on the phone), `[sheetId]`, `[sheetId]/document` (`?preview=1` is the draft, with "Print after approval" disabled and its reason).

A sheet is found or made by branch, department and day. Day pay is rate × minutes ÷ 480, whole shillings, half up (the same maths as the server, in `casual-pay.ts`; the server's figure is the one that counts). The head records the last 3 days and sends only after every shift ends. A sheet the Branch Manager recorded is the Director's to approve. The cash holder pays and each worker signs on the head's phone; void before anyone signs, a correction line afterwards.

## Parity manifest (one line per screen)

| Screen | Built | Notes |
|---|---|---|
| Day (workers, add, total, preview, send) | `record/` | Saved-on-phone marker, offline retry every 20 s, stale-sheet words. |
| Add a casual (my casuals, new casual) | `record/worker-picker.tsx`, `new-casual-form.tsx` | A worker already on the day is disabled with the reason as text. |
| Times drawer | `record/line-drawer.tsx` | Number pad; the pay working shown ("8 h × KES 900 ÷ 8 = 900"). |
| Approve (PIN, send back, void) | `approve/` | One brown button; the server total is `expectedTotal`. |
| Sheet and receipts | `sheet/sheet-screen.tsx`, `receipt-dialog.tsx` | The worker types their full name to sign. |
| Pay sheet document | `sheet/sheet-document-screen.tsx` | Shared PDF viewer; "Print or share" and "Download PDF". |

**Wire names:** the sheet carries `organizationId` and `organizationName` (guarded by `_shared/lib/wire-names.test.ts`). **Coupling:** the shared Workforce kit and the Payroll Casual pay tab (reads the approved sheets, lane 1).
