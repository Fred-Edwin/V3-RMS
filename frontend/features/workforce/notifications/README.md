# Workforce · Notifications

Status: built and walked in a real browser (21 Oct 2026, branch `feat/workforce-6a-shared-frontend`, not pushed). Spec: `6b-needs-you-and-messages-spec.md` (delivery). Back end: `backend/src/modules/workforce/notifications/`.

## What it is
The **Notifications tab** in the Inbox (`app/app/inbox/components/InboxShell.tsx`, one change) and the unread number on the shell's Inbox badge. The server writes the wording at send time (never a money figure or a conduct reason); this sub-module only lists, opens and marks read.

- A list with an unread dot, the kind, the time, the text and an **Open** link where there is a page to go to; **Mark all read**; numbered pager with rows per page.
- The unread number comes from `GET /workforce/notifications/unread-count` into a small store, so the shell badge and the tab agree. It refreshes on the socket nudge, on tab focus and every 60 s while visible.

## Public API (`index.ts`)
`NotificationsTab`, `useWorkforceUnread`, `useWorkforceUnreadCount`, `WorkforceNotification`.

## Endpoints
`GET /workforce/notifications?unread=&page=`, `GET /workforce/notifications/unread-count`, `POST /workforce/notifications/read { ids }`, `POST /workforce/notifications/read-all`. Own notifications only.

## States
Loading, "No notifications" empty state, error with Try again, no signal.

## Tests
`lib/notification-words.test.ts`.
