# Feature Spec: Communications & Notifications
## Wendo Coffee Bistro — RMS V2.4
**Status:** Draft — Open questions remain (see Section 9)
**Phase:** V2.4
**Last Updated:** 2026-03-22

---

## 1. Overview

V1 notifications are system-generated operational alerts — order ready, shift reminder, new order arrived. There is no person-to-person communication within the system. Wendo's internal communications currently happen on WhatsApp: policy changes, HR notices, meeting schedules, and operational updates all mix together in group chats with no structure, no record, and no guarantee of delivery.

V2.4 builds two things:
1. **Enhanced operational notifications** — smarter, broader, harder to miss
2. **In-app professional communication** — broadcast announcements, direct messages, formal HR notices

**Primary problem it solves:** Critical business communication has no professional home. Important information gets lost in WhatsApp noise. Formal HR correspondence has no timestamped record.

---

## 2. Two Distinct Layers

### Layer 1 — Enhanced Operational Notifications

Extends V1's FCM-based push notifications with:
- **Requisition dispatched** — Branch Manager is notified when their requisition has been sent from the Central Kitchen
- **Delivery confirmed** — Store Manager is notified when a branch confirms receipt
- **Rider ready** — Delivery rider receives notification when an order is ready for collection
- **Shift reminders** — Already in V1; enhanced to require acknowledgement
- **Low stock alerts** — Branch Manager notified when an item approaches zero (from V2.1 inventory)

The key enhancement: certain notifications require an **explicit acknowledgement** from the recipient before they are dismissed. Unacknowledged notifications are re-sent at intervals. The exact notification types requiring acknowledgement are a pending scoping decision.

### Layer 2 — In-App Professional Communication

New capability. Three communication types:

**Broadcast Announcements:** One-to-many messages from management to a defined audience. Scoped to: the whole company, a specific branch, or a specific role group (e.g. all Waiters). Can optionally require acknowledgement.

**Direct Messages:** 1:1 professional messages between managers/supervisors and staff. Logged within the system. Not a chat — a professional correspondence channel.

**HR Formal Notices:** Direct messages linked to the HR module. When a disciplinary record is created or a formal notice is sent, it is delivered as a Direct Message and attached to the staff member's record. Timestamped and permanent.

---

## 3. Actors

| Actor | Role | Can Broadcast | Can Direct Message | Can Receive |
|---|---|---|---|---|
| Director | `DIRECTOR` | All staff, any branch, any role | Anyone | Yes |
| Branch Manager | `MANAGER` | Own branch only | Any staff within branch | Yes |
| Supervisor (Head Chef, Head Waiter, etc.) | `CHEF`, `WAITER` with seniority | No | Staff they supervise; reply to manager | Yes |
| Operational Staff (Waiter, Chef, Barista) | Operational roles | No | Reply to messages only — cannot initiate | Yes |
| Store Manager | `STORE_MANAGER` | No | Receives operational notifications only | Yes |

*Note: Supervisor communication permissions depend on the scoping decision about how supervisor roles are designated in the system (pending V2.2 HR scoping).*

---

## 4. Workflow

### 4.1 Broadcast Announcement

1. Director or Branch Manager opens the Communications section → New Announcement
2. Fills in: title, body, target audience (branch scope + role group), requires acknowledgement toggle
3. Submits
4. System sends FCM push to all matching users: *"New announcement: [title]"*
5. In-app notification badge increments for all recipients
6. Recipients open the announcement to read it
7. If `requiresAck = true`: an Acknowledge button is shown. Until acknowledged, the announcement remains highlighted in the inbox

### 4.2 Direct Message

1. Manager opens a staff member's profile or the Communications inbox → New Message
2. Enters message body and sends
3. System sends FCM push to the recipient
4. Recipient sees the message in their inbox and can reply
5. Both sender and recipient have a full message thread

### 4.3 HR Formal Notice

1. Director or Branch Manager issues a disciplinary record via the HR module
2. The system automatically sends a Direct Message to the staff member with the notice content
3. The Direct Message is linked to the `DisciplinaryRecord` and marked as a formal notice
4. The notice is permanently attached to both the staff member's HR record and their message thread

---

## 5. Permission Model

Enforced in `communicationsService` (not just route guards):

```
Who can broadcast:
  DIRECTOR → anyone, any branch
  MANAGER → own branch only

Who can initiate a direct message:
  DIRECTOR → anyone
  MANAGER → staff within their own branch
  Supervisors (pending scoping) → staff they supervise
  WAITER / CHEF / BARISTA → cannot initiate, can only reply

Cross-branch messaging:
  Only DIRECTOR and STORE_MANAGER can communicate across branches
  MANAGER cannot message staff at other branches
```

---

## 6. Data Models

See `docs/V2/DATA_MODEL_ADDENDUM.md` Section 5.

Key models:
- `Announcement` — broadcast message with audience scoping and optional ack requirement
- `AnnouncementAck` — one record per user per acknowledged announcement
- `DirectMessage` — 1:1 message with `readAt` tracking

---

## 7. API Endpoints

See `docs/V2/API_CONTRACT_ADDENDUM.md` Section 5 for full endpoint specs.

Key endpoints:
- `POST /communications/announcements` — create broadcast
- `GET /communications/announcements` — inbox (filtered by user's role and branch)
- `POST /communications/announcements/:id/ack` — acknowledge
- `POST /communications/messages` — send direct message
- `GET /communications/messages` — conversation list
- `GET /communications/messages/:userId` — message thread
- `GET /communications/messages/unread-count` — badge count

---

## 8. Frontend Screens

- `/app/communications` — inbox: tabs for Announcements and Messages, unread badge
- `/app/communications/announcements/new` — compose broadcast (Director/Manager only)
- `/app/communications/announcements/[id]` — read announcement, acknowledge button if required
- `/app/communications/messages/[userId]` — direct message thread

**Navigation:** A Communications item is added to the main nav for all roles. The unread count badge is driven by `GET /communications/messages/unread-count` polled on mount and updated via Socket.io events.

---

## 9. Open Questions

| # | Question | Impact |
|---|---|---|
| 1 | Which notification types require explicit acknowledgement — shift reminders, requisition dispatched, announcements, all of the above? | Determines which models need `requiresAck` logic and frontend acknowledgement UI |
| 2 | Delivery rider access model — are riders a formal `UserRole`, a lightweight external account, or something else? | Determines how riders receive operational notifications |
| 3 | Message retention — are direct messages permanent, or is there a retention period after which they are deleted? | Determines if a cleanup job is needed |
| 4 | Offline delivery — if a staff member's device is offline when a formal HR notice is sent, is the notice re-delivered when they reconnect? FCM handles this to some extent — but what is the expected SLA? | Determines if additional delivery confirmation logic is needed |
| 5 | Cross-branch communication — can Branch Managers at different branches message each other, or is that Director-level only? | Determines permission model edge case |
| 6 | Read receipts — can senders see who has read a broadcast or direct message? Is this visible to the sender only, or also to the Director? | Determines if a `readAt` index on Announcement is needed in addition to `AnnouncementAck` |
