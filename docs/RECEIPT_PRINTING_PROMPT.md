# Receipt Printing — Backend + Frontend Implementation

The spec is finalized. Read `docs/RECEIPT_PRINTING_SPEC.md` in full, then implement Phase A and Phase B in order.

## Phase A: Backend

Build in this exact order:

1. **Prisma schema** (`backend/prisma/schema.prisma`) — add `PrintJobStatus` enum, `PrintJob` model, `PrintStation` model, and relations on `Order`, `Organization`, `User`. Then run `docker compose exec api npx prisma migrate dev --name add_print_jobs_and_stations`.

2. **Print station auth middleware** (`backend/src/middleware/print-station-auth.ts`) — reads `Authorization: Bearer pst_...`, hashes with SHA-256, looks up `PrintStation` by `tokenHash`, rejects if not found or `isActive: false`, attaches `req.printStation = { id, organizationId }`. Add the type to `backend/src/types/express.d.ts`.

3. **Validators** (`backend/src/validators/print-schemas.ts`) — Zod schemas for `createPrintJob`, `updatePrintJob`, `createPrintStation`.

4. **Repository** (`backend/src/repositories/print-repository.ts`) — all DB queries, no logic. `getPendingJobs` filters `status=PENDING` and `createdAt > now-24h`, ordered by `createdAt ASC`.

5. **Service** (`backend/src/services/print-service.ts`) — all business logic. `createPrintJob` validates the order is paid and assembles the `receiptData` JSON snapshot. `createPrintStation` generates `pst_` + 32 random bytes, hashes it, stores hash, returns the raw token once. `getPrintStations` adds derived `isOnline` field (true if `lastSeenAt` within 60s).

6. **Controller** (`backend/src/controllers/print-controller.ts`) — thin, delegates to service.

7. **Routes** (`backend/src/routes/print-routes.ts`) — three groups:
   - `/print-jobs` — JWT auth, roles: WAITER/MANAGER/DIRECTOR/ADMIN
   - `/print-station/*` — `authenticatePrintStation` middleware
   - `/print-stations` — JWT auth, roles: MANAGER/DIRECTOR/ADMIN
   Register all in `backend/src/routes/index.ts`.

8. **Tests** (`backend/tests/print.test.ts`) — cover: createPrintJob (success, unpaid order), createPrintStation (raw token returned, hash stored), auth middleware (valid/invalid/inactive), getPendingJobs (correct branch, skips stale jobs), updateJobStatus (COMPLETED and FAILED paths).

## Phase B: Frontend

1. **Types** (`frontend/types/print.ts`) — `PrintJobStatus`, `PrintJob`, `ReceiptData`, `PrintStation`, `CreatePrintStationResponse`.

2. **Service** (`frontend/services/printService.ts`) — `createPrintJob`, `listPrintStations`, `createPrintStation`, `deletePrintStation` using existing `apiClient`.

3. **Print Receipt button** — add to the order detail/payment screen. Visible only when `order.paymentMethod` is set. Calls `createPrintJob`, shows success/error toast, supports reprint (don't hide after first use).

4. **Print Station settings page** (`frontend/app/app/manage/settings/print-station/page.tsx`) — MANAGER/DIRECTOR/ADMIN only. Lists stations with online/offline badge and last seen time. "Add Print Station" button opens a modal: name input → on confirm calls `createPrintStation` → modal switches to show a QR code (install `qrcode.react` with `pnpm add qrcode.react`) encoding `{"url":"<NEXT_PUBLIC_API_URL>","token":"<raw_token>","name":"<name>"}`, plus the raw token with a copy button. Warning: token shown once only.

## Verify

```powershell
cd "d:\AI applications\web\V3-RMS\backend"; pnpm build; pnpm test
cd "d:\AI applications\web\V3-RMS\frontend"; pnpm typecheck; pnpm build
```

Zero errors, zero `any` types.
