# Workforce · Notifications

Status: built and walked in a real browser (21 Oct 2026, branch `feat/workforce-6a-shared-frontend`, not pushed). Spec: `6b-needs-you-and-messages-spec.md` (delivery). Back end: `backend/src/modules/workforce/notifications/`.

## What it is
The **Notifications tab** in the Inbox (`app/app/inbox/components/InboxShell.tsx`, one change) and the unread number on the shell's Inbox badge. The server writes the wording at send time (never a money figure or a conduct reason); this sub-module only lists, opens and marks read.

- A list with an unread dot, the kind, the time, the text and an **Open** link where there is a page to go to; **Mark all read**; numbered pager with rows per page.
- The unread number comes from `GET /workforce/notifications/unread-count` into a small store, so the shell badge and the tab agree. It refreshes on the socket nudge, on tab focus and every 60 s while visible.

**Batch 2A (22 Oct 2026):** Home's "Latest" list and the bell's unread count (top bar, phone band; "99+" above 99) read this feature: the list comes with `GET /workforce/home` (`latest`) and the count from the unread store below. "Mark all read" on Home calls the same endpoint as the tab. Home keeps no copy of the rows.

**The bell (22 Oct 2026, Paper 13.1 and 13.2):** on a desktop the bell opens a **right-hand drawer** (`NotificationsDrawer`, mounted once in `app/app/workforce/layout.tsx`, opened through `useOpenNotifications`); on a phone the bell goes to a **full page** (`NotificationsScreen`, `/app/workforce/notifications`). Both draw the same `notification-list`: a search box, area chips with their counts, rows grouped by day, a "You are all caught up" state, Escape and the Close button. Opening a row marks it read and closes the drawer. Not walked: page 2, rows per page, and focus returning to the bell.

## Public API (`index.ts`)
`NotificationsTab`, `NotificationsScreen`, `NotificationsDrawer`, `useOpenNotifications`, `useWorkforceUnread`, `useWorkforceUnreadCount`, `useUnreadStore`, `notificationWrites`, `safeHref`, `whenWords`, `WorkforceNotification`.

## Endpoints
`GET /workforce/notifications?unread=&area=&q=&page=&pageSize=` (answers `items`, `total`, `all`, `areas[]`, `unread`; see `docs/API_CONTRACT.md` section 47), `GET /workforce/notifications/unread-count`, `POST /workforce/notifications/read { ids }`, `POST /workforce/notifications/read-all`. Own notifications only.

## States
Loading, "No notifications" empty state, error with Try again, no signal.

## Tests
`lib/notification-words.test.ts`; back end `notifications` tests for `area`, `q`, `all` and `areas`.
