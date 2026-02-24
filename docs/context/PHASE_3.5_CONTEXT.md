# Phase 3.5 - Context (Living File)

This file records implementation and verification for Phase 3.5 (Navigation, Shell Polish, and FCM Web Push), including the centralized notifications add-on.

---

## Status
- [x] Phase 3.5 In Progress
- [ ] Phase 3.5 Complete

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
- [x] Service worker present at `frontend/public/firebase-messaging-sw.js` with click-to-open behavior.
- [x] Added FCM environment wiring (`frontend/lib/env.ts`, `frontend/.env.example`).
- [x] Backend FCM service upgraded to no-op safely when `VAPID_KEY` is missing.
- [x] Device registration path wired through `/auth/register-device`.

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
  - Waiter receives `order:all_ready` sound + toast.
  - Waiter receives `order:claimed` toast-only.
- Soft prompt strategy is mandatory for web push UX: permission requests are user-initiated, not automatic on app load.
- Notification sound playback is best-effort and non-blocking; audio failures never block workflow actions.
- Rollout safety is controlled with `NEXT_PUBLIC_NOTIFICATIONS_V2` so behavior can be reverted quickly if needed.

---

## Verification Evidence
- [x] `pnpm --dir frontend typecheck`
- [x] `pnpm --dir frontend build`
- [x] `pnpm --dir backend build`
- [x] `pnpm --dir backend test -- tests/prep-ticket.test.ts`

Manual QA status (latest reported):
- [x] Most role navigation/logout checks passed.
- [x] Profile and history behavior validated.
- [ ] Real-device/browser FCM prompt + delivery matrix still requires full final pass.
- [ ] Final sound-behavior pass across all events/roles still needs confirmation in live flow.

---

## Blockers / Issues
- Web push behavior depends on browser support, HTTPS/deployment context, and real-device testing; emulator/desktop-only checks are insufficient for final signoff.
- Notification behavior parity for all role/event combinations should be re-validated after centralized module rollout (especially claim/ready audible cues).

---

## Notes for Next Phase (Phase 4)
- Keep notifications modular by extending `frontend/lib/notifications/*` rather than reintroducing component-local side effects.
- Reuse existing event names (`order:new`, `order:claimed`, `order:all_ready`) to preserve socket contract compatibility.
- Maintain `NEXT_PUBLIC_NOTIFICATIONS_V2` until production stabilization window is complete; remove flag only after confirmed parity.
