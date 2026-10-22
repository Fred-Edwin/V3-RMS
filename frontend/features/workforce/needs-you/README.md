# Workforce · Needs you

**Status:** reduced in batch 2A (22 Oct 2026, branch `feat/workforce-1-people-batch-2a`, not pushed). Spec: `docs/features/workforce/specs/6b-needs-you-and-messages-spec.md`. Back end: `backend/src/modules/workforce/needs-you/` (API in `docs/API_CONTRACT.md` sections 43 and 47). Decisions: `decisions-6a-frontend.md`, `decisions-1-people-batch-2a.md`.

## What is here now
Only the **menu badge counts**. `useNeedsYouBadges` feeds the numbers and the attention marks on the sidebar (the amber dot with a small number; a red-brown dot where the feature holds overdue items; a closed feature shows the sum, an open feature shows the counts on its sub-links; "99+"). The counts and the Home table come from the same server rows, so a badge cannot disagree with its table.

## Where the rest went
The Needs you card, the Overdue card, the table, the phone cards and their hooks are **deleted**. The Home table and the paged "See all" list at `/app/workforce/needs-you` live in `features/workforce/home/role-home/` and read `GET /workforce/home` and `GET /workforce/needs-you/page`. The Director's separate Overdue card is gone: overdue items lead the one list for every role, and the Director's reminder button is not part of Home.

## Public API (`index.ts`)
`useNeedsYouBadges`, `useNeedsYouMenuCounts`, `badgeText`, `badgeSpoken` and the row types. Other features import from here only.

## Endpoints used
`GET /workforce/needs-you/counts` (now with `overdue`, the same shape as `badges`). The others (`/`, `/page`, `/overdue`, `/seen`, `/:id/undo`, `/:id/remind`) are read by Home or are not drawn in the current designs.

## Where it is registered
Menu badges: `components/app/shell/nav/` (rows per module, `menu.ts`) fed by `components/app/shell/use-shell-nav.ts`.

## Coupling
Leave and Conduct register their rows on the server; nothing here changes when they do. A new row kind needs a line in the server's kind table.

## States
The badges refetch on the `workforce:needs-you` socket event, on tab focus and every 60 s while visible. A failed read shows no number rather than a wrong one.

## Tests
`lib/needs-you-words.test.ts`; menu behaviour in `components/app/shell/nav-menu.test.ts`.
