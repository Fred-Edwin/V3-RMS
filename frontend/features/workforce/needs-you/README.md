# Workforce · Needs you

Status: built and walked in a real browser (21 Oct 2026, branch `feat/workforce-6a-shared-frontend`, not pushed). Spec: `docs/features/workforce/specs/6b-needs-you-and-messages-spec.md`. Back end: `backend/src/modules/workforce/needs-you/`. Decisions: `docs/features/workforce/decisions-6a-frontend.md`.

## What it is
Everything that needs one person's decision, in one place. It replaces the old "Waiting for you", "Overdue approvals" and pay-steps cards.

- **Needs you card** on each Home (Branch Manager, Store Manager, HR, Accountant, System Admin; the Director only when they have rows of their own). A table (kind, request, where you decide, since) with search and Kind chips and a numbered pager above 25 rows; on a phone, one card per row with a 44 px **Open** button. Each row opens the page where the decision is made. A card with no rows disappears (the Home shows its empty state).
- **Menu badges**: `useNeedsYouBadges` feeds the numbers on the Workforce menu rows (`workforce-timesheets`, `-leave`, `-conduct`, `-payroll`, `-security`). The counts and the card come from the same server rows, so a badge cannot disagree with its card.
- **Overdue** (Director): anything that has waited more than 3 days anywhere in the company, in a table with a drawer. The Director only sends a reminder (one per item per day, logged); leave is the one exception and is decided by HR.

## Public API (`index.ts`)
`NeedsYouCard`, `OverdueCard`, `useNeedsYou`, `useNeedsYouBadges`, `useOverdue`, `badgeText`, `badgeSpoken` and the row types. Other features import from here only.

## Endpoints
`GET /workforce/needs-you`, `GET /workforce/needs-you/counts`, `GET /workforce/needs-you/overdue`, `POST /workforce/needs-you/seen` (the Home was opened: clears "new"), `POST /workforce/needs-you/:id/undo` (an answered row can be undone for 30 seconds), `POST /workforce/needs-you/:id/remind`. A person without the capability gets **404**, not 403.

## Where it is registered
- Home cards: `features/workforce/home/cards/needs-you-cards.tsx` (`workforce.needs-you`, `workforce.overdue`).
- Menu badges: `components/app/shell/nav-table.ts` (`BADGE_CAPABILITY`) fed by `components/app/shell/use-shell-nav.ts`.

## Coupling
Leave and Conduct register their rows on the server; nothing here changes when they do. A new row kind needs a line in the server's kind table.

## States
Loading skeleton, "Nothing needs you" (States kit copy), error with Try again and a reference, no signal. Refetch on the `workforce:needs-you` socket event, on tab focus and every 60 s while visible.

## Tests
`components/needs-you-components.test.ts`, `lib/needs-you-words.test.ts`.
