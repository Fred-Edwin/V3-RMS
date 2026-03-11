# Receipt & Bill Printing — Implementation Prompt

The spec is finalized at `docs/RECEIPT_PRINTING_SPEC.md`. Read sections relevant to your task before implementing.

## Current Status

- **Phase A (Backend):** ✅ COMPLETE — all endpoints, middleware, service, repository, and validators are implemented and working.
- **Phase B (Frontend):** 🔴 NOT STARTED — UI buttons and print station management page need to be built.
- **Phase C (Flutter App):** 🔴 NOT STARTED — separate project, not in this monorepo.

---

## Phase B: Frontend (What Needs to Be Built)

Read `docs/RECEIPT_PRINTING_SPEC.md` sections 8.1–8.4 before implementing.

### Existing files (already implemented):
- `frontend/types/print.ts` — TypeScript types
- `frontend/services/printService.ts` — API client methods

### What to build:

1. **"Print Bill" button** — add to the order detail view.
   - Visible when `order.paymentMethod` is **null** (order not yet paid) and order has items
   - Calls `createPrintJob(orderId, "BILL")`
   - Shows toast: "Bill sent to printer"
   - Remains visible for reprinting

2. **"Print Receipt" button** — add to the order detail view / payment confirmation screen.
   - Visible when `order.paymentMethod` is **set** (order is paid)
   - Shows a brief confirmation: "This will print 2 copies (customer + accountant). Continue?"
   - On confirm: calls `createPrintJob(orderId, "RECEIPT")`
   - Shows toast: "Receipt sent to printer (2 copies)"
   - Remains visible for reprinting

3. **Print Station settings page** (`frontend/app/app/manage/settings/print-station/page.tsx`)
   - MANAGER/DIRECTOR/ADMIN only
   - Lists stations with online/offline badge and last seen time
   - "Add Print Station" button opens a modal:
     - Name input → on confirm calls `createPrintStation`
     - Modal switches to show a QR code encoding `{"url":"<NEXT_PUBLIC_API_URL>","token":"<raw_token>","name":"<name>"}`
     - Raw token displayed below with a copy button (fallback for manual entry)
     - Warning: "This token will not be shown again"
   - "Remove" button → deactivates station
   - Frontend dependency: `qrcode.react` (`pnpm add qrcode.react`)

4. **Print Job History** (optional, low priority) — simple list view in manager dashboard showing recent print jobs with receipt type badge, order number, status, time, requested by.

---

## Phase C: Flutter App ("Wendo Printer")

Read `docs/RECEIPT_PRINTING_SPEC.md` sections 6–7 and 11 for the complete Flutter app specification.

This is a **separate project** (not in this monorepo). Key points:

### Two Independent Loops
- **Polling loop** (every 3–5s): `GET /print-station/jobs?status=PENDING` → print each job `copies` times → `PATCH` status to COMPLETED/FAILED
- **Heartbeat loop** (every 30s): `POST /print-station/heartbeat` — runs independently, NOT dependent on polling

### Two Print Layouts
- **BILL**: No payment info, "BILL" header, "Please present this bill to settle payment" footer, 1 copy
- **RECEIPT**: With payment info, "RECEIPT" header, "Thank you for visiting Wendo!" footer, 2 copies

### Critical Requirements
- Foreground service for background operation (Android)
- Battery optimization whitelist prompt during setup
- JSON parse errors on individual jobs must NOT crash the loop — skip, mark FAILED, continue
- Heartbeat must survive independently of polling failures
- QR code scanning for one-tap setup

---

## Verify

```powershell
cd "d:\AI applications\web\V3-RMS\backend"; pnpm build; pnpm test
cd "d:\AI applications\web\V3-RMS\frontend"; pnpm typecheck; pnpm build
```

Zero errors, zero `any` types.
