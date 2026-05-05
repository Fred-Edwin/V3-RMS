> **SEALED — Phase 8 Complete (2026-05-04)**
> This addendum file has been consolidated into the authoritative reference docs:
> - Architecture decisions → docs/TDD.md §§22-25
> - API endpoints → docs/API_CONTRACT.md §§13-17
> - Data model → docs/DATA_MODEL.md
> - Build order → docs/BUILD_ORDER.md §14
> 
> This file is preserved for historical context. Do not update it.

---
# Internal Communications Module — Implementation Context

**Status:** Feature-complete. Deployed and tested in production.
**Feature spec:** `docs/V2-Discovery/INTERNAL-COMMS-SPEC.md`
**UI mockups:** `docs/V2-Discovery/comms-mockups.html`, `docs/V2-Discovery/inbox-redesign-mockup.html`

---

## What Was Built

An in-app professional communications system with three message types:

| Type | Who sends | Who receives |
|---|---|---|
| Direct Messages (DMs) | Any staff member | One other staff member |
| Broadcasts | MANAGER, DIRECTOR | Branch, role group, or company-wide |
| Formal Notices | DIRECTOR | Target branch or role group — requires explicit acknowledgement |

Real-time delivery via Socket.io. FCM push notifications. BullMQ handles 24h/48h formal notice reminder jobs.

---

## UI Architecture — WhatsApp-Style Redesign

The inbox was fully redesigned from a dashboard layout to a WhatsApp-style shell. Key decisions:

### `InboxShell.tsx`
Single component that owns all layout and navigation state. Uses a JS `matchMedia` hook to determine screen size and renders **only one layout tree** at a time (never both mobile and desktop simultaneously). This is critical — CSS `md:hidden` alone doesn't work here because:
1. Shared JSX variables mount in the first DOM position React encounters
2. `overflow-y: auto` on a parent implicitly sets `overflow-x: hidden`, clipping `translateX` animations

**Mobile layout:** Full-screen tab bar + slide-in detail views (`fixed inset-0 z-40 translateX(100%) → translateX(0)`)

**Desktop layout:** Fixed left pane (360px) + right pane. Compose panel uses independent `absolute inset-0` overlay with `translateX(100%) → translateX(0)` animation — NOT a side-by-side 720px slider (which gets clipped by overflow).

### Sidebar collapse
On `/app/inbox` routes, the sidebar auto-collapses to 64px icon-only mode with a dark `#1A0F0A` background. Implemented via `isInboxRoute` in `frontend/app/app/layout.tsx`. A chevron toggle at the top lets users expand/collapse manually.

### Contact Picker filtering
`ContactPickerSheet.tsx` filters out display screens (KDS/BDS) and shows only roles with communication needs, grouped by section:
- Leadership: DIRECTOR, MANAGER
- Finance: ACCOUNTANT
- Floor Staff: WAITER
- Kitchen: CHEF
- Barista: BARISTA

---

## Color System

### Brand palette (warm espresso)
| Token | Hex | Usage |
|---|---|---|
| `[#2C1810]` | Espresso | Headers, outgoing bubbles, primary accent |
| `[#F5F0E8]` | Warm cream | Page background |
| `[#EDE7DC]` | Light tan | Hover states, secondary backgrounds |
| `[#E8E0D5]` | Border tan | Dividers, card borders |
| `[#8B7355]` | Medium tan | Secondary text, timestamps |

### Status color system (broadcasts + notices)
Both broadcasts and notices use the same status color language:

| State | Color | Hex |
|---|---|---|
| Unread / not seen | Slate | `#CBD5E1` dots, `#64748B` labels |
| Read / seen | Blue | `#2563EB` progress bar, `#EFF6FF` header tint |
| Pending acknowledgement | Slate dot in expanded list | — |
| Acknowledged / complete | Green | `#16A34A` check, `#F0FDF4` section tint |
| Action required (recipient banner) | Orange | `#FFF7ED`/`#FED7AA` — functional warning only |

**Notices use the same espresso header and blue tracking panel as broadcasts.** The only orange in notices is the recipient-facing "action required" ack banner — this is intentional as it signals urgency to the recipient, not a branding choice.

### Message thread bubbles
- Outgoing: `bg-[#2C1810] text-[#F5F0E8] rounded-2xl rounded-br-sm`
- Incoming: `bg-white border border-[#E8E0D5] rounded-2xl rounded-bl-sm`

---

## Directory Structure

```
backend/src/
  types/comms.types.ts             ← TypeScript interfaces for API responses
  validators/comms-schemas.ts      ← Zod schemas for all endpoints
  repositories/comms-repository.ts ← All Prisma queries
  services/comms-service.ts        ← Business logic + permission enforcement
  controllers/comms-controller.ts  ← Thin: parse → delegate → respond
  routes/comms-routes.ts           ← Route definitions with auth/RBAC middleware
  jobs/formal-notice-reminders.ts  ← BullMQ job (24h/48h notice reminders)
  sockets/socket-service.ts        ← Socket emitters (includes comms events)

frontend/
  types/comms.ts                   ← Frontend TypeScript interfaces
  types/socket.ts                  ← ServerToClientEvents + ClientToServerEvents
  services/commsService.ts         ← All API calls via apiClient
  store/commsStore.ts              ← Zustand store (unread counts, last received)
  hooks/useCommsSocket.ts          ← Socket.io listeners (called once from layout)
  app/app/inbox/
    page.tsx                       ← Thin shell — renders <InboxShell />
    components/
      InboxShell.tsx               ← All layout + nav state (mobile + desktop)
      ConversationList.tsx         ← DM conversation list with infinite scroll
      MessageThread.tsx            ← Chat thread with bubbles, read receipts, typing
      BroadcastList.tsx            ← Broadcasts tab list with infinite scroll
      BroadcastDetailSheet.tsx     ← Broadcast detail + delivery tracking
      NoticeList.tsx               ← Notices tab list with infinite scroll
      NoticeDetailSheet.tsx        ← Notice detail + ack tracking
      ContactPickerSheet.tsx       ← Staff picker for new DM (grouped by role)
      ComposeBroadcastModal.tsx    ← Broadcast compose form (full-height slide-in)
      IssueNoticeModal.tsx         ← Notice compose form (full-height slide-in)
      TypingIndicator.tsx          ← Three-dot bounce animation
```

---

## Socket Events

All events defined in `frontend/types/socket.ts`.

### Server → Client

| Event | Emitted when | Payload |
|---|---|---|
| `comms:dm_received` | DM sent | `{ conversationId, message: { id, senderId, senderName, bodyHtml, attachmentUrl, attachmentName, createdAt } }` |
| `comms:message_read` | Recipient reads a DM | `{ messageId, conversationId, readAt }` → sender sees blue ticks |
| `comms:broadcast_received` | Broadcast sent | `{ broadcastId, subject, senderName, requiresAck, createdAt }` |
| `comms:broadcast_read` | Recipient opens broadcast | `{ broadcastId, userId, userName, readAt }` → sender's tracking panel updates live |
| `comms:broadcast_acknowledged` | Recipient acks broadcast | `{ broadcastId, userId, userName, acknowledgedAt }` → sender's tracking panel updates live |
| `comms:notice_received` | Notice issued | `{ noticeId, subject, issuerName, createdAt }` |
| `comms:notice_acknowledged` | Recipient acks notice | `{ noticeId, userId, userName, acknowledgedAt }` → issuer's tracking panel updates live |
| `comms:typing_start` | User starts typing in DM | `{ conversationId, userId, userName }` |
| `comms:typing_stop` | User stops typing in DM | `{ conversationId, userId }` |

### Rooms
- `user:{userId}` — personal room, used for DM delivery and read receipts, broadcast/notice tracking updates
- `branch:{organizationId}` — branch room, used for broadcast/notice delivery

---

## Delivery Tracking Panel (Broadcasts + Notices)

Both `BroadcastDetailSheet` and `NoticeDetailSheet` show a collapsed tracking panel for the sender/issuer. Tap to expand into grouped sections.

**Collapsed state:** Progress bar + `x/total` counter + summary text + chevron

**Expanded state (Option B+C hybrid):**
- Broadcasts with `requiresAck`: three groups — Unread → Read (pending ack) → Acknowledged
- Broadcasts without `requiresAck`: two groups — Unread → Read
- Notices: two groups — Pending → Acknowledged

**Real-time updates:** Socket-driven (no polling). When a recipient reads or acks:
1. Backend emits the relevant event to `user:{senderId/issuerId}` room
2. Frontend listener patches the matching row in `statuses` state in-place
3. Progress bar and counters update instantly

---

## Permission Model

| Role | DMs | Broadcasts | Notices |
|---|---|---|---|
| DIRECTOR | Can DM anyone (no org filter) | Can send COMPANY/BRANCH/ROLE_GROUP | Can issue |
| MANAGER | Can DM anyone in own branch | Can send BRANCH/ROLE_GROUP to own branch | Cannot issue |
| ACCOUNTANT/WAITER/CHEF/BARISTA | Can DM anyone in own branch | Cannot send | Cannot issue |
| KDS/BDS display screens | Excluded from contact picker | — | — |

**DIRECTOR `organizationId` = null:** Directors have no branch assignment. Key handling:
- `getConversations` → uses `findConversationsByUserAnyOrg` (no org filter)
- `getOrCreateConversation` → derives org from recipient; falls back to `findFirstOrganizationId()` for cross-branch users (e.g. Director ↔ Accountant, both null org)
- COMPANY-scope broadcasts → anchored to first org's ID as FK; visible to other orgs via OR query: `{ organizationId } OR { scope: 'COMPANY', recipients: { some: { userId: viewerId } } }`

---

## API Contract

`apiClient` automatically unwraps the outer `{ success: true, data: ... }` envelope.

**Exception — paginated lists** send a non-standard shape:
```json
{ "success": true, "data": [...], "pagination": { "page": 1, "perPage": 30, "total": 49, "totalPages": 2 } }
```
After `apiClient` unwrap: `{ data: [...], pagination: {...} }`. Components must use `result.data` for the array.

### Key endpoints
- `POST /comms/conversations` — body: `{ recipientId: string (UUID) }`
- `GET /comms/conversations` — returns `{ conversations, nextCursor }`
- `GET /comms/conversations/:id/messages` — returns `DirectMessageRecord[]`
- `POST /comms/messages/:id` — send DM
- `PATCH /comms/messages/:id/read` — mark DM read (emits `comms:message_read` socket event)
- `GET /comms/broadcasts` — returns `{ data, pagination }`
- `POST /comms/broadcasts` — send broadcast
- `PATCH /comms/broadcasts/:id/read` — mark broadcast read (emits `comms:broadcast_read`)
- `POST /comms/broadcasts/:id/acknowledge` — ack broadcast (emits `comms:broadcast_acknowledged`)
- `GET /comms/broadcasts/:id/status` — sender/director only; returns `BroadcastRecipientStatusRecord[]`
- `GET /comms/notices` — returns `{ data, pagination }`
- `POST /comms/notices` — issue formal notice
- `POST /comms/notices/:id/acknowledge` — ack notice (emits `comms:notice_acknowledged`)
- `GET /comms/notices/:id/status` — issuer/director only; returns `FormalNoticeRecipientStatusRecord[]`

---

## Zustand Store (`frontend/store/commsStore.ts`)

```typescript
{
  unreadDmCount: number
  unreadBroadcastCount: number
  unreadNoticeCount: number
  activeConversationId: string | null
  lastReceivedDm: NewDirectMessagePayload | null
  lastReceivedBroadcast: NewBroadcastPayload | null
  lastReceivedNotice: NewFormalNoticePayload | null
  typingUsers: Record<string, string>   // conversationId → typing user name
}
```

Actions: `setActiveConversationId`, `incrementUnreadDm`, `decrementUnreadDm`, `resetUnreadDm`, `incrementUnreadBroadcast`, `resetUnreadBroadcast`, `incrementUnreadNotice`, `resetUnreadNotice`, `setLastReceivedDm`, `setLastReceivedBroadcast`, `setLastReceivedNotice`, `setTypingUser`, `clearTypingUser`, `resetAll`.

---

## BullMQ Jobs

Queue: `comms` (in `backend/src/config/queues.ts`)
Worker: `commsWorker` (in `backend/src/jobs/workers.ts`)
Job: `formal-notice-reminders.schedule` — runs every 30 minutes
Logic: `backend/src/jobs/formal-notice-reminders.ts`
- 24h pass: finds unacknowledged recipients past 24h, sends FCM reminder, marks `reminder24SentAt`
- 48h pass: finds unacknowledged recipients past 48h, escalates to directors via FCM, marks `escalation48SentAt`

---

## Database Schema

Migration: `backend/prisma/migrations/20260411000000_add_comms_module/`

New models:
- `DirectConversation` — unique per pair; `participantAId < participantBId` (lexicographic) enforced in service
- `DirectMessage` — soft-delete via `deletedAt`; deleted messages render as `[deleted]`
- `Broadcast` — `organizationId` FK required even for COMPANY scope (uses first org as anchor)
- `BroadcastRecipient` — tracks `readAt`, `acknowledgedAt` per user
- `FormalNotice` — append-only HR record
- `FormalNoticeRecipient` — tracks `acknowledgedAt`, `reminder24SentAt`, `escalation48SentAt`

New enum: `BroadcastScope { COMPANY, BRANCH, ROLE_GROUP }`

---

## Known Limitations / Not Yet Built

- Image upload in DM compose (endpoint pending: `POST /comms/messages/:id/upload-image`)
- Online presence dots in conversation list (markup exists, always hidden)
- Quoted reply / message context menu in MessageThread (planned in redesign spec)
- `comms:typing_start/stop` server → client (frontend emits to server; server doesn't yet broadcast to other participant)
- Message search
