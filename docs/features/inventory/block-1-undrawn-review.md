# Block 1: buttons, menus and states built without a Paper drawing

For the owner to review (standing rule: Paper is direction; an undrawn button or state is built in the same style and reported, never left out). All were opened in a real browser against the real API on 8 Oct 2026. Passwords and PINs in the local lane: `password123` and `1234`. Local logins used: Kitchen head `kitchen.head.highway@wendo.test` (phone, 390 wide), Branch Manager `bm.highway@wendo.test` (desktop), Director `director@wendo.test`, Store Manager `store.manager@wendo.test`, Accountant `accountant@wendo.test`.

## Branch Manager (desktop)

| # | What | How to open it |
|---|---|---|
| 1 | The "…" menu in a file's header: **Print**, **Mark as urgent** / **Clear urgent**, **Cancel requisition** (Cancel only before approval) | Requisitions › open any Collecting or Ready file › the "…" button top right |
| 2 | **Start a requisition** dialog: cycle chips, Urgent switch, a "What is it for" note (200 characters) that appears with the switch | Requisitions › Start a requisition (top right). Hidden for the System Admin |
| 3 | **Nudge** split button, its menu: **Fill it myself** and **Send without this section** | A Collecting file with a department not sent › the arrow beside "Nudge …" (open with the mouse, then arrow keys) |
| 4 | **Fill it myself** sheet: add items from a list, quantity per line, your own PIN, **Save as draft**, **Send {Department}'s list** | Nudge menu › Fill it myself |
| 5 | **Send without this section**: no confirmation, a toast naming the sections skipped, and the rail shows "Skipped" | Nudge menu › Send without this section |
| 6 | Department rail words: **Drafting**, **Skipped**, "{Department} hasn't started" | The rail on the left of any open file |
| 7 | Change-quantity popover, the **Other** reason field and **Skip** (save without a reason, before approval only) | Click an Approved quantity, change it, press Tab |
| 8 | Next step cards without a drawing: **Cancelled** (with "Start a new one"), **Closed**, **Collecting** with nothing missing | Open a cancelled requisition from History; the others when they occur |
| 9 | The **Cancelled** line under the file: who, when, reason and note | Open a cancelled file |
| 10 | **Cancel requisition** dialog's reason drop-down (Asked for the wrong cycle, Asked twice by mistake, No longer needed, Other with a required note) | "…" menu › Cancel requisition |
| 11 | **Documents** and **Activity** tabs' contents (sentences, record links, versions) | A file › Documents or Activity |
| 12 | Green **Approved and sent** banner, shown only right after signing | Sign an approval; gone on reload |
| 13 | **Addition waiting** panel and its **Approve addition** dialog | After a head adds to an approved requisition |
| 14 | **Departments** (Manage › Departments): **Add a department**, **Rename**, **Retire** confirmation (with the "open section" refusal), **Restore** in a retired row's menu, the duplicate-name message | Manage › Departments |

## Department head (phone, 390 wide)

| # | What | How to open it |
|---|---|---|
| 15 | **Mark as urgent** switch on the section screen after the requisition is started (Paper draws Urgent only at start) | Requisitions › open your open requisition |
| 16 | **See every line** in the send sheet; **See lines** on a sent list (read-only list) | Review and send › See every line; a sent list › See lines |
| 17 | **Added after approval · Waiting for approval** state and its lines | After sending an addition |
| 18 | RESOLVED 9 Oct 2026 (owner decision): the fallback **Start a new one** button is removed from an approved requisition with an addition waiting. **Start a new one** now shows only on a Cancelled file (head's phone footer limited to Cancelled; the desktop card already did this) | Cancelled file only |
| 19 | **Approved, with the store** banner and the greyed Block 2 rows in the tracker | Any approved requisition |
| 20 | The "manager changed a line" notice (asked, approved, reason; nothing to dismiss) | After the Branch Manager changes a quantity |
| 21 | History row opening the read-only file, cancelled and not-sent labels | Requisitions › History, tap a row |
| 22 | Wording for `INVALID_PIN`, already-open-for-this-cycle, `DEPARTMENT_PACKED` and the six extra error codes | Wrong PIN in the send sheet; the others by the real refusals |

## Director, Store Manager, Accountant

| # | What | How to open it |
|---|---|---|
| 23 | Director's **Open and approve** banner for an urgent requisition unapproved over an hour, red "Unapproved for" | Director › Central Store › Requisitions › To approve |
| 24 | "You are signing as the Director" line in the Approve drawer, and "Approved · Director" in the tracker | Open and approve |
| 25 | Read-only file for Store Manager and Accountant (only **Print**), money visible | Central Store › Requisitions › any file |
| 26 | Director's Departments (read only, branch picker) | Operations › Branch Settings › Departments |
| 27 | Print page: "Asked by", addition approver block, the "n + m" lines wording, signature that steps down for a long name | A file › "…" › Print |

## Things I want you to look at
- Item 18 (the "Start a new one" fallback): resolved 9 Oct 2026, see the table.
- A toast sat over the top-right of drawers and the "…" button and stayed up for a long time: fixed 9 Oct 2026. The shared toast (`components/ui2/toast.tsx`) now sits at the bottom centre, success and info go after 4 seconds, errors stay until dismissed or replaced, it pauses on hover and focus, has a Dismiss button, is announced (`status`, or `alert` for errors) and respects reduced motion.
- The Mark-as-urgent toast tells the Branch Manager "the Branch Manager is told at once" when they marked it themselves.
- The Radix select option (cancel reason) did not take a mouse click from the test tool but works with the keyboard; please click it once yourself.
