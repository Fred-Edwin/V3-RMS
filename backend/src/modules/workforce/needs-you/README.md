# Needs you (Segment 6a)

Door: `needs-you/index.ts`. The card, the menu badges, the Director's Overdue list and reminders. No stored "waiting" table: each source lists from its own table, so an answered item disappears by itself.

## What Leave and Conduct call
```ts
registerNeedsYouSource(source: NeedsYouSource): void   // once at start-up; the same id again replaces the first

interface NeedsYouSource {
  id: string; kinds: readonly string[];
  list(subject: AccessSubject, ctx: NeedsYouContext): Promise<NeedsYouRow[]>;
  count?(subject, ctx): Promise<Partial<BadgeCounts>>;        // omit: tallied from list
  overdue?(ctx): Promise<NeedsYouRow[]>;                      // company-wide, for the Director
  remindees?(row, ctx): Promise<string[]>;                    // omit: the site's managers
  undo?(subject, rowId): Promise<void>;                       // the deciding module owns the 30 s window
}
interface NeedsYouRow { id /* '<kind>:<record id>' */; kind; text; opens; badge: BadgeKey | null; since; siteId; siteName; waitingOnRole; personUserId; canRemind }
```
Rules for a source: filter by the viewer's ACTION capability and scope (`sitesFor(subject, 'leave.approve', ctx)`), never a role name; skip sites not in `ctx.enabledSiteIds`; no pay figure in `text`; add a line to the 6b N1 table for any new kind. Leave must emit `leave.requested|decided|moved_up` and Conduct `conduct.appeal_sent|decided` (declared in `_shared/events.ts`, already in the nudge list).

## Endpoints (`/workforce/needs-you`; 404 without the capability)
`GET /` (rows, `total`, `partial`, `isNew`), `GET counts` (`{ total, badges }`), `GET attention` (HR housekeeping), `POST seen`, `POST :id/undo` (404 `UNDO_UNAVAILABLE`), `GET overdue` and `POST :id/remind { idempotencyKey }` (Director, `needs_you.remind`; 403 `REMINDER_ALREADY_SENT`, 404 `ITEM_NOT_OVERDUE`).
Built sources: `time` (overtime, clock fix, shift closed), `month-and-casual`, `pay` (payroll steps, tables, P9), `security`.
