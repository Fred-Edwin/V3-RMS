# Wendo RMS — Demo Video Script & Recording Guide

**Audience:** Bistro owner (Director) and branch managers seeing the system for the first time.
**Target Length:** 4–6 minutes
**Format:** AI-narrated screen recording (Loom or OBS), edited into scenes.

---

## 1. Narrative Arc

> "Every morning at Wendo, the day used to begin with a stack of handwritten orders, a manager calling across the room to find out who was clocked in, and a director in Nyeri with no idea how yesterday's sales went until the end of the day. This is what that same morning looks like now — for everyone, on any device, in real time."

The demo tells the story of a single business day at Wendo Coffee Bistro: from the director's morning overview, through the first order of the day, all the way to the manager reviewing the branch's performance before close. Every role gets exactly the information they need — nothing more, nothing less.

---

## 2. Shot List

---

### Scene 1 — "The Director's Morning" (45 s)

**Who is logged in:** Director (`director@wendo.co.ke`)
**Page:** `/app/director` — Director Dashboard

**Steps:**
1. Open browser to the Director Dashboard (already loaded before recording starts).
2. Let the Live Operations Pulse panel sit for 2 seconds — show the "Live" indicator and refreshed-at timestamp.
3. Slowly scroll down to reveal the system-wide KPI row (total active orders, total staff clocked in, branches reporting).
4. Hover over one branch row in the Pulse table to show the tooltip/highlight.
5. Scroll further to the Today vs Yesterday stat cards — linger on the Revenue and Orders cards showing the delta badge (e.g., "+12% vs yesterday").
6. Scroll to the Daily Branch Breakdown section — show both branch cards side by side (revenue, order type split, top items).
7. Click the Export button → show the PDF / CSV popover (do not download — just show the options).

**Voiceover:** See Section 4, [SCENE 1]

**Duration:** 45 seconds

**What to have ready:**
- Director account logged in, Dashboard page loaded.
- At least 7 days of seeded order data across both branches (use the seed script).
- Today's date has 8–15 closed orders per branch so stats look healthy.
- Yesterday's revenue is ~10–15% lower than today so the delta badge shows green "+%".
- Live Pulse shows at least 3 active orders and 4 clocked-in staff across branches.

---

### Scene 2 — "Manager Starts the Shift" (40 s)

**Who is logged in:** Manager, Kingz branch (`manager.kingz@wendo.co.ke`)
**Page:** `/app/manage/dashboard` — Manager Dashboard

**Steps:**
1. Open the Manager Dashboard — stat cards are visible at top.
2. Point to the "Staff On Shift Today" panel on the right — show 2–3 staff listed, one with a green clock-in badge, one still showing "Not clocked in".
3. Click on the staff member who hasn't clocked in. Show the manager override modal — select "GPS permission denied" as the reason, type a short note ("Indoor, no GPS signal"), click Override.
4. The staff member's row immediately updates to show a green "Clocked In (Override)" badge.
5. Scroll left to the Active Orders Feed panel — currently empty or 1–2 orders — pause here briefly.

**Voiceover:** See Section 4, [SCENE 2]

**Duration:** 40 seconds

**What to have ready:**
- Manager account logged in on Kingz branch.
- Morning shift ("Morning — 6:00 AM – 2:00 PM") created and assigned to: 1 waiter, 1 chef, 1 barista.
- Waiter has already clocked in (via seed or pre-action before recording).
- Chef has NOT clocked in yet — so the override can be demonstrated live.
- Active orders feed: 1 existing active order for context, so the panel is not completely empty.

---

### Scene 3 — "Waiter Takes an Order" (50 s)

**Who is logged in:** Waiter, Kingz branch (`waiter.kingz@wendo.co.ke`) — shown on a **mobile viewport** (375 px wide, Chrome DevTools device emulation or a real phone).
**Page:** New Order flow

**Steps:**
1. Show the waiter's mobile home screen briefly — the bottom navigation (Dashboard, New Order, Orders, Shifts).
2. Tap "New Order" — the menu browsing screen opens.
3. Browse to the "Hot Drinks" category — tap "Cappuccino" and add 2 to cart.
4. Browse to "Meals" category — tap "Chicken Sandwich" and add 1 to cart.
5. Tap the cart button — the cart modal slides up showing 3 items and a total in KES.
6. Select order type "Dine-In", type table number "5", add a comment "Extra hot please".
7. Tap "Submit Order" — the confirmation screen flashes and the order number appears (e.g., "Order #7").
8. The waiter is back on the Orders list — the new order shows as "Pending".

**Voiceover:** See Section 4, [SCENE 3]

**Duration:** 50 seconds

**What to have ready:**
- Waiter account logged in on a separate browser window set to 375 px width (Chrome DevTools → iPhone SE or similar).
- Menu populated: "Hot Drinks" category with Cappuccino (KES 280), "Meals" category with Chicken Sandwich (KES 450).
- Cart is empty before recording starts.
- Previous orders exist so this will be Order #7 (looks more realistic than #1).

---

### Scene 4 — "The Kitchen Sees It Instantly" (30 s)

**Who is logged in:** Kitchen Display System — Kingz branch (a separate tab / second monitor, already open).
**Page:** `/app/kitchen` or KDS shared display page

**Steps:**
1. Switch to the KDS tab/window immediately after the waiter submits the order (Scene 3 transition).
2. The new order card appears in the "Pending" queue with an audio ping (the sound plays naturally).
3. Linger for 2 seconds on the card — show: order number #7, "Dine-In — Table 5", "Chicken Sandwich × 1", "Extra hot please", elapsed timer starting.
4. Click "Claim" on the card — the dropdown appears listing on-shift chefs.
5. Select "James Kariuki" from the dropdown — the card immediately moves to the In-Progress column.
6. Hold on the In-Progress column briefly — the card shows the chef's name and a running timer.

**Voiceover:** See Section 4, [SCENE 4]

**Duration:** 30 seconds

**What to have ready:**
- KDS tab open in a separate full-screen browser window (1280 px wide).
- Chef "James Kariuki" is on shift and visible in the dropdown (assigned to morning shift).
- No other Pending orders on screen — KDS is clean so the new ticket is the hero of the shot.
- Audio unmuted on the recording device so the notification ping is captured.

---

### Scene 5 — "Order Complete, Payment Recorded" (35 s)

**Who is logged in:** Waiter (same mobile window as Scene 3), then briefly the KDS.
**Pages:** KDS marks Ready → Waiter sees notification → Waiter records payment.

**Steps:**
1. On the KDS, the chef clicks "Mark Ready" on Order #7 — the card moves to the Ready column.
2. Cut to the waiter's mobile — the order status badge on the Orders list has updated to "Ready" (real-time Socket.io update, no refresh needed).
3. Waiter taps the order → Order Detail sheet slides up showing "Food: Ready".
4. Waiter taps "Record Payment" — a payment method selector appears (Mpesa / Cash / Card).
5. Waiter selects "Mpesa" and taps "Confirm Payment" — order moves to Closed.
6. The order disappears from the Active Orders list. Order count stat in the header ticks up by one.

**Voiceover:** See Section 4, [SCENE 5]

**Duration:** 35 seconds

**What to have ready:**
- KDS and Waiter windows both visible (side-by-side on a wide monitor, or alt-tab if recording single screen).
- Order #7 is already In-Progress on the KDS (from end of Scene 4).
- Waiter's Orders list is open and showing Order #7 as "In Progress" before the cut.

---

### Scene 6 — "Manager Reviews the Day" (45 s)

**Who is logged in:** Manager, Kingz branch (`manager.kingz@wendo.co.ke`)
**Pages:** Manager Dashboard → Reports page

**Steps:**
1. Return to the Manager Dashboard. The stat cards now reflect the closed order — Revenue card ticked up, Closed Orders count updated.
2. Scroll down to the Daily Summary section — today's order type breakdown chart is visible (Dine-In / Take-Away / Delivery bars), Revenue by Payment Method chart (Mpesa / Cash / Card), and the Top 5 Selling Items ranked list.
3. Click "Reports" in the left sidebar — the Staff Performance Reports page opens.
4. Set date range to the current month. Click "Run Report".
5. The performance table populates — show James Kariuki's row (chef) with tickets completed and average prep time.
6. Click "Export" → "Download PDF" — the browser downloads the file. Briefly show the filename appearing in the downloads bar.

**Voiceover:** See Section 4, [SCENE 6]

**Duration:** 45 seconds

**What to have ready:**
- Manager Dashboard already open (same session as Scene 2).
- At least 15 closed orders for today so charts look populated and meaningful.
- Reports page: date range pre-set to current month — "Run Report" has NOT been clicked yet so the audience sees the data load live.
- Staff performance data: James (chef) has 8+ tickets this month with a sub-8-minute avg prep time.

---

### Scene 7 — "Getting the System Ready (Admin)" (30 s)

**Who is logged in:** System Admin (`admin@wendo.co.ke`)
**Pages:** `/app/admin` — Branches & Users, then Menu Management

**Steps:**
1. Open the Admin dashboard — show the branch list (Kingz, Town branches visible as rows).
2. Click on "Kingz" branch row — branch detail / staff list opens. Show two staff accounts visible in the list with role badges (Waiter — tan, Chef — orange, Barista — green).
3. Click "Create Staff" — the staff creation modal opens. Show the fields (Name, Email, Role dropdown, Temporary Password). Do not submit — just show the form.
4. Close the modal. Navigate to Menu Management.
5. Show the categories list with "Hot Drinks" and "Meals" visible. Briefly show that Hot Drinks is assigned to "Barista Station" and Meals to "Kitchen" — illustrating the automatic routing logic.
6. Click on one menu item — show the item edit modal (name, price in KES, category, status toggle).

**Voiceover:** See Section 4, [SCENE 7]

**Duration:** 30 seconds

**What to have ready:**
- Admin account logged in.
- Two branches created: "Kingz" and "Town".
- At least 5 staff accounts visible in Kingz.
- Menu categories: Hot Drinks (→ Barista), Cold Drinks (→ Barista), Meals (→ Kitchen), Snacks (→ Kitchen).
- At least 8 menu items across categories with prices in KES.

---

### Scene 8 — "Any Device, Anywhere" (15 s — closing montage)

**Who is logged in:** Multiple roles shown rapidly in sequence.
**Pages:** Director dashboard, Waiter mobile, KDS, Manager dashboard — fast cuts.

**Steps:**
1. Rapid cut: Director dashboard on a desktop browser (wide, full screen).
2. Rapid cut: Waiter's mobile — order list with color-coded status badges.
3. Rapid cut: KDS tablet view — a card moving from Pending to In-Progress.
4. Rapid cut: Manager dashboard — stat cards and the active orders feed.
5. Hold on the Manager dashboard — fade to black / logo end card.

**Voiceover:** See Section 4, [SCENE 8]

**Duration:** 15 seconds

**What to have ready:**
- All sessions pre-loaded and tabs arranged.
- No loading spinners visible — everything loaded before the montage starts.

---

## 3. Suggested Scene Order

| # | Scene | Role | Primary Device |
|---|-------|------|---------------|
| 1 | Director's morning overview | Director | Desktop browser |
| 2 | Manager starts the shift / override | Manager | Desktop browser |
| 3 | Waiter takes an order | Waiter | Mobile (375 px) |
| 4 | Kitchen sees the ticket instantly | KDS | Desktop (second tab) |
| 5 | Order complete & payment recorded | KDS + Waiter | Both windows |
| 6 | Manager reviews today so far | Manager | Desktop browser |
| 7 | System Admin — setup glimpse | System Admin | Desktop browser |
| 8 | Any device, anywhere — closing montage | All roles | All windows |

---

## 4. Full Voiceover Script

---

**[INTRO — no screen, 8 s]**

Every morning at Wendo, the day used to start the same way: handwritten orders, a manager guessing who was clocked in, and no idea how the previous day's sales really went. Here's what that morning looks like now.

---

**[SCENE 1 — Director Dashboard, 45 s]**

The Director opens Wendo RMS on any browser — laptop, phone, wherever they are. Instantly, they can see how every branch is doing right now: how many active orders are being prepared, which staff are on the floor, and exactly how today's revenue compares to yesterday. The green badge — up twelve percent — means Kingz branch is having a stronger morning than yesterday. Below that, a full breakdown by branch: each branch's revenue, the mix of dine-in, take-away, and delivery orders, the top-selling items of the day, and how long food is taking to reach customers. And when it is time to share that picture with stakeholders, one click exports a branded PDF or CSV — no spreadsheet needed.

---

**[SCENE 2 — Manager Dashboard, 40 s]**

The Kingz branch manager opens their dashboard. On the right, they can see every staff member assigned to this morning's shift and who has already clocked in. One chef has not checked in yet — perhaps their GPS signal was blocked indoors. The manager clicks Override, selects the reason, adds a brief note, and confirms. The system records the override with a full audit trail — the manager is protected, the record is clean, and James can start work immediately. On the left, the active orders feed is live — anything submitted from the floor appears here in real time.

---

**[SCENE 3 — Waiter mobile, 50 s]**

Out on the floor, a waiter opens Wendo RMS on their personal phone — no app to install, just a browser. They tap New Order and browse the menu by category. Two Cappuccinos, one Chicken Sandwich — added to the cart in seconds. They open the cart, confirm the items and the total in Kenya Shillings, select Dine-In for Table Five, add a note for the kitchen — "Extra hot please" — and submit. That is it. The order is confirmed, numbered, and routed automatically. The waiter never has to leave the table. The kitchen already has it.

---

**[SCENE 4 — Kitchen Display System, 30 s]**

The moment the waiter submits, the Kitchen Display shows the new ticket — a sound plays, and the card appears in the Pending column with the order number, table, items, and that customer note. James taps Claim, selects his name from the on-shift dropdown, and the ticket moves to In-Progress. Everyone at the station — on the shared tablet or their own phone — sees this immediately. There is no paper. There is no shouting across the kitchen. There is only the queue.

---

**[SCENE 5 — Order complete and payment, 35 s]**

When James finishes, he marks the order Ready. Across the room, the waiter's phone updates instantly — no refresh needed. They tap the order, see Food: Ready, tap Record Payment, select Mpesa, and confirm. The order closes. The manager's dashboard updates. The day's numbers move. The whole cycle — from order to close — is captured, timestamped, and ready to report on.

---

**[SCENE 6 — Manager Reports, 45 s]**

At any point in the day, the manager can pull up the Daily Summary: revenue so far, how it splits by payment method, which items are selling most. They can flip to the Reports page, run a staff performance report for the month, and see how every team member is performing — orders handled, average prep time, scheduled hours versus actual hours worked. When they need to take this to a branch review, they export a branded PDF in one click — ready to present, ready to file.

---

**[SCENE 7 — System Admin setup, 30 s]**

Setting up a new branch takes minutes, not days. The System Admin creates the branch, adds the manager account, and staff accounts follow from there — each with a role that determines exactly what they can see and do. Menu categories are assigned to the right preparation station once — and from that point, every order routes itself automatically. Hot drinks go to the Barista. Meals go to the Kitchen. No instructions needed. No mistakes possible.

---

**[SCENE 8 — Closing montage, 15 s]**

Wendo RMS runs on every device your team already owns. The director on their laptop. The waiter on their phone. The chef on a shared kitchen tablet. The manager at home. One system. Every branch. Real time. This is Wendo RMS.

---

**[END CARD — 5 s]**
*Wendo RMS — Built for Wendo Coffee Bistro*

---

## 5. Pre-Demo Setup Checklist

Complete all of the following before starting the screen recording. Verify each item in a test run 24 hours before the actual recording.

### Branches
- [ ] Branch 1: **Kingz** — with GPS coordinates set
- [ ] Branch 2: **Town** — with GPS coordinates set

### Staff Accounts

| Name | Role | Branch | Login Email | Temp Password |
|------|------|--------|-------------|---------------|
| (Your name / Director) | DIRECTOR | — | `director@wendo.co.ke` | `Demo@1234` |
| Mary Wanjiku | MANAGER | Kingz | `manager.kingz@wendo.co.ke` | `Demo@1234` |
| Alice Muthoni | MANAGER | Town | `manager.town@wendo.co.ke` | `Demo@1234` |
| Peter Gitau | WAITER | Kingz | `waiter.kingz@wendo.co.ke` | `Demo@1234` |
| James Kariuki | CHEF | Kingz | `chef.kingz@wendo.co.ke` | `Demo@1234` |
| Grace Njeri | BARISTA | Kingz | `barista.kingz@wendo.co.ke` | `Demo@1234` |
| (System admin) | SYSTEM_ADMIN | — | `admin@wendo.co.ke` | `Demo@1234` |

### Menu

| Category | Station | Items (Price KES) |
|----------|---------|-------------------|
| Hot Drinks | Barista | Cappuccino (280), Latte (300), Flat White (280), Espresso (200), Chai Latte (250) |
| Cold Drinks | Barista | Iced Coffee (320), Mango Smoothie (350), Fresh Juice (280) |
| Meals | Kitchen | Chicken Sandwich (450), Beef Burger (550), Chicken Wings (520), Caesar Salad (380) |
| Snacks | Kitchen | Croissant (180), Banana Bread (150), Granola Bar (120) |
| Breakfast | Kitchen | Full English (650), Avocado Toast (420), Pancake Stack (380) |

### Shifts (for today's date)
- [ ] Morning shift: **6:00 AM – 2:00 PM** — assigned to Peter (Waiter), James (Chef), Grace (Barista)
- [ ] Afternoon shift: **2:00 PM – 10:00 PM** — assigned to one other waiter (Town branch for context)

### Seed Data (Orders — Kingz branch)
- [ ] Run the seed script for 7 days of historical data (use `--days=7 --min-orders=12 --max-orders=30`).
- [ ] Today: at least 12 closed orders before recording starts (so reports look populated).
- [ ] Yesterday: ~10 closed orders (so today shows a positive delta on the Director dashboard).
- [ ] At least 1 active (non-closed) order on the Kingz feed when recording Scene 2.
- [ ] Peter (Waiter) has already clocked in — James (Chef) has NOT (for the override demo).

### Pre-seeded Orders for Reports (Scene 6)
- [ ] James Kariuki: 8+ kitchen tickets this month, average prep time under 8 minutes.
- [ ] Peter Gitau: 20+ orders this month, average order value > KES 400.

### Browser Tab Layout Before Hitting Record

| Tab # | Account | URL | Window |
|-------|---------|-----|--------|
| 1 | Director | `/app/director` | Main (1440 px wide) |
| 2 | Manager Kingz | `/app/manage/dashboard` | Main (1440 px wide) |
| 3 | Admin | `/app/admin` | Main (1440 px wide) |
| 4 | KDS (Kitchen) | `/app/kitchen` (KDS page) | Second window or second monitor (1280 px) |
| 5 | Waiter | `/app/orders` | Chrome DevTools mobile emulation — iPhone SE (375 × 667) |

All tabs: fully loaded, no spinners, not on the login page.

---

## 6. Recording Tips

### Window Size and Zoom

- **Desktop scenes (Director, Manager, Admin):** Record at **1440 × 900**. Set browser zoom to **90%** so all dashboard panels are visible without horizontal scroll.
- **Mobile scene (Waiter):** Use Chrome DevTools → Device Toolbar → iPhone SE (375 × 667). Record the full browser window, not just the emulated area — the device frame looks polished in the final video.
- **KDS scene:** Record at **1280 × 800**, browser zoom **100%** — the three-column Pending / In-Progress / Ready layout fits cleanly.

### Single Take vs Separate Clips

Record these as **separate clips** and edit together:

| Clip | Reason |
|------|--------|
| Scene 1 (Director) | Independent; different account; can be re-recorded without affecting other sessions |
| Scene 3 + 4 (Waiter → KDS) | Must be recorded together in one take or with precise timing — the Socket.io real-time update is the hero moment. Use two windows side by side on a wide monitor (2560 px or ultrawide). |
| Scene 5 (Mark Ready → Payment) | Continuation of Scene 3+4. Record as one take: KDS marks Ready → cut to Waiter mobile updating. |
| Scene 2 (Manager + Override) | Separate clip; the override action requires the chef to be NOT clocked in. |
| Scene 6 (Manager Reports) | Separate clip; pre-run the report query before recording starts so there is no wait time — just hover over "Run Report" and click on camera. |
| Scene 7 (Admin) | Separate clip; completely independent session. |
| Scene 8 (Montage) | Compile from screenshots/clips of the above — not a live recording. |

### Two-Device Flows (Scene 3–5)

Scene 3 (Waiter submits order) and Scene 4 (KDS receives it) **require two visible windows simultaneously**. Recommended setup:

- Use a **wide monitor (2560 px or two monitors)**: Waiter Chrome DevTools window on the left half, KDS window on the right half.
- In the Loom/OBS recording, crop to show both halves. Add a thin dividing line in post-production.
- Alternatively: record each side separately and use a split-screen edit. The real-time Socket.io update can be faked convincingly by pre-staging the KDS with the order already pending and then clicking Claim.

### Handling the Geofence (No Real GPS During Recording)

**Do not attempt a live geofence clock-in during the demo recording.** Screen recordings do not expose real GPS signals, and the error state is ugly and distracting.

Instead:
- **In Scene 2**, demonstrate the **manager override flow** (which is itself a key feature). This turns the limitation into a strength — the audience sees that the manager has full control and that overrides are audited.
- In the voiceover, briefly explain: "If a team member's GPS is blocked — indoors, or a weak signal — the manager can override from the dashboard with a reason on record."
- Pre-clock-in the waiter (Peter) before recording starts via manager override, so the dashboard shows a mix of clocked-in and not-clocked-in staff.

### B-Roll Moments to Capture

These short clips (2–4 seconds each) make the edit feel dynamic and alive. Record them as extras:

| B-Roll Shot | How to Capture |
|-------------|----------------|
| KDS audio ping on new order | Submit a test order while screen recording with audio — the ping plays automatically. |
| Order status badge changing colour in real time (Waiter mobile) | Have someone submit an order on a second account and watch the waiter's Orders list update without a refresh. |
| Director Dashboard "Live" indicator pulsing | The animated green dot on the Live Operations Pulse panel — hover near it for 3 seconds. |
| Export PDF download bar appearing | Click Download PDF and hold on the browser bottom bar as the file downloads. |
| Shift calendar in month view | Scroll the Shifts page to month view and let the coloured cells fill in — visually rich. |
| Manager override confirmation toast | After confirming the override, the success toast fades in at the top — capture this moment. |
| Stat card number incrementing | After closing an order, the Closed Orders stat card updates — hold on it for 3 seconds. |

---

## 7. AI Voiceover Prompt

Paste this prompt directly into ElevenLabs, Play.ht, or equivalent:

---

**Voice Character Prompt**

> **Voice:** Professional African female presenter. Warm, measured, and confident — like a trusted business consultant presenting findings to a boardroom.
>
> **Accent:** Neutral East African/Kenyan English. Clear diction. Not British, not American. Natural Kenyan cadence — unhurried, deliberate, with gentle emphasis on key words.
>
> **Pace:** Moderate — approximately 140 words per minute. Slow down slightly on technical terms (KES amounts, feature names). Never rush.
>
> **Tone:** Assured and benefit-focused. Every sentence conveys quiet competence. This is not a sales pitch — it is a demonstration of something that already works. The audience should feel they are being shown something built specifically for them.
>
> **Emotion:** Warm professionalism. A hint of pride. No excitement or hype. No upward inflections at the end of sentences. Statements, not questions.
>
> **Pauses:** Insert a natural half-second pause after each sentence. Insert a full one-second pause between scenes. Do not rush transitions.
>
> **Do not:** Speed up, add filler sounds ("um", "uh"), over-enunciate, sound robotic, or use a sing-song pattern.
>
> **Reference voices:** Think Yvonne Orji (professional register), or the tone of a well-produced Safaricom enterprise product video — grounded, polished, local.

---

**Technical settings (ElevenLabs):**
- Stability: 0.55
- Clarity + Similarity: 0.75
- Style: 0.20
- Speaker boost: ON

---

*End of Demo Script — Wendo RMS v1.0*
*Document prepared: March 2026*
