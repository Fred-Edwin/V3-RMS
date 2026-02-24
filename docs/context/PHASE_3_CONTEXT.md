# Phase 3 - Context (Living File)

This file captures what was implemented for Phase 3 (Order Management), key decisions, and follow-up notes for Phase 4.

---

## Status
- [x] Phase 3 In Progress
- [x] Phase 3 Complete

---

## Completed Tasks
### Backend
- [x] Added full order endpoints:
  - `POST /api/v1/orders`
  - `GET /api/v1/orders`
  - `GET /api/v1/orders/active`
  - `GET /api/v1/orders/:id`
  - `PATCH /api/v1/orders/:id/items`
  - `PATCH /api/v1/orders/:id/payment`
  - `PATCH /api/v1/orders/:id/cancel`
- [x] Added prep ticket endpoints:
  - `GET /api/v1/prep-tickets`
  - `PATCH /api/v1/prep-tickets/:id/claim`
  - `PATCH /api/v1/prep-tickets/:id/ready`
- [x] Implemented order business logic:
  - Menu item availability validation per branch
  - Price snapshotting (`OrderItem.unitPrice`)
  - Subtotal, delivery fee, total calculations
  - Daily number generation inside DB transaction with retry on unique conflict
  - Prep ticket routing by station (`KITCHEN`, `BARISTA`)
  - Order status derivation through prep ticket flow
  - Order modification guards and prep-ticket JSON snapshot regeneration
- [x] Implemented socket layer updates:
  - Authenticated socket handshake with JWT
  - Room joins: `join:branch`, `join:station`, `join:user`
  - Emissions: `order:new`, `order:claimed`, `order:ready`, `order:all_ready`, `order:modified`, `order:cancelled`
- [x] Added FCM integration:
  - Firebase config (`FIREBASE_SERVICE_ACCOUNT_JSON`)
  - FCM push to waiter when order is fully ready
  - Silent error handling so mark-ready flow does not fail
- [x] Added backend tests for order routes, prep-ticket routes, order utils, socket events, and order-service unit behavior

### Frontend
- [x] Added Phase 3 order/prep-ticket domain types and socket event typings
- [x] Added order and prep-ticket services
- [x] Added Zustand stores:
  - `useOrderStore` (active orders + cart + real-time helpers)
  - `useKitchenStore` (pending/in-progress/ready partitions + real-time helpers)
- [x] Added hooks:
  - `useActiveOrders`
  - `usePrepTickets`
  - `useOrderHistory`
  - `usePrepTicketHistory`
- [x] Added order/kitchen/dashboard components:
  - `CartBottomSheet`
  - `OrderConfirmBottomSheet`
  - `OrderDetailBottomSheet`
  - `OrderHistoryRow`
  - `KDSColumn`
  - `ClaimTicketSheet`
  - `DisplayBoard`
  - `ActiveOrdersSummary`
- [x] Implemented pages:
  - `/app/dashboard` (role-aware waiter/chef/barista dashboards)
  - `/app/orders/new`
  - `/app/orders`
  - `/app/orders/[id]/edit`
  - `/app/history` (role-aware waiter vs prep-ticket history)
  - `/app/kitchen`
  - `/app/barista`
- [x] Added animation class `.animate-cart-nudge`
- [x] Added `frontend/public/sounds/.gitkeep` placeholder
- [x] Added Firebase web setup for push notifications:
  - `frontend/lib/firebase.ts`
  - `frontend/public/firebase-messaging-sw.js`
  - `frontend/hooks/useFcmToken.ts` (staff-role token registration to `/auth/register-device`)
- [x] Added resilient async UX on critical order actions:
  - KDS/BDS claim + mark-ready loading states and duplicate-click guards
  - Waiter confirm-payment loading state and duplicate-submit guard
  - Toast-based error handling for claim/ready/payment/order-detail fetch failures (prevents unhandled runtime errors)
- [x] Improved KDS/BDS claim usability:
  - Staff selector fallback to active-role staff when no one is clocked in (dev/testing support)
  - Helper messaging when fallback list is shown
- [x] Fixed waiter dashboard aggregation behavior:
  - `Orders Today`, `Total Value Today`, and `Last 5 Orders` now load from `GET /orders?date=YYYY-MM-DD`
  - Closed orders are now included in dashboard daily metrics/lists as expected

### Verification
- [x] `pnpm --dir backend build`
- [x] `pnpm --dir backend test`
- [x] `pnpm --dir frontend build`
- [x] `pnpm --dir frontend typecheck`
- [x] Re-verified after post-implementation fixes:
  - `pnpm --dir frontend typecheck`
  - `pnpm --dir backend build`
  - `pnpm --dir backend test -- tests/prep-ticket.test.ts`

---

## Decisions Made
- Daily number generation uses transaction-time counting with unique constraint retry to avoid duplicate `(organizationId, orderDate, dailyNumber)` under concurrency.
- FCM failures are swallowed and logged at warning level so prep flow remains resilient.
- Firebase service-account parsing supports both camelCase (`projectId`, `clientEmail`, `privateKey`) and standard Firebase snake_case (`project_id`, `client_email`, `private_key`) keys from downloaded JSON files.
- Added a dev-only claim helper flag `SKIP_SHIFT_VALIDATION` (default `false`) to bypass shift clock-in checks while keeping station-role and active-user validation.
- `DisplayBoard` is shared between KDS and BDS to avoid duplicated logic while preserving station-specific behavior.
- Dashboard/history/kitchen/barista rendering is role-aware instead of creating fully separate role pages.
- `CreateOrderSchema` includes `DELIVERY`; full delivery workflow integrations (external handoff, expanded UX) remain for Phase 4.
- Socket room naming conventions:
  - `branch:{orgId}:kitchen`
  - `branch:{orgId}:barista`
  - `user:{userId}`
- Reconnect sync pattern is centralized via `onReconnect` helper in `frontend/lib/socket.ts`.
- Waiter dashboard daily KPIs use `GET /orders` filtered by date (not `GET /orders/active`) so closed orders contribute to same-day totals.
- Active order summary cards remain sourced from `GET /orders/active` to preserve live operational state visibility.

---

## Blockers / Issues
- No blocking implementation issues remain for Phase 3.
- Existing test environment still logs non-failing `ioredis` connection warnings when Redis is unavailable.
- `SKIP_SHIFT_VALIDATION=true` is intended for development/testing only and should stay `false` in production.

---

## Notes for Next Phase (Phase 4)
- Place a real audio file at `frontend/public/sounds/new-order.mp3` before deployment; current repository includes only placeholder structure.
- Web push implementation requires both backend `VAPID_KEY` and frontend `NEXT_PUBLIC_FIREBASE_VAPID_KEY`; both are now wired in code.
- Delivery order type is supported in contracts and backend validation; expanded delivery lifecycle and external dispatch integrations should be completed in Phase 4.
- Current socket room/event naming should be reused by any Phase 4 notification features to preserve compatibility.

---

## Phase 3.5 Addendum - Navigation, Shell Polish & FCM Web Push

### Implemented
- Added authenticated role-shell layout at `frontend/app/app/layout.tsx`:
  - WAITER/CHEF/BARISTA use `MobileLayout` + role-specific `BottomNav` by default.
  - MANAGER/DIRECTOR/SYSTEM_ADMIN use `SidebarLayout` + role-specific `SidebarNav`.
  - KDS/BDS routes (`/app/kitchen`, `/app/barista`) remain fullscreen without nav shell.
- Added dev-only desktop preview toggle for mobile-first roles:
  - `NEXT_PUBLIC_ROLE_DESKTOP_PREVIEW` in frontend env.
  - Production behavior remains unchanged (mobile-first shell for WAITER/CHEF/BARISTA).
- Implemented logout hardening:
  - Shared logout helper `frontend/lib/logout.ts`.
  - Logout confirm dialog in app shell sidebar and profile page.
  - Socket cleanup on logout via `disconnectSocket()` with listener teardown.
- Fixed profile data hydration bug:
  - Backend `/auth/refresh` now returns `user` along with `accessToken`.
  - Frontend auth store hydrates full `user` object from refresh response.
  - Profile page now consistently loads personal details after reload/session restore.
- Completed FCM web push wiring refinements:
  - Service worker now handles notification click and opens/focuses `/app/orders`.
  - Backend `fcmService` gracefully no-ops when `VAPID_KEY` is absent.
  - `VAPID_KEY` env schema updated to optional (safe fallback behavior).
- Design-system polish pass on placeholder operational pages:
  - Migrated placeholder screens to shared `PageLayout` + `PageHeader` + `EmptyState`.
  - Added consistent `animate-fade-up` usage for page content containers.
  - Updated `PageLayout` to `px-4` mobile / `px-8` desktop and `max-w-[1280px] mx-auto`.

### Verification Matrix
- Automated checks:
  - [x] `pnpm --dir frontend typecheck`
  - [x] `pnpm --dir backend build`
  - [x] `pnpm --dir backend test -- tests/auth.test.ts`
  - [ ] `pnpm --dir frontend build` (blocked in this run by DNS resolution failure to `fonts.googleapis.com`, not by TypeScript/runtime code errors)
- Manual checks completed in code path review:
  - [x] Logout confirm flow present in sidebar shell and profile page.
  - [x] Logout clears auth + disconnects socket client instance.
  - [x] FCM service worker background handler present.
  - [x] Notification click opens/focuses `/app/orders`.
  - [x] Root-level `OfflineBanner` and `ToastContainer` remain singleton in `frontend/app/layout.tsx`.
  - [x] KDS/BDS kept fullscreen without nav shell.
- Manual browser/device QA still required:
  - [ ] Role-by-role nav traversal (all tabs/links and active states)
  - [ ] Push notification delivery/tap on real device/browser
  - [ ] Offline/online banner behavior in browser
  - [ ] 375px and 1280px viewport visual audit
