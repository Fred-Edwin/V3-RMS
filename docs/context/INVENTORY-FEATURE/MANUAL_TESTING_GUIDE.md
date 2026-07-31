# Test the Inventory Module Yourself

A self-guided walkthrough of every Phase 1 workflow, using the same real
supplier data seeded for the Gate trial — not placeholder numbers. Follow it
in order; later steps build on earlier ones.

Local only. Requires the backend (`:4000`) and frontend (`:3000`) dev servers
running. Last verified 2026-07-29.

| | |
|---|---|
| **Store Manager** | `store.manager@wendo.test` |
| **Store Attendant** | `store.attendant@wendo.test` |
| **Password (both)** | `password123` |
| **URL** | `localhost:3000/login` |

## On this page

1. [Before you start](#before-you-start)
2. [The catalog & suppliers](#1-the-catalog--suppliers)
3. [Raise, send & receive a PO](#2-raise-send--receive-a-po)
4. [Prep entry & the rolling average](#3-prep-entry--the-rolling-average)
5. [Stock counting](#4-stock-counting)
6. [Waste logging](#5-waste-logging)
7. [Supplier AP](#6-supplier-ap)
8. [Reports](#7-reports)
9. [The Gate criteria](#the-gate-criteria)

---

## Before you start

Two servers need to be running. If either isn't up:

1. Backend: from `backend/`, confirm with `curl -s http://localhost:4000/api/v1/health`. If it's not responding, it's usually already running via `tsx watch src/server.ts` — check for that process before starting a new one.
2. Frontend: from `frontend/`, run `npx next dev -p 3000` if `localhost:3000/login` doesn't load.

> **Known quirk:** the health check may show `"redis":"down"` — that's a
> pre-existing sandbox condition, not something you broke. Ignore it.

The database already has real data seeded: 24 catalog items transcribed from
the client's actual Samrat Supermarket and Summer Limited invoices, 3
purchase orders, a completed prep run, an approved stock count with real
variances, a waste entry, and a part-paid supplier invoice. Everything below
tells you what to expect against *that specific data* — if a number doesn't
match, that's worth flagging.

---

## 1. The catalog & suppliers

**Role:** Manager · **Shell:** Desktop

Log in as the Manager. This is the one-time setup a real Central Store would
do before anything else — know what you stock, and who supplies it.

1. Go to **Item Catalog** in the left sidebar. You should see **24 active items** across three types — Raw Ingredient, Prepped, and Pass-Through.
2. Find **Kamal Gram Flour** in the list. Its **Current Cost** should read `Ksh 243`.
3. Go to **Suppliers**. You should see three: **Samrat Supermarket**, **Summer Limited**, and **Nyeri Fresh Meat & Dairy**.
4. Click into Samrat Supermarket. Open the **Items & Pricing** tab and find any item that appears on both a 07-Jul and 21-Jul delivery — the price history should show two distinct points, not one.

> **Why Ksh 243:** Kamal Gram Flour was delivered twice at different real
> prices — 3kg at Ksh 259 on 07-Jul, then 2kg at Ksh 219 on 21-Jul. The
> system doesn't just take the latest price; it blends by quantity:
> (3×259 + 2×219) ÷ 5 = **243**. This is the weighted-average costing the
> whole module is built around — if you ever see a cost that looks like
> "just the last price," that's worth flagging.

---

## 2. Raise, send & receive a PO

**Role:** Manager + Attendant · **Shell:** Desktop + Mobile

This is the core purchasing loop. You'll raise a draft, send it, then
receive it — on different roles and screen sizes, since that's where seams
tend to hide.

### 2a. Raise a draft (Attendant, mobile)

1. Log out, log back in as the Attendant. On a phone, or resize your browser to roughly 390×844.
2. Tap **Orders** → the floating **+** button to start a new Purchase Order.
3. Pick any supplier, add one or two items with a quantity each, and save as draft.

> **Watch for:** No **Send** action should appear anywhere on this screen
> for the Attendant — only the Manager can send a PO. If you see one,
> that's a permissions leak.

### 2b. Send it (Manager, desktop)

1. Log back in as the Manager, at a wide window (roughly 1600×1000 or maximized).
2. Open **Purchase Orders**, find the draft you just created, click it.
3. Click **Send**, confirm in the sheet that appears.

> **Expect:** A toast confirming it was sent, the status badge flips from
> **Draft** to **Sent**, and the same panel transitions straight into the
> receiving view with quantities prefilled — no extra navigation needed.

### 2c. Receive it, with a deliberate discrepancy

1. Still in that panel, change the **Actual Qty** on one line to something slightly different from what was ordered (e.g. order 10, receive 9).
2. Adjust the **Invoice Price** slightly too — suppliers' real prices rarely match the PO exactly.
3. Click **Confirm** on that line.

> **Expect:** A red highlight and a note like "1 kg less than ordered." The
> PO status becomes **Partially Received** if any line is short — it only
> reaches **Closed** once every line's received quantity meets or exceeds
> what was ordered.

> **Also check:** Go to **Stock on Hand** and find the item you just
> received — its **Current Cost** should have moved, blended against
> whatever was already on hand, the same weighted-average logic as Step 1.

---

## 3. Prep entry & the rolling average

**Role:** Attendant · **Shell:** Mobile

Prep has no fixed recipe — you log what you actually used and what you
actually got out, every time. The system learns the typical ratio from your
own history.

1. As the Attendant, go to **Prep**.
2. For **What are you preparing?**, search and select **Prepped Simple Syrup** — it already has one prep run in its history.
3. Look above the yield field before entering anything.
4. Add an input line: **Kabras Sugar**, any quantity. Enter an actual yield. Confirm.

> **Expect:** A hint reading *"Typical for this item: ~5.0 L input → ~9.5 L
> output — based on rolling average of last 1 prep records."* It's
> informational only — it should never block you from entering a different
> amount, and it should update to say "2 prep records" after you confirm
> this one.

---

## 4. Stock counting

**Role:** Manager + Attendant

An **Opening Physical Count** session is already seeded and approved — use
it to check the blind-count rule, then optionally run a fresh one
end-to-end.

### 4a. Check the blind count (Attendant)

1. As the Attendant, open **Stock Count** → **Opening Physical Count**.

> **This is the rule to break, if it's going to break:** The Attendant must
> never see an **Expected** quantity, before or after submission — only
> what they themselves counted. If an expected figure appears anywhere in
> this view, that's a real bug, not a display nuance.

### 4b. Check the variance (Manager)

1. As the Manager, open the same session.

> **Expect:** A full Expected / Counted / Gap table. Kabras Sugar should
> show a −2 kg gap, Fresh Milk a +1 L gap, and Prestige Margarine and
> Chicken Breast at exactly zero — already approved, with those adjustments
> already posted to **Stock on Hand**.

---

## 5. Waste logging

**Role:** Manager + Attendant

1. As the Attendant, go to **Waste Log**, log any item with a reason.
2. Log out, log in as the Manager, open **Waste Log** again.

> **Expect:** The Manager sees every entry, including yours and the seeded
> **Fresh Milk — Spoiled** one. There's no separate "view full log" screen
> for the Attendant — that's deliberate, not missing; the Attendant only
> ever sees the entry form.

---

## 6. Supplier AP

**Role:** Manager only · **Shell:** Desktop

1. As the Manager, go to **Suppliers** → **Summer Limited** → the **Accounts Payable** tab.
2. Find invoice **SINV57141**.

> **Expect:** Ksh 35,670 billed, Ksh 20,000 paid, status **Partially Paid**.
> Try recording a further payment of Ksh 15,670 — the status should flip
> to **Paid** exactly at that point, not before.

> **Try logging in as the Attendant** and navigating to a supplier's AP tab
> directly. It should not be there at all — not greyed out, not
> read-only. Zero access is the actual rule here.

---

## 7. Reports

**Role:** Manager only · **Shell:** Desktop + Mobile

Seven reports live under **Reports**. On desktop all seven render in full;
on mobile, three (Stock Valuation, Low Stock Alerts, Price History) get a
real simplified view and the other four show their headline number with a
note pointing to desktop — that's an intentional v1 scope line, not a gap.

| Report | Expect (seeded data) |
|---|---|
| Stock Valuation | ~Ksh 108,687 total |
| Low Stock Alerts | 8 items |
| Price History | 24 items tracked |
| Prep Yield | 2 runs (after Step 3) |
| Count Discrepancy | 3 non-zero variances |
| True Cost per Prepped Item | Prepped Simple Syrup priced |
| Supplier AP Aging | Summer Limited outstanding |

> **Exact figures will drift** as you complete the earlier steps — that's
> expected, not a bug. Use this table as a sanity range, not a pass/fail
> check.

---

## The Gate criteria

Per the feature plan, Phase 1 passes when, over one real week run in
parallel with paper: the ledger reconciles with a physical count, prices
match invoices, and staff can operate it unassisted. Steps 1–4 above are
exactly those three things, exercised against real numbers rather than
placeholders:

- **Ledger reconciles** — Step 4's variance table, adjustments already posted.
- **Prices match invoices** — Steps 1 & 2's weighted-average costing, checked against the client's real transcribed prices.
- **Staff can operate it unassisted** — every step above uses only what's on screen, no hidden knowledge required.

---

*Wendo RMS · Inventory & Procurement, Phase 1 (Central Store) · full spec in
`docs/context/INVENTORY-FEATURE/INVENTORY_FEATURE_PLAN.md`*
