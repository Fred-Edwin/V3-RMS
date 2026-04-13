# Internal Communications Module — Feature Specification
## Wendo Coffee Bistro RMS (V2)

**Status:** Pre-implementation reference
**Author:** System Architect
**Date:** 2026-04-10

---

## 1. Purpose

This document defines what the Internal Communications module must do, who it serves,
and the design intent behind its structure. It is the authoritative reference for
implementation planning.

---

## 2. What This Module Is

The Internal Communications module is Wendo's in-app professional communication layer.
It replaces WhatsApp groups and informal messaging for all business-related communication
between staff members and management.

**It is not an email system.** No messages leave the system. No external email addresses
are involved. It is closer in architecture to an internal inbox — like the messaging
component of an HR platform or a lightweight internal Slack — but purpose-built for
Wendo's structure and already embedded in the system every staff member uses daily.

**Why not just use Google Workspace or Microsoft 365?**
The client evaluated both and found them cost-prohibitive for a multi-branch hospitality
business at this stage. This module provides the professional communication layer they
need without the per-seat licensing cost of those platforms.

---

## 3. Who Uses It

All active staff members with a system account have access to the comms module.
What they can do within it depends on their role.

| Role | Capabilities |
|---|---|
| Director | Send company-wide or branch-scoped broadcasts; DM any staff member; receive messages from anyone |
| HR Manager | Send company-wide or branch-scoped broadcasts; DM any staff member; issue formal notices; receive messages from anyone |
| Branch Manager | Send branch-scoped broadcasts; DM any staff member in their branch; receive messages from anyone in their branch |
| Supervisor (Head Chef, Head Waiter, Assistants) | DM their manager and the staff they supervise; receive messages from anyone above them and the staff they supervise |
| Operational Staff (Waiter, Chef, Barista, etc.) | DM their direct supervisor or branch manager; receive messages from anyone above them |

**Key principle:** Any staff member can initiate a direct message upward to their manager
or supervisor. Communication is not management-down only. However, broadcasts (one-to-many
announcements) are restricted to manager-level and above.

---

## 4. Core Capabilities

### 4.1 Broadcasts (Announcements)

A broadcast is a one-to-many message sent to a defined group. The sender composes it once;
it appears in the inbox of every recipient in the target group.

#### Scope Options

| Scope | Who Can Send | Who Receives |
|---|---|---|
| Company-wide | Director, HR Manager | All active staff across all branches |
| Branch | Director, HR Manager, Branch Manager | All active staff in the specified branch |
| Role group | Director, HR Manager | All staff with a specific role (e.g. all Chefs, all Waiters) |

#### Broadcast Fields

- **Title** — short subject line (required)
- **Body** — full message content (rich text or plain text; TBD during implementation)
- **Scope** — Company / Branch / Role group
- **Urgency flag** — marks the message as urgent; recipients see a visual indicator
- **Requires acknowledgement** — if checked, recipients must explicitly confirm they have read and understood the message; this is enforced in the UI (cannot dismiss without acknowledging)
- **Attachments** — optional file attachments (PDF, JPG, PNG) via Cloudinary
- **Scheduled send** — optional; allows a broadcast to be composed now and delivered at a future time/date

#### Read and Acknowledgement Tracking

The sender (and HR/Directors for any broadcast) can see:
- Total recipient count
- How many have read (opened) the message
- How many have explicitly acknowledged (if acknowledgement was required)
- Who has not yet read/acknowledged (list view)

Unread broadcasts appear prominently in the recipient's inbox. Urgent unread broadcasts
also trigger a push notification (FCM) to the recipient's device.

---

### 4.2 Direct Messages (DMs)

A direct message is a private one-to-one conversation between two staff members.
Conversations are threaded — replies stay in context under the original message.

#### Who Can Message Whom

- Any staff member can initiate a DM with their direct supervisor or branch manager
- Any staff member can reply to a DM sent to them from anyone
- Managers and supervisors can DM any staff member within their scope
- HR Manager and Directors can DM any staff member in the organisation
- Staff members cannot DM peers (e.g. a waiter cannot DM another waiter) — this is not
  a social tool; it is a professional communication channel

**Rationale for peer restriction:** Preventing peer-to-peer messages keeps this a
professional, hierarchical communication tool rather than a general chat. It avoids
the social dynamics of a group chat while still giving staff a way to reach their
manager directly.

#### DM Fields

- **Recipient** — selected from eligible contacts based on the sender's role
- **Subject** — optional subject line for formal messages
- **Body** — message content
- **Attachments** — optional file attachments

#### Threading

Replies are grouped under the original message. Each conversation has a single thread.
The inbox shows conversations sorted by most recent activity.

#### Read Receipts

Senders can see when their message was read (a timestamp, not a "seen" tick visible to
the recipient — this reduces anxiety). Read receipt visibility:
- Staff can see if their manager read their message
- Managers can see if staff read their messages
- HR/Directors can see read status on any message

---

### 4.3 Formal Notices (HR-Issued)

Formal notices are a special category of direct message that originates from the HR
module. They represent official, documented communications that become part of the
recipient's permanent HR record.

**Examples:**
- Written warning delivery
- Contract amendment notification
- Meeting invitation (for a disciplinary hearing)
- Policy update acknowledgement request
- Performance review scheduling

#### How They Differ From Regular DMs

| Aspect | Regular DM | Formal Notice |
|---|---|---|
| Initiated from | Comms inbox | HR module (disciplinary record or leave record) |
| Stored in | Comms only | Comms inbox + HR record (permanent) |
| Requires acknowledgement | Optional | Always required |
| Can be deleted/archived | Yes (by sender) | No — permanently retained |
| Visible to Directors | Only if sender/recipient | Always |

#### Delivery Flow

1. HR Manager issues a formal notice from within the HR module (e.g. when recording a Written Warning)
2. The notice is delivered to the staff member's comms inbox
3. The staff member opens it, reads it, and must explicitly acknowledge receipt
4. Acknowledgement is timestamped and written back to the HR disciplinary record automatically
5. If the staff member has not acknowledged within 24 hours, a push reminder is sent
6. If still unacknowledged after 48 hours, the HR manager is alerted

This creates an auditable delivery trail — the HR manager can demonstrate the staff
member was formally notified and when they acknowledged it.

---

### 4.4 The Inbox (UI Concept)

Every staff member has a single unified inbox inside the system. It shows:

- **Unread count badge** on the nav icon (visible across all pages)
- **Broadcasts tab** — company/branch/role announcements
- **Messages tab** — direct message conversations
- **Notices tab** — formal HR notices (always separate and prominent)

Messages are ordered by most recent activity. Urgent broadcasts appear at the top
with a visual indicator regardless of date.

---

## 5. Notifications

The comms module uses the existing FCM push notification infrastructure for delivery alerts.

| Event | Push Notification Sent To |
|---|---|
| New broadcast (urgent) | All recipients immediately |
| New broadcast (non-urgent) | All recipients (batched, not immediate — e.g. next natural interval) |
| New direct message | Recipient |
| New formal notice | Recipient (immediately, regardless of urgency) |
| Unacknowledged formal notice (24h) | Recipient reminder |
| Unacknowledged formal notice (48h) | HR Manager alert |

Staff do not need to be in the app to be notified. Push notifications bring them back in.

---

## 6. What This Module Does Not Cover

- **External email** — no messages are sent to or received from external email addresses
- **Group chats** — there are no multi-party real-time chat rooms; broadcasts are one-to-many, not a chat
- **File sharing as a primary function** — files can be attached to messages but this is not a document management system
- **Message search** — full-text search across message history is not in V2 scope
- **Message encryption at rest** — standard database security applies; end-to-end encryption is not in V2 scope

---

## 7. Integration Points

| Integrates With | How |
|---|---|
| HR Module | Formal notices originate in HR; acknowledgements write back to HR records |
| FCM Push (existing) | Delivery alerts for new messages and unacknowledged notices |
| `users` / roles table | Permission model — who can message whom — derived from role + branch assignment |
| Cloudinary | File attachments use the same upload infrastructure |

---

## 8. Data Retention

| Message Type | Retention Policy |
|---|---|
| Broadcasts | Retained for 2 years; then archivable (not deleted) |
| Direct messages | Retained for 1 year; then archivable by HR |
| Formal notices | Permanent — never deleted; tied to staff HR record |

These are defaults and should be confirmed with the client before implementation.

---

## 9. Open Questions Before Implementation

1. **Rich text vs plain text** — Do broadcasts need formatting (bold, bullet lists) or is
   plain text sufficient? Rich text adds UI complexity.
2. **Scheduled broadcasts** — Is this a V2 requirement or can it be deferred?
3. **Message archiving** — Does the HR manager need to export a staff member's full
   message history (e.g. for a legal dispute)? This affects storage and query design.
4. **Branch manager cross-branch visibility** — Can a branch manager see comms activity
   for another branch, or is their scope strictly their own branch?
5. **Peer DMs at supervisor level** — Can a Head Chef DM a Head Waiter (same level,
   different department, same branch)? The current model says no — confirm this is correct.
