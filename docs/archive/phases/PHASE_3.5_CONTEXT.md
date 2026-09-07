# Phase 3.5 - Context (Living File)

This file records implementation and verification for Phase 3.5 (Navigation, Shell Polish, and FCM Web Push), including the centralized notifications add-on.

---

## Status
- [x] Phase 3.5 In Progress
- [x] Phase 3.5 Complete

---

## Completed Tasks
### Navigation and Shell Wiring
- [x] Wired role-based authenticated shell in `frontend/app/app/layout.tsx`.
- [x] Mobile-first shell retained for `WAITER`, `CHEF`, and `BARISTA`.
- [x] Sidebar shell retained for `MANAGER`, `DIRECTOR`, and `SYSTEM_ADMIN`.
- [x] KDS/BDS fullscreen behavior preserved for display roles while allowing chef/barista dev desktop preview shell.
- [x] Added dev-only desktop preview flag `NEXT_PUBLIC_ROLE_DESKTOP_PREVIEW` (default `false`).

### Logout and Session Cleanup
- [x] Added shared logout helper `frontend/lib/logout.ts`.
- [x] Added confirm-logout UX in profile and sidebar flows.
- [x] Logout clears auth session and disconnects socket listeners cleanly.

### FCM Web Push
- [x] Frontend Firebase client initialized in `frontend/lib/firebase.ts`.
- [x] Service worker generated at build time from `frontend/public/firebase-messaging-sw.template.js` with click-to-open behavior.
- [x] Firebase config injected at build time via `frontend/next.config.mjs`; generated `firebase-messaging-sw.js` is gitignored.
- [x] Added FCM environment wiring (`frontend/lib/env.ts`, `frontend/.env.example`).
- [x] Backend FCM service upgraded to no-op safely when `VAPID_KEY` is missing.
- [x] Device registration path wired through `/auth/register-device`.
- [x] FCM registration extended to `KITCHEN_DISPLAY` and `BARISTA_DISPLAY` roles (previously only WAITER/CHEF/BARISTA).

### Centralized Notification Module (Phase 3.5 Add-on)
- [x] Added modular notification layer:
  - `frontend/lib/notifications/types.ts`
  - `frontend/lib/notifications/policy.ts`
  - `frontend/lib/notifications/sound-player.ts`
  - `frontend/lib/notifications/dispatcher.ts`
- [x] Added `frontend/hooks/useNotifications.ts` as single socket -> notification bridge.
- [x] Wired notifications in `frontend/components/app/SessionBootstrap.tsx`.
- [x] Removed wrangled direct sound orchestration from KDS/BDS hot path; centralized dispatch now controls sound/toast behavior.
- [x] Added feature flag `NEXT_PUBLIC_NOTIFICATIONS_V2` (default enabled unless explicitly set to `false`).
- [x] Added/standardized sound assets:
  - `frontend/public/sounds/new-order.mp3`
  - `frontend/public/sounds/claimed.mp3`
  - `frontend/public/sounds/all-ready.mp3`

### Notification Bug Fixes (Post-Audit)
Ten bugs identified in a full notification audit were fixed:

- [x] **BUG 1** — `order:ready` (individual station done) was emitted by backend but never consumed on frontend. Added event type, policy branch (WAITER toast-only), sound mapping, and socket listener in `useNotifications`.
- [x] **BUG 2** — Waiter order-placement feedback already present via page-level toast in `orders/new/page.tsx`; no pipeline change required.
- [x] **BUG 3** — `recordPayment` emitted no socket event. Added `emitOrderPaid` to `socket-service.ts` and wired it from `order-service.ts`. Frontend handles `order:paid` with WAITER sound + toast.
- [x] **BUG 4** — Covered by BUG 1 fix; KDS receives `order:modified` updates via `usePrepTickets` for real-time state.
- [x] **BUG 5** — Dead legacy sound `useEffect` in `DisplayBoard` (fired on `pendingTickets.length` change) deleted. Was unreachable since `notificationsV2` defaults to true.
- [x] **BUG 6** — Socket room joins now deferred to the `connect` event handler in `useNotifications`, preventing join emissions before server-side auth middleware completes.
- [x] **BUG 7** — `dailyNumber` was missing from `OrderClaimedPayload`. Added to backend interface and `emitOrderClaimed` call; forwarded through frontend handler so waiter toast shows correct order number.
- [x] **BUG 8** — `KITCHEN_DISPLAY` and `BARISTA_DISPLAY` excluded from FCM registration. Added both to `notificationRoles` in `useFcmToken.ts`.
- [x] **BUG 9** — `dedupeWindowByKey` map grew unbounded. Added `pruneStaleDedupe()` to evict entries older than 30 s on each dispatch.
- [x] **BUG 10** — `firebase-messaging-sw.js` contained hardcoded Firebase project credentials. Replaced with build-time injection from `NEXT_PUBLIC_*` env vars via `next.config.mjs`.

### FCM Soft Prompt UX
- [x] Refactored `useFcmToken` to passive mode (no auto permission prompt on app load).
- [x] Added user-initiated enable flow:
  - waiter dashboard prompt action
  - profile page prompt action
- [x] Added localStorage dedupe/dismiss behavior keyed by user.

### Data/QA Fixes Landed During Phase 3.5
- [x] Profile data hydration fixed by returning `user` from backend refresh flow and hydrating store correctly.
- [x] Improved dashboard metrics sourcing for prep roles (chef/barista) to use prep ticket history aggregation logic.
- [x] Hardened offline refresh behavior to avoid unnecessary auth wipe on transient network failures.

---

## Decisions Made
- Centralized notification orchestration was chosen to enforce separation of concerns and prevent duplicated event handling across UI components.
- Notification policy is role-aware and event-aware:
  - Prep roles receive `order:new` sound + toast.
  - Waiter receives `order:claimed` toast-only (with order number).
  - Waiter receives `order:ready` toast-only (partial station signal, no sound).
  - Waiter receives `order:all_ready` sound + toast.
  - Waiter receives `order:paid` sound + toast.
- Soft prompt strategy is mandatory for web push UX: permission requests are user-initiated, not automatic on app load.
- Notification sound playback is best-effort and non-blocking; audio failures never block workflow actions.
- Rollout safety is controlled with `NEXT_PUBLIC_NOTIFICATIONS_V2` so behavior can be reverted quickly if needed.
- `order:ready` (single station) uses toast-only to distinguish it from `order:all_ready` (which uses sound) and avoid alert fatigue in multi-station orders.

---

## Verification Evidence
- [x] `pnpm tsc --noEmit` (frontend) — clean
- [x] `pnpm tsc --noEmit` (backend) — clean
- [x] `pnpm test` (backend) — 113/113 passed
- [x] `pnpm --dir frontend typecheck`
- [x] `pnpm --dir frontend build`
- [x] `pnpm --dir backend build`
- [x] `pnpm --dir backend test -- tests/prep-ticket.test.ts`

Manual QA status (latest reported):
- [x] Most role navigation/logout checks passed.
- [x] Profile and history behavior validated.
- [x] KDS/Chef tab receives `order:new` sound + toast on order placement — confirmed.
- [x] Waiter page-level toast fires on order placement — confirmed.
- [ ] Real-device/browser FCM prompt + delivery matrix still requires full final pass.
- [ ] `order:ready`, `order:all_ready`, `order:paid` socket events — live flow confirmation pending.

---

## Blockers / Issues
- Web push behavior depends on browser support, HTTPS/deployment context, and real-device testing; emulator/desktop-only checks are insufficient for final signoff.

---

## Notes for Next Phase (Phase 4)
- Keep notifications modular by extending `frontend/lib/notifications/*` rather than reintroducing component-local side effects.
- Reuse existing event names (`order:new`, `order:claimed`, `order:ready`, `order:all_ready`, `order:paid`) to preserve socket contract compatibility.
- `NEXT_PUBLIC_NOTIFICATIONS_V2` flag can be removed once production stabilization window is complete; all paths now flow through the V2 pipeline.
