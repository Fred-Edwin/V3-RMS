# Workforce notifications (Segment 6a)

One door: `notifications/index.ts`. Leave and Conduct call it; the built segments reach it through `told()` (`people/people-context.ts`), which `registerWorkforceNotifier()` points here.

```ts
notify(userId: string, kind: string, data?: NotifyData, options?: { dedupeKey?: string; replace?: boolean }): Promise<void>
notifyMany(userIds: readonly (string | null | undefined)[], kind: string, data?: NotifyData, options?: NotifyOptions): Promise<void>
nudgeUsers(userIds: readonly string[], event: 'workforce:notifications' | 'workforce:needs-you'): void
renderNotification(kind, data), knownKinds(), dayLabel / monthName / roleLabel / plural   // wording helpers
```

- `kind` is a key of the server wording table (`wording/wording-built.ts`, `wording/wording-shared.ts`). Wording is rendered at send time, so a stored row never changes. Add a kind there with its tone, title, body, href and `push`.
- `data` holds short facts: names with roles, dates, month keys, counts. Never a pay figure, a code, a PIN or a conduct reason (the renderer refuses a figure).
- Channels: an Inbox row (`workforce_notifications`), a socket nudge, an FCM push. Quiet hours: an information push 22:00 to 05:00 Nairobi is held by the job `workforce.notice.dispatch`; the row appears at once.
- `dedupeKey` makes a repeat a no-op; build it from kind, subject and a day or 15 minute window. `replace` rewrites the existing row.
- Best effort: these never throw into the change that has already committed.
- Endpoints (capability `notifications.own`, own rows only): `GET /workforce/notifications`, `GET .../unread-count`, `POST .../read`, `POST .../read-all`.
- The worker process cannot reach browser sockets; screens refetch on focus and every 60 s.
