# Workforce · Sign-in

The sign-in screens, built to the approved Paper frames 3.1, 3.2 and 4.1 to 4.5 (page "Workforce · Final pass designs"). Route: `app/(auth)/login/page.tsx`, a thin shell around `SigninScreen`.

## What it does
Password ("Welcome back") → This device ("Confirm this device", once per person per browser) → Set your PIN (only a person with no PIN yet) → the person's Home. The session is set only at the end. "Not you? Sign out" returns to the password step.

## Status
Built (batch 2A part 1). Not yet seen in a browser: part 2 compares every state at 1440 and 390 with Paper.

## Rules that are decisions
- **Nobody is locked out.** After the 5th wrong password in 15 minutes the server answers `429 LOGIN_SLOWED` with `details.waitSeconds` (2, 4, 8, 16, then 30). The screen shows the seconds and counts down. The pause is `backend/src/modules/workforce/_shared/pin/pin-pause.ts`, shared with the PIN checks; the tries are recorded under purpose `PASSWORD`.
- **The device step is local.** The server has no device trust yet, so "Trust this device" is remembered in this browser only (`wendo.trusted-device.<userId>`) and nothing is sent. The copy says what it does ("We ask once on each new device, so you know where you are signed in"), not that devices are checked. The place chip is the person's branch (or "Company"), never a guess from the network.
- **No "Real-time visibility".** Not true of the product everywhere; the first proof point reads "Every branch in one place".
- **Session ended** reads "You were signed out. Sign in to carry on." (Paper says "because you were away for a while"; nobody is signed out for being away.)
- The two kitchen display roles skip the device and PIN steps (shared screens).

## Endpoints
`POST /auth/login`, `GET /users/me/pin-status`, `POST /users/me/pin`, `POST /auth/logout`.

## Coupling
`lib/role-home.ts` (where each role lands), `components/app/shell/role-label.ts`, `store/authStore.ts`.
