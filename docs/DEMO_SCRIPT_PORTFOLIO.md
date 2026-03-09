# Wendo RMS — Portfolio Demo Script

**Audience:** Developers, hiring managers, potential clients viewing a portfolio.
**Goal:** Show product scope, system complexity, and UI/UX polish — not a business workflow tutorial.
**Target Length:** 2–3 minutes
**Format:** AI-narrated screen recording, fast-paced, visually led.

---

## 1. Narrative Arc

> "This is a full-stack restaurant management system built for a real business — a premium coffee bistro expanding from two branches to ten. Six user roles. Real-time order routing. Geofenced clock-in. Multi-branch reporting. Everything running on one codebase, on every device the team already owns."

The demo is not a feature tour. It is a proof of scope. The audience should leave thinking: *this person built something genuinely complex and made it feel simple.*

---

## 2. Shot List

---

### Scene 1 — "What Is This System?" (20 s — opening montage)

**What to show:** Rapid-fire cuts across four different role interfaces, no narration yet — just music bed under the opening line.

**Steps:**
1. Director Dashboard — wide desktop, Live Operations Pulse visible, two branch rows, green delta badges on stat cards.
2. Waiter mobile (Chrome DevTools 375 px) — menu grid, item cards with images, cart open with KES totals.
3. KDS tablet view — three-column Pending / In-Progress / Ready layout, a ticket card mid-animation moving columns.
4. Manager Dashboard — stat cards row, Active Orders feed, Staff On Shift panel side by side.
5. Hold on Manager Dashboard. Voiceover begins.

**Voiceover:** See Section 4, [SCENE 1]

**Duration:** 20 seconds

**What to have ready:**
- All four windows pre-loaded, no spinners.
- KDS has 2 tickets visible across columns so the layout reads immediately.
- Waiter cart is open and showing 3 items.

---

### Scene 2 — "Six Roles, One System" (25 s)

**What to show:** Navigate the sidebar/bottom nav for two roles to show how the interface changes shape by role.

**Steps:**
1. Manager sidebar — show the full left nav: Operations (Dashboard, Orders), Manage (Staff, Menu, Shifts, Delivery Zones), Reports. Point to it briefly.
2. Switch to Waiter mobile — show the bottom nav tabs: Dashboard, New Order, Orders, Shifts. Then tap the overflow menu to reveal Performance and History.
3. Switch to Director — the minimal sidebar: Dashboard, Reports, Profile. Clean. Nothing irrelevant.
4. Return to Manager. Click "Staff" in the sidebar — the Staff Management page opens showing role badges (tan Waiter, orange Chef, green Barista).

**Voiceover:** See Section 4, [SCENE 2]

**Duration:** 25 seconds

**What to have ready:**
- Three browser windows open: Manager (1440 px), Waiter DevTools (375 px), Director (1440 px).
- Staff page has 5–6 staff accounts visible with varied roles so the colour-coded badges are readable at a glance.

---

### Scene 3 — "Order Routing in Real Time" (35 s)

**What to show:** Waiter submits an order → the correct station receives it instantly. This is the technical centrepiece.

**Steps:**
1. Waiter mobile: open New Order. Browse to "Hot Drinks" → add Cappuccino × 2. Browse to "Meals" → add Chicken Sandwich × 1.
2. Open cart modal — show 3 items, KES total, Dine-In selected, Table 5, comment field.
3. Tap Submit. Order confirmed — number appears.
4. **Immediate cut** to KDS — the food ticket (Chicken Sandwich only) appears in Pending with the audio ping. Show the card: order number, table, item, comment, elapsed timer starting.
5. **Cut back** to a Barista Display tab — the drink ticket (Cappuccino × 2) appears there separately. Hold for 1 second.
6. Hover over the KDS ticket to show the Claim dropdown. Select a chef name. The card slides to In-Progress.

**Voiceover:** See Section 4, [SCENE 3]

**Duration:** 35 seconds

**What to have ready:**
- Waiter window (375 px DevTools) — cart empty, ready to build an order.
- KDS window (1280 px) — clean, no existing Pending tickets so the new one is immediately obvious.
- BDS (Barista Display) window — also clean, a third browser tab/window.
- Chef "James Kariuki" is on shift and appears in the claim dropdown.
- Record Scenes 3+4 in a single continuous take across all three windows (wide monitor or alt-tab).

---

### Scene 4 — "Multi-Branch Reporting" (30 s)

**What to show:** Director dashboard breadth, then Manager reports depth. Show both export formats.

**Steps:**
1. Director Dashboard — scroll past the Live Pulse to the Daily Branch Breakdown. Two branch cards visible: each showing revenue in KES, order type split bar, top 3 items ranked.
2. Hover over the export button — popover shows "Download PDF" and "Download CSV".
3. Click Download PDF — browser download bar appears. Hold 1 second.
4. Switch to Manager Reports page (`/app/manage/reports`). Show the filters (date range, role filter). Click Run Report.
5. Staff Performance table populates — show a chef row with avg prep time, a waiter row with orders handled and avg order value, the attendance column (scheduled vs actual hours).
6. Zoom in slightly on the table for 2 seconds — let the data read.

**Voiceover:** See Section 4, [SCENE 4]

**Duration:** 30 seconds

**What to have ready:**
- Director Dashboard: 7 days of seeded data, both branches showing revenue > KES 10,000 for today.
- Manager Reports: month-to-date range pre-filled. "Run Report" NOT yet clicked — click on camera.
- At least 3 staff rows in the performance table with meaningful numbers (no zeroes).

---

### Scene 5 — "Every Device, One Codebase" (25 s — closing)

**What to show:** Side-by-side layout emphasising the responsive design and mobile-first architecture.

**Steps:**
1. Show Manager Dashboard on a wide desktop (1440 px) — full sidebar, two-column panel layout.
2. Resize the same browser window to 768 px — the layout collapses to mobile: sidebar disappears, bottom nav appears, panels stack vertically. Do this live on screen.
3. Switch to Waiter mobile (375 px DevTools with iPhone SE frame) — browse the menu grid. Items have images. The grid is clean, touch-friendly.
4. Tap an item — the add-to-cart sheet slides up from the bottom. It feels native.
5. Hold on this moment. Fade to a plain dark background with a single line of white text.

**End card text (on screen, no voiceover):**
```
Next.js 14 · TypeScript · Node.js · PostgreSQL · Prisma · Redis · Socket.io
github.com/[your-handle]/wendo-rms
```

**Voiceover:** See Section 4, [SCENE 5]

**Duration:** 25 seconds

**What to have ready:**
- Manager Dashboard open at 1440 px — ready to resize live.
- Waiter DevTools window with iPhone SE frame visible, menu grid loaded with item images.
- End card: prepare a static image or a Canva slide with the tech stack line and GitHub URL — overlay in post-production, do not try to type this live.

---

## 3. Scene Order Summary

| # | Scene | Focus | Duration |
|---|-------|-------|----------|
| 1 | Opening montage | Scope at a glance | 20 s |
| 2 | Six roles, one system | Role-based access, nav design | 25 s |
| 3 | Order routing in real time | Socket.io, split routing, KDS/BDS | 35 s |
| 4 | Multi-branch reporting | Data depth, PDF/CSV export | 30 s |
| 5 | Every device, one codebase | Responsive design, mobile-first | 25 s |

**Total: ~2 min 15 s** (leaving ~45 s buffer for intro music, transitions, and the end card hold)

---

## 4. Full Voiceover Script

---

**[SCENE 1 — Opening, over montage cuts]**

This is Wendo RMS — a multi-tenant restaurant management system built from scratch for a premium coffee bistro with two branches, scaling to ten. Six user roles. Real-time order routing. Geofenced attendance. Full reporting. One codebase.

---

**[SCENE 2 — Six roles, one system]**

Every role gets a completely different interface — built from the same codebase. The Manager has a full sidebar with operational and administrative sections. The Waiter gets a mobile-first bottom navigation — nothing they don't need. The Director sees a minimal, high-signal dashboard. Role-based access is enforced at every layer: middleware, service, repository, and query — branch data never crosses boundaries.

---

**[SCENE 3 — Order routing in real time]**

When a waiter submits a dine-in order with both food and drinks, the system splits it automatically: food items route to the Kitchen Display, drink items to the Barista Display — in real time, over WebSockets. Each station sees only its own tickets. The chef claims the order from the shared tablet or their own phone, and the card moves to In-Progress across every connected client simultaneously. No polling. No refresh.

---

**[SCENE 4 — Multi-branch reporting]**

The Director gets a live cross-branch view — revenue in Kenya Shillings, order type breakdown, top-selling items — across every branch, updated as orders close. One click exports a branded PDF or a CSV. The Manager drills deeper: a staff performance report showing every team member's orders handled, average prep time, and scheduled versus actual hours worked — exportable, printable, scoped strictly to their branch.

---

**[SCENE 5 — Every device, one codebase]**

The same Next.js application adapts to any screen. The Manager's full-panel dashboard collapses cleanly to a mobile layout without a native app. Waiters and kitchen staff use it on their personal phones — no install, just a browser. The design system is built on a warm espresso and cream palette, crafted to feel like the brand it represents, not a generic SaaS product. Built for real people doing real work.

---

**[END CARD — hold 4 s, no voiceover]**

*(Tech stack line + GitHub URL on screen)*

---

## 5. Pre-Demo Setup Checklist

### Accounts to Be Logged In

| Window | Account | Role | URL |
|--------|---------|------|-----|
| Main (1440 px) | `manager.kingz@wendo.co.ke` | MANAGER | `/app/manage/dashboard` |
| Tab 2 | `director@wendo.co.ke` | DIRECTOR | `/app/director` |
| Tab 3 | `admin@wendo.co.ke` | SYSTEM_ADMIN | `/app/admin` |
| Second window (1280 px) | KDS account | KDS display | `/app/kitchen` |
| Third window (1280 px) | BDS account | BDS display | `/app/barista` |
| DevTools window (375 px) | `waiter.kingz@wendo.co.ke` | WAITER | `/app/orders` |

### Data Requirements

- [ ] 7 days of seeded order history across both branches.
- [ ] Today: 12+ closed orders on Kingz — so Director branch card shows meaningful KES revenue.
- [ ] Staff performance table: at least 3 staff with non-zero data this month.
- [ ] Menu items have images uploaded (Cloudinary) — the Waiter menu grid should look visually rich.
- [ ] Morning shift assigned to Peter (Waiter), James (Chef), Grace (Barista).
- [ ] KDS clean (no Pending tickets) immediately before recording Scene 3.
- [ ] Waiter cart empty immediately before recording Scene 3.

### What NOT to Show

- The login page (start all sessions pre-authenticated).
- Any loading spinner (wait for all data to load before the recording frame enters the screen).
- The geofence clock-in flow (it requires real GPS — leave it out of the portfolio demo entirely).
- Any error states or empty states.

---

## 6. Recording Tips

### Window / Zoom Settings

| Scene | Resolution | Zoom |
|-------|-----------|------|
| Scenes 1, 2, 4, 5 (Desktop) | 1440 × 900 | 90% |
| Scene 3 KDS / BDS | 1280 × 800 | 100% |
| Scene 3 Waiter mobile | Chrome DevTools iPhone SE (375 × 667) | 100% (DevTools zoom) |
| Scene 5 responsive resize | Start 1440, drag to 768 live | — |

### Clip Strategy

Record these as **separate clips** — the live order routing (Scene 3) is the only one that requires precise multi-window timing:

| Clip | Notes |
|------|-------|
| Clip A — Opening montage | Compile screenshots/clips in post. Not a live recording. |
| Clip B — Scenes 2 + partial 5 | Role nav switching. One take. |
| Clip C — Scene 3 (order routing) | The critical clip. Record on a wide monitor with Waiter left, KDS centre, BDS right. One continuous take. Rehearse twice before recording. |
| Clip D — Scene 4 (reporting) | Director → Manager reports. One take, Director tab → Manager Reports tab. |
| Clip E — Scene 5 responsive | Resize live from 1440 → 768, then switch to DevTools window. |

### The Scene 3 Real-Time Moment

This is the centrepiece of the portfolio demo — the Socket.io update must land on screen naturally. To maximise your chances:

1. Do a **dry run** first: submit a test order, confirm the KDS and BDS both receive it, and that the claim dropdown shows a chef name.
2. Record with **OBS** (not Loom) so you can capture the full desktop including both windows simultaneously. Then crop in post.
3. If the socket update lags or fails on camera: cut immediately after the waiter submits, then cut to a KDS window that already has the ticket — the audience cannot tell. Label this as "real-time routing" in the voiceover and move on.

### B-Roll Moments Worth Capturing

| Shot | Where | Duration |
|------|-------|----------|
| KDS audio ping on new order | Scene 3 | 2 s |
| Order card sliding from Pending → In-Progress | Scene 3, KDS | 2 s |
| Manager sidebar expanding a nav section | Scene 2 | 1 s |
| Role badge colour variety (tan/orange/green) on the Staff page | Scene 2 | 2 s |
| Export PDF download bar appearing in browser chrome | Scene 4 | 2 s |
| iPhone SE frame with menu item image visible | Scene 5 | 2 s |
| Live browser resize (1440 → 768) — sidebar collapsing in real time | Scene 5 | 3 s |

### Pacing Notes

- This demo is **visual-first** — let the screen carry the story. Voiceover fills in technical context, not what the viewer can already see.
- Transitions: use a **0.2 s fade to black** between scenes. Faster than the business demo — portfolio audiences have shorter attention spans.
- Music bed: a low, clean lo-fi or minimal electronic track at 20–25% volume underneath the voiceover. Fade out completely on the end card hold.
- Do not add lower-thirds or call-out boxes during recording — add them in post (CapCut, DaVinci Resolve, or Descript) so recording stays clean.

---

## 7. AI Voiceover Prompt

Paste directly into ElevenLabs or Play.ht:

---

> **Voice:** Confident, technical, slightly fast-paced. Male or female — whichever sounds most like a senior engineer presenting their own work. Clear diction. Neutral accent (not strongly regional).
>
> **Tone:** Precise and matter-of-fact. This is a developer showing their work to other developers and technical evaluators. No hype, no sell. Think: a well-prepared conference talk or a Fireship.io video — authoritative, slightly brisk, respectful of the audience's intelligence.
>
> **Pace:** 155–165 words per minute. Faster than a business demo. Pause briefly (0.3 s) between sentences. Full pause (0.8 s) between scenes.
>
> **Do not:** Over-enunciate. Sound enthusiastic. Add filler sounds. Slow down for effect — trust the pacing.
>
> **Reference tone:** Josh Comeau's voice in his blog video demos, or Theo (t3.gg) in a calm moment — knowledgeable, unperformative, straight to the point.

**Technical settings (ElevenLabs):**
- Stability: 0.45
- Clarity + Similarity: 0.80
- Style: 0.10
- Speaker boost: OFF

---

*End of Portfolio Demo Script — Wendo RMS v1.0*
*Companion document: `docs/DEMO_SCRIPT.md` (business/owner-facing demo)*
