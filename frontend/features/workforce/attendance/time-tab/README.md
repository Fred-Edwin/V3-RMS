# Attendance · Time tab (Schedule V1, front end)

The **Time** tab on the employee file and the three **Overview tiles**, from Paper page "Workforce · Schedule · V1", frames 1.1 to 1.5. **Status: built, awaiting the owner's review** (24 Oct 2026, branch `design/workforce-2-v1`, nothing pushed). Back end: `backend/src/modules/workforce/attendance/time-tab/`; API in `docs/API_CONTRACT.md` section 48.

## What is here

| File | Does |
|---|---|
| `components/time-tab.tsx` | `TimeFileTab`: month picker, late line, figures, chips, days, pager, Edit time. Keeps the last answer on screen while a new month or page loads |
| `components/time-parts.tsx` | Month picker, five figures, chips, loading, busy and error card, empty card, the dashed "space kept" note |
| `components/day-table.tsx` | The days, newest first. Today tinted. "Edit time" only when `canEditTime` |
| `components/time-pager.tsx` | Numbered pages and rows per page (10, 25, 50), server-paged (UI_BUILD_RULES 4a) |
| `components/overview-tiles.tsx` | `TimeTiles`: On time, Overtime, Leave left (T2) |
| `hooks/use-time-month.ts` | T1 and T2 as `Remote`s |
| `lib/time-view.ts` | Every word and figure, pure (tested) |

Public face: `TimeFileTab` and `TimeTiles` from `features/workforce/attendance` (`index.ts`). People's file screen imports them from there.

## Rules

- **Who sees it:** the tab is offered only with `timesheet.read` (`tabsFor(file, { time })` in People); a department head has none, so the tab is left out, never greyed. "Edit time" follows the server's `canEditTime` (it is false on the viewer's own file and for the Accountant). No role list anywhere.
- The "Late 12 min" tag uses `minutesAfterGrace`, so the row agrees with "20 minutes in total".
- A person who does not clock: the card stands alone (no picker). A branch whose clock is off: picker and card.
- Leave left reads "Not set / No leave rule for this position yet" until the Leave section holds balances.
- The wire spells the branch `organizationName` and `organizationId` (not `siteName`/`siteId` as section 48 prints them); the types follow the wire.

## Tests

`lib/time-view.test.ts`: hours words, months, date column, late line (incl. "Read only for your role."), the five figures, a day in every state, empty and error copy, tiles, pager window. People's `file-model.test.ts` covers the tab rule.

## Not here

Time tab on a phone (no role uses it), Unaccounted items and lateness actions (V3, V4), leave balances (section 7).
