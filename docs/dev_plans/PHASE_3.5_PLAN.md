# Phase 3.5 — Navigation, Shell Polish & FCM Web Push: Codex Task List

## Context
Phase 3 is complete.  
Phase 1.5 already delivered reusable navigation and shell components (`BottomNav`, `SidebarNav`, `MobileLayout`, `SidebarLayout`) and restyled core screens.

**Goal:** Wire existing components end-to-end for every role, harden logout/session cleanup, complete FCM web push flow, and run a full design-system polish pass across Phase 1–3 pages.

---

## Implementation Strategy

1. **Audit-first pass (no blind rewrites):**
- Inventory current nav/shell/logout/FCM wiring before edits.
- Mark each BUILD_ORDER 3.5 checklist item as: already done, partial, missing.
- Only patch missing behavior; avoid recreating Phase 1.5 components.

2. **Navigation wiring pass:**
- Centralize role-based nav config in one source of truth (tabs + sidebar sections + routes + icons).
- Ensure active state logic uses `usePathname()`:
  - Exact match for leaf routes.
  - Prefix matching for nested routes (e.g. `/app/orders/new` highlights Orders).
- Verify role coverage:
  - WAITER/CHEF/BARISTA -> `BottomNav`.
  - MANAGER/DIRECTOR/SYSTEM_ADMIN -> `SidebarNav`.
- Add a **dev-only desktop preview mode** for WAITER/CHEF/BARISTA:
  - Controlled by env flag (example: `NEXT_PUBLIC_ROLE_DESKTOP_PREVIEW=false` default).
  - Enabled for local/dev UX testing on desktop.
  - Production behavior remains mobile-first for these roles.

3. **Logout hardening pass:**
- Add `ConfirmDialog` gate before logout executes.
- Logout flow must do all of:
  - `POST /auth/logout`
  - clear auth store/session state
  - remove socket listeners
  - disconnect socket
  - redirect to `/login`
- Ensure entry points:
  - Sidebar bottom (desktop roles)
  - Profile page (all mobile roles)

4. **Layout shell wiring pass:**
- Ensure all authenticated pages are wrapped in the correct shell:
  - `MobileLayout` for WAITER/CHEF/BARISTA pages.
  - `SidebarLayout` for MANAGER/DIRECTOR/SYSTEM_ADMIN pages.
  - `FullscreenLayout` retained for `/app/kitchen` and `/app/barista`.
- Confirm root-level placement:
  - `OfflineBanner` rendered once above shells.
  - `ToastContainer` rendered once at app root.
- For dev-only desktop preview mode:
  - Keep information architecture identical to mobile-role flows.
  - Keep mobile-first interaction model (do not introduce manager-style desktop IA).
  - Maintain full Design System token compliance (colour, typography, shadows, focus, radius).

5. **FCM web push completion pass:**
- Frontend:
  - Verify `firebase` SDK install.
  - Confirm env keys in `frontend/.env.local`.
  - Wire `frontend/lib/firebase.ts` singleton + `isSupported()` guard.
  - Validate `frontend/public/firebase-messaging-sw.js` background notification behavior and click-to-open `/app/orders`.
  - Wire `useFcmToken` in authenticated root layout; register tokens only for WAITER/CHEF/BARISTA; dedupe via localStorage.
- Backend:
  - Confirm `VAPID_KEY` in env schema (optional, graceful no-op when absent).
  - Ensure `fcm-service.ts` uses `authRepository.findFcmToken`, `firebaseMessaging.send`, webpush config, and silent failure handling.

6. **Design System polish pass (25-point checklist):**
- Execute the BUILD_ORDER 3.5 checklist against all Phase 1–3 pages.
- Prioritize global/shared fixes first (layout wrappers, typography classes, focus ring tokens, shadows, page header contract), then page-specific cleanup.
- Keep fixes surgical and consistent with existing design tokens/components.
- Enforce Design System constraints from `docs/DESIGN_SYSTEM.md`:
  - Colour rules (Crema canvas, no pure white/black, restrained Espresso/Amber usage).
  - Typography rules (Cormorant only for display/top greetings, DM Sans for operational UI).
  - Shadow and focus rules (Espresso-tinted shadows only, amber focus ring only).
  - Radius/component contracts (buttons `radius-md`, inputs `radius-sm`, badges `radius-full`, modal/sheet radius spec).
  - Page structure contract (`PageHeader`, separator, consistent content transitions).

7. **Verification + signoff:**
- Automated:
  - `pnpm --dir frontend typecheck`
  - `pnpm --dir frontend build`
  - `pnpm --dir backend build`
  - targeted backend tests for auth/logout/fcm/order notification paths
- Manual QA matrix:
  - all roles: navigation completeness + active state correctness
  - logout from all required surfaces
  - offline/online banner behavior
  - push notification receive + tap deep-link behavior
  - viewport checks at 375px and 1280px

---

## Ordered Task List

### A. Baseline Audit
1. Read required spec sections before edits:
- `docs/CODING_STANDARDS.md` (always)
- `docs/BUILD_ORDER.md` lines 757–879 (Phase 3.5)
- `docs/DESIGN_SYSTEM.md` (polish checklist references)
- `docs/API_CONTRACT.md` auth/device-registration sections
- `docs/context/PHASE_1.5_CONTEXT.md` and `docs/context/PHASE_3_CONTEXT.md`

2. Produce a short implementation gap report:
- Navigation: done/partial/missing by role.
- Logout: done/partial/missing by role/surface.
- Shell wiring: done/partial/missing by route groups.
- FCM: done/partial/missing frontend/backend pieces.
- Design checklist: global gaps vs page-specific gaps.

### B. Navigation Wiring
3. Implement role-nav config map and wire into nav components/layout selectors.
4. Implement robust active route matcher utility (`exact` + `prefix` behavior).
5. Verify all required role tabs/sections/routes/icons from BUILD_ORDER.

### C. Logout Flow
6. Implement shared logout action utility/hook used by sidebar + profile.
7. Add `ConfirmDialog` in all logout entry points.
8. Ensure socket cleanup (`off`/`disconnect`) is always performed on logout.

### D. Shell Wiring
9. Refactor authenticated app layout to enforce correct shell per role.
10. Keep KDS/BDS on `FullscreenLayout` without nav chrome.
11. Ensure `OfflineBanner` + `ToastContainer` are root-singleton components.

### E. FCM Web Push
12. Validate and finalize frontend Firebase client files + service worker.
13. Finalize `useFcmToken` behavior, token dedupe, and silent-failure policy.
14. Validate backend `fcm-service.ts` send payload (webpush + link) and env handling for `VAPID_KEY`.
15. End-to-end test device token registration and notification delivery path.

### F. Design System Premium Pass
16. Apply color/typography/spacing/shadow/focus/component/page-structure checks globally.
17. Resolve page-level inconsistencies on all Phase 1–3 user-facing routes.
18. Ensure loading/empty-state patterns use design-system approved components and tone.
19. Add a compliance checklist artifact to PR notes (or context doc) listing each Design System section and pass/fail status with file references.
20. Validate both default mobile-first rendering and desktop preview rendering (when flag is on) against the same Design System constraints.

### G. Verification and Documentation
21. Run build/typecheck/tests and fix regressions.
22. Execute manual role-based QA checklist from BUILD_ORDER lines 869–879.
23. Update `docs/context/PHASE_3_CONTEXT.md` with a “Phase 3.5 Addendum” (or create `PHASE_3.5_CONTEXT.md` if preferred by repo convention), including:
- What changed
- decisions taken
- known tradeoffs
- verification evidence
- explicit Design System compliance summary

---

## Suggested File Touch List

### Frontend
- `frontend/app/app/layout.tsx` (or equivalent authenticated root layout)
- `frontend/components/navigation/BottomNav.tsx`
- `frontend/components/navigation/SidebarNav.tsx`
- `frontend/components/layout/MobileLayout.tsx`
- `frontend/components/layout/SidebarLayout.tsx`
- `frontend/lib/env.ts` and `frontend/.env.example` (desktop preview feature flag)
- `frontend/hooks/useFcmToken.ts`
- `frontend/lib/firebase.ts`
- `frontend/public/firebase-messaging-sw.js`
- `frontend/app/app/profile/page.tsx` (logout entry)

### Backend
- `backend/src/config/env.ts`
- `backend/src/services/fcm-service.ts`
- `backend/src/repositories/auth-repository.ts` (if token lookup adjustments needed)

### Docs
- `docs/context/PHASE_3_CONTEXT.md` (addendum) or `docs/context/PHASE_3.5_CONTEXT.md`

---

## Exit Criteria
- All BUILD_ORDER Phase 3.5 checklist items (lines 767–879) are complete.
- No role has broken navigation or missing shell.
- Logout is confirmed from every required surface with full cleanup.
- FCM web push works in background and deep-links correctly on tap.
- Design-system checklist passes across Phase 1–3 pages.
- Compliance is traceable to `docs/DESIGN_SYSTEM.md` sections (colour, typography, spacing/layout, shadows, radius, components, motion, interface patterns).
- Dev-only desktop preview exists behind a feature flag, with production defaults unchanged.
- Builds/typechecks/tests pass and context docs are updated.
