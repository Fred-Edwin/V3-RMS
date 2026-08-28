# Requisitions & Procurement Walkthrough — Screen Export List

Open `requisitions-procurement-walkthrough.html` directly in a browser to view
or print it (File → Print → Save as PDF). Placeholder boxes show automatically
wherever a matching image is missing — no HTML edits needed. Export each
screen from Paper.design as a PNG, name it exactly as below, and drop it into
`screens/`. The placeholder disappears and the real screen appears the moment
the file exists.

Screens are shown with a thin hairline border and rounded corners only — no
browser chrome, no phone bezel — just the image itself sized to a desktop or
mobile slot.

Four steps exist on both desktop and mobile — those are shown as a side-by-side
pair ("Desktop" / "or" / "Mobile") rather than one image, so each needs **two**
files: the desktop shot and a `b`-suffixed mobile shot. In a pair, the mobile
shot is stretched to the same height as the desktop shot (narrower width only)
so both read at a comparable scale.

| # | Filename | Screen (Paper) |
|---|---|---|
| 1 | `01-department-dashboard.png` | Department Dashboard (D1.1, mobile) |
| 2 | `02-new-requisition.png` | New Requisition (D1.2, mobile) |
| 3 | `03-review-requisition.png` | Review Requisition sheet (D1.2, mobile) |
| 4 | `04-approvals-queue.png` | Approvals Queue — **Desktop** (D2.1) |
| 4b | `04b-approvals-queue-mobile.png` | Approvals Queue — **Mobile** (D2.1) |
| 5 | `05-requisition-document.png` | Requisition Document — Approved/Rejected — **Desktop** |
| 5b | `05b-requisition-document-mobile.png` | Requisition Document — Approved/Rejected — **Mobile** |
| 6 | `06-requisitions-table.png` | Requisitions table (Store Manager, desktop) |
| 7 | `07-fill-order.png` | Fill Order — **Desktop** |
| 7b | `07b-fill-order-mobile.png` | Fill Order — **Mobile** |
| 8 | `08-dispatch-note.png` | Dispatch Note document — **Desktop** |
| 8b | `08b-dispatch-note-mobile.png` | Dispatch Note document — **Mobile** |
| 9 | `09-receive-delivery.png` | Receive Delivery (D1.4, mobile) |
| 11 | `11-request-market-items.png` | Request Market Items (mobile) |
| 12 | `12-mpo-draft-drawer.png` | Market Purchase Order — Draft Drawer |
| 13 | `13-mpo-reconciling-drawer.png` | Market Purchase Order — Reconciling Drawer |
| 14 | `14-receive-mpo.png` | Receive Market Purchase Order (mobile) |
| 15 | `15-branch-stock.png` | Branch Stock (desktop) |
| 16 | `16-branch-stock-history.png` | Branch Stock History (desktop) |
| 17 | `17-staff-list.png` | Staff (desktop) |
| 18 | `18-staff-detail.png` | Staff Detail drawer (desktop) |

**No file #10.** `10-log-market-purchase.png` (D1.5, the same-day spot-purchase
log) is no longer part of this walkthrough — department heads never buy at the
market themselves, so that screen doesn't belong in this flow. Numbering keeps
the gap rather than renumbering everything, in case D1.5 is reused elsewhere later.

21 files total (17 single-device screens + 4 paired steps that need a second,
`b`-suffixed mobile shot).

**Export tips**
- PNG, any resolution. Images are shown cropped to fill (`object-fit: cover`)
  their slot — export close to the frame's proportions (below) so the crop
  doesn't cut off anything important.
- Desktop screens sit in a roughly 16:10-wide slot. Standalone mobile screens
  (no desktop pair) sit in a ~9:17.5 slot capped at 240px wide. Paired mobile
  screens (steps #4, #5, #7, #8) are narrower (140px) and stretched to the
  desktop shot's height instead of keeping the phone ratio — export those
  a little taller/cropped-in if the full screen looks squeezed.
- If only one half of a paired step is exported, that half shows the real
  screen and the other half keeps its placeholder — fine to ship as a
  work-in-progress state.
- You don't need all 21 before sharing this — export a few, refresh the page,
  see how they look, adjust export settings, then do the rest.
