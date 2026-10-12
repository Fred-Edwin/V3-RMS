# Block 6 Paper spec: Purchasing, Store Attendant phone (steps 28A to 28Q)

Read 11 Oct 2026 from Paper file "Wendo RMS · Approved designs", page "Inventory · Purchasing", artboard "Chapter 9 · The Store Attendant's day" (`get_jsx`, inline styles, every screen once). Steps 30 and 31 are unchanged (the existing Receive screen); old steps 28 and 29 are deleted. **Paper wins over documents.** API: `purchasing-attendant-api.md`. Code state checked on branch `feat/block6-contract`. No screen, route or back-end change is made by this file.

Reading the tables: sizes are px; "ink" = `--color-ink` #171512; "muted" = `--color-text-muted` #635E57; "faint" = `--color-text-faint` #8D8982; "border" #E4E2DE; "border-strong" #D2CFC9; "primary" = `--color-primary` #B0610F (the "caramel ring" colour). Fonts: **Geist** (sans) and **Geist Mono**; code tokens are `font-wds-sans` and `font-wds-mono`. Every phone frame is 390 wide, 844 tall in Paper, background `--color-bg` #FCFCFC.

Status tones (fg / bg / border): success #2F6438 / #EEF4EC / #CADFC6; warning #8A5A16 / #FBF2E4 / #E7D3AC; error #97281D / #FBEDEB / #E6BEB7; info #2C5670 / #ECF2F5 / #C1D4DF.

---

## 1. Shared pieces (built once)

### 1.1 Stage tracker (one component, two forms)
Six stages: Raised, Approved, Sent, Delivered, Invoiced, Paid. `TrackerItem` states DONE / CURRENT / TODO (already the type).

| Part | Done | Current | To do |
|---|---|---|---|
| Circle | 16 × 16, fill #2F6438, white check (svg 16 box, path `M4.6 8.3l2.3 2.3 4.5-4.9`, stroke white 1.8, round caps) | 16 × 16, fill white, 2 px ring #B0610F | 16 × 16, fill white, 2 px ring #D2CFC9 |
| Connector after it | 2 px high, grows, #2F6438 | 2 px, #D2CFC9 | 2 px, #D2CFC9 |
| Label (labelled form) | Geist 10/12, ink | Geist 10/12, **600**, #B0610F | Geist 10/12, muted |

- **Unlabelled form** (cards on 28A, 28F, and the strip on 28H): one row, circles joined by connectors, `align-items:center`, six circles, no labels, no gap.
- **Labelled form** (28C, 28D, 28J, 28K, 28L): white strip, padding 12 × 20, border-bottom 1 `border`. Five equal columns (`flex 1 1 0`, gap 5 between circle row and label) plus a last column of fixed 32 px (Paid) with no connector. 28H's strip has no labels (see Q-09).
- Circle row is `display:flex; align-items:center`; the last stage in the unlabelled form has no connector after it.
- Code today: `compact-tracker.tsx` draws a 10 px dot, no check, labels 11/14. **Change** to the above (16 px, check, ring primary, labels 10/12, two forms). Check every other caller (the desktop file, the old Receive screen) still reads right.

### 1.2 Phone header (dark band)
| Part | Value |
|---|---|
| Band | bg `--color-sidebar-top` #2E1806, padding-inline 16, padding-bottom 16 (28A: 18), gap between rows 12 (28C, 28D, 28H, 28J, 28K, 28L use 10) |
| Padding-top | **8** on 28A to 28E, **21** on 28F to 28N and 28P (see Q-01) |
| Row 1 | space-between. Left: leading icon, gap 12, eyebrow. Right: avatar (28A also has the bell) |
| Leading icon | Home: hamburger, svg 20, strokes #F5F3EF 2 px round. Others: "←" glyph 20/20 #F5F3EF (build as the existing 20 px arrow svg) |
| Eyebrow | "WENDO RMS · HUB", Geist 12/16, letter-spacing 0.06em, #B98A5E |
| Avatar | 28 × 28, radius 14, bg #4E2C14, initials Geist 11/14 #EEDDCC |
| Title | Geist 22/28, 600, letter-spacing −0.01em, #FCFCFC |
| Subtitle | Geist 12/16, #B5AEA5 |
| Search field (when present) | bg white, radius 2, height 44, padding-inline 14, gap 10; icon 16 (circle r 7 + handle, stroke #847E76 2); placeholder Geist 14/18 faint |
| Right-aligned link (28F, 28N) | bottom-aligned with the title block: "History ›" Geist 13/18 / "Mark all read" Geist 13/16, colour `--color-caramel-300` #EFCF9E |

- **Bell (28A only):** a 24 × 24 box left of the avatar (gap 12). Bell svg 22 (left 1, top 2), stroke #F5F3EF 1.8. Unread badge: min-width 16, height 16, radius 8, bg #B0610F, padding-inline 4, text white Geist 10/12 600, position right −4, top −3. Count = `badges.unreadNotices`; no badge when 0 (see Q-03). Tap opens 28N.
- Code today: `ScwPhoneHeader` (mono eyebrow 11, avatar 30, pt 20 + 4, subtitle 13/18) and `B2Header` (non-tabbed: sans eyebrow 12 tracking 0.06em, avatar 28, title tracking −0.01em, `p-4`) exist. `B2Header` with `small` matches Paper on every value except top padding and the bell; **change**: add a `bell` slot and the two top paddings, do not fork a third header.

### 1.3 Chips (filter row)
| Part | Value |
|---|---|
| Row | bg white, padding 12 × 20, gap 8, border-bottom 1 `border` (28N, 28E, 28F, 28B) |
| Chip | height 30, padding-inline 12, **radius 2**, label Geist 12/16, "Label · count" |
| Active | bg `--color-espresso-700` #693C1B, text #FCF7F2 weight 500, no border |
| Inactive | white, border 1 border-strong, text ink, weight 400 |
| Dot (28B Out/Low only) | 6 × 6 round, error-fg / warning-fg, gap 6 before the label |

### 1.4 Dropdown buttons (28G, 28P)
Row bg #FCFCFC, padding 12 × 20, gap 8, no border. Button: height 34, padding-inline 12, white, border 1 #D2CFC9, radius 0, Geist 13/16 ink, text "Date: Last 30 days ▾", "Status: All ▾", "Supplier: All ▾". Code: `PhoneFilterSelect` exists; the Date one opens the bottom sheet of 28G2.

### 1.5 Section labels
Mono 11/14, letter-spacing 0.08em, muted, upper case ("NEEDS YOU NOW · 2"). Small form (inside cards' sub-headers, 28D, 28Q table, 28G2): mono 10/12, 0.06em. Code: `SectionLabel`.

### 1.6 Cards and rows
- **Card:** white, border 1 `border`, radius 4. Variants: border `error-border` (overdue card on 28F).
- **Card header strip** (items cards): padding 10 × 14, border-bottom 1 `border`, section label inside. **Item row:** padding 10 × 14, border-bottom 1 `border` (last none), name Geist 13/16 ink left, quantity (and price) Geist Mono 12/16 muted right ("6 sack · 2,400").
- **List row** (28B, 28E, 28G): white, padding 12 × 20, border-top and bottom 1 `border` (border-top only on the first row of a group), gap 12; name Geist 14/18 500 ink; sublines Geist 12/16 or mono 11/14; chevron "›" Geist 16/18 faint.
- **Status line:** 6 × 6 round dot (gap 6) then Geist 12/16 text in the same tone ("0 left · reorder at 8 jerrican").
- **Status pill** (28F): padding 3 × 8, **radius 0**, bg/border of the tone, text Geist 11/14 in tone fg.
- **Banner:** card radius 4, border 1 and bg of the tone, padding 12 × 14, gap 4; title Geist 14/18 600 (13/16 600 on 28H) in tone fg; body Geist 13/18 ink. Code: `B2Banner`.

### 1.7 Buttons
| Button | Value |
|---|---|
| Primary | gradient 180° #B0610F → #4A1D00 (`--color-primary-btn-end`), radius 2, inset shadow `#FFFFFF26 0 1px 0`, text #FCF7F2 Geist 500. Sizes: sticky bar 48 high (text 15/20); home and list bar 46 high (15/20); card 38 high (13/16); inline 34 × 84 (13/16); notification action 32 × 128 (13/16) |
| Secondary | white, border 1 border-strong, radius 0, text ink Geist 500. Sizes: 48 (28K Remind, 15/18), 44 (28J Call supplier, 28D Print/Share with 16 px icon gap 8, 13/16), 38 × 84 "Open" (13/16, weight 400), 34 × 84 "Receive", 32 × 128 (notifications) |
| Green | WhatsApp: bg #25D366, text #06351B Geist 13/16 600, icon 20 stroke #06351B 1.8, gap 8, height 44 (28J) or 40 (28M) |
| Text action | "Withdraw this order": Geist 13/16 error-fg, centred, no border |
| Link | "Print", "View", "See all", "Search ›": Geist 13/16 (12/16 for "See all") primary |
| Add / stepper | "Add 6 tray": 112 × 36, white, border 1 border-strong, "+" primary Geist 16/18 then label Geist 13/16 500 ink, gap 6. Stepper: 112 × 36, white, border 1 **primary**; "−" 34 wide Geist 18/20 ink; value Geist Mono 14/18 ink centred, grows; "+" 34 wide Geist 18/20 primary |
| Small "+ Add" (28E) | height 30, padding-inline 12, border-strong, Geist 12/16 500 ink |

Code: `B2PrimaryButton`, `B2SecondaryButton`, `TextAction`, `PhonePrimaryButton` exist; reuse, add sizes by prop. The stepper and "Add" button are **new** (the old screen used a checkbox and a number input).

### 1.8 Sticky bar
White, border-top 1 `border`, padding-top 12, padding-inline 20, **padding-bottom 28**, never scrolls with content (`flex-shrink:0`). Gap inside 8 (28H, 28K), 10 (28C), 14 (28B, one row with text left and button right). Code: `B2Footer`.

### 1.9 Pager bar
White, border-top 1 `border`, padding 10 × 20, padding-bottom 24, space-between. Left "Showing 1 to 20 of 46" Geist 12/16 muted. Right: buttons 32 × 32, gap 6 (28G) or 4 (28P). Current: bg #171512, text white (13/16 on 28G; 12/16 weight 600 on 28P). Others: border-strong, text ink; "‹" disabled on page 1: border `border`, text #8D8982. Number buttons shown: 1 2 3. Code: `PagerBar` (gap 4, 12 px, hides when one page, up to 5 numbers). **Change** to take the two sizes or pick one (Q-08). No rows-per-page control is drawn (Q-07).

### 1.10 Drawer links (28I)
The existing shell drawer from `nav-table.ts`; no new component. Values: drawer 310 wide over a 45 % #171512 scrim, the sidebar gradient 180° `--color-sidebar-top` #2E1806 → `--color-sidebar-mid` #2C1707 (50 %) → `--color-sidebar-bottom` #0F0601, brand "Wendo RMS" Geist 16/20 600 #FCFCFC + "HUB" mono 11/14 0.08em #B98A5E, padding 24 20 18; group label "CENTRAL STORE" mono 11/14 0.12em #B98A5E; item Geist 14/18 #D9CFC4, padding 11 × 10; active parent bg #3A2210, text #FCFCFC 500, "⌄" #B98A5E 12/16; sub-links in a rail (border-left 1 #5B3417, margin-left 20, padding-block 4), item padding 9 × 12; active sub-link has a 6 × 6 #D9A65E square at margin-left −15 and text #FCFCFC 500; count badge bg #693C1B, text #EEDDCC 11/14, padding 1 × 7, square; footer border-top 1 #3A2210, avatar 32 × 32 square #4E2C14 mono 11/14 "PK", name Geist 13/16 500 #FCFCFC, role Geist 12/16 #B5AEA5, padding-bottom 28.
Order: Receiving (badge `badges.receiving`), **Purchasing** (open) with Home, Restock list (`badges.restock`), My orders (`badges.myOrders`), History, Restock levels; then Prep, Dispatch, Stock & counts.

### 1.11 States kit (28Q)
See section 3, 28Q. Loading = grey rows, no spinner; empty = title + one line + one button; error = red card that keeps what was on screen.

### 1.12 Formats (all screens)
Money: no currency prefix in rows ("4,480"), "KES 3,800" in headers and bars, thousands comma, no decimals. Dates: "Sat 10 Oct", "Thu 8 Oct · 10:30", "28 Sep"; month group "OCTOBER 2026". Times 24 h. People always with role: "Joseph (Store Manager)". Dates are Nairobi days (the API sends them so).

---

## 2. Routes and shell (build notes, not Paper)
Proposed under `/app/inventory/purchasing/` (middleware `route-access.ts` and `nav-table.test.ts` must agree): `` (Home), `restock`, `restock/review`, `my-orders`, `history`, `levels` (not `restock-levels`, which is the Store Manager page), `search`, `notifications`, `suppliers/[id]`, and the existing `[orderId]` (renders the phone order page for the Attendant, step 28D/H/J/K/L by state). `receiving/[orderId]` (steps 30, 31) stays. `nav-table.ts` today has one `purchasing` row (roles HUB_ALL, `anyCapability: ['orders.read','orders.request']`); **change** to the Prep pattern: `subItems` Home, Restock list, My orders, History, Restock levels, new badge kinds `purchasing-restock` and `purchasing-my-orders` (and the existing receiving badge). Hub roles other than the Attendant keep the desktop Purchasing; the sub-links show for whoever has `orders.request` without `orders.approve` (the same rule `PurchasingScreen` uses today to pick the Attendant screen).

---

## 3. Per screen

Each block: layout and values, states and wording, code today, API.

### 28A Purchasing home (`2U7W-0`)
| Block | Values |
|---|---|
| Header | 1.2 with bell; title "Purchasing"; subtitle "Saturday 10 Oct · Central Store" (`today`); padding-top 8, bottom 18; search field placeholder "Search items, suppliers or LPO numbers" (tapping opens 28E) |
| Body | padding 18 × 20, gap 20 |
| Restock card | white, border, radius 4, padding 16, gap 14. Row: big number Geist 44/44 600 tracking −0.02em ink ("8"); beside it "items need restocking" Geist 14/18 ink in a 96 px column, padding-bottom 3; right: two chips (padding 3 × 8, radius 0, tone bg/border, dot 6, Geist 11/14) "3 out" error, "5 low" warning. Button "Build the restock list" primary 46 high, 15/20. Note Geist 12/16 muted: "Amounts are filled in from your restock levels. Joseph (Store Manager) approves before anything is ordered." (name and role from `approver`) |
| NEEDS YOU NOW · n | section label; card with rows padding 12 × 14, gap 12, border-bottom between. Name Geist 14/18 600; status line (dot 6 + Geist 12/16): "Approved · ready to send" success, "Delivery expected today · LPO-0044" muted with dot #B5823E; button 84 × 34: primary "Send it" / secondary "Receive" |
| MY ORDERS · 4 OPEN | label left, "See all" right (Geist 12/16 primary, goes to 28F). Cards (padding 14, gap 12): name Geist 14/18 600, ref mono 11/14 muted "LPO-0047 · 3 items", total mono 14/18 ink right; unlabelled tracker; status line Geist 12/16 500: warning-fg "Waiting for Joseph (Store Manager) · since 9:05", error-fg "Sent · overdue by 1 day · call the supplier" |
| States | loading: 3 grey cards; empty restock: "Nothing needs restocking" (28Q); error: red card at the top, rest stays |
| Code today | **Delete**: `AttendantPurchasingScreen` (tabbed Restock / To receive / My orders, 387 lines) is replaced. **New** screen. The old screen's note field and supplier picker move into 28C |
| API | `GET /attendant/home` → `restock{total,out,low}`, `needsYou[]` (need RETURNED/SEND/RECEIVE), `myOrders{rows,total,needYou}`, `approver`, `badges`, `today` |

### 28B Build the restock list (`2UB3-0`)
| Block | Values |
|---|---|
| Header | ←; title "Restock list"; subtitle "Suggested = reorder level minus what is left."; search "Search an item or supplier"; padding-top 8 |
| Chips | All · 8, Out · 3 (error dot), Low · 5 (warning dot), "By supplier" (no count; switches the grouping, not a filter) |
| Group heads | "OUT OF STOCK · 3" mono 11/14 0.08em **error-fg**; "RUNNING LOW · 5" **warning-fg**; padding 12/14 20 top, 8 bottom |
| Row | padding 12 × 20, gap 12, bg **espresso-50** #F8F2EC when on the list, white otherwise; name 14/18 500; status line "0 left · reorder at 8 jerrican" (tone by Out/Low; unit is the buy unit); supplier line Geist 11/14 muted "Samrat · KES 2,400 each". Right: stepper (on the list) or "Add 6 tray" (not on the list; the number is `suggestedQty`) |
| Sticky bar | left: "3 items on your list" Geist 14/18 600, "3 suppliers · about KES 27,320" 12/16 muted; right: "Review list" primary 132 × 46 (disabled at 0 items) |
| States | loading: grey rows; empty: "Nothing needs restocking" / "Every item is above its reorder level." / "Restock levels"; no search match: "No match for \"…\"" |
| Code today | old Restock tab (checkbox, number field, supplier select per line) inside the deleted screen: **delete** that UI, keep `service.getNeedsRestocking` |
| API | `GET /needs-restocking` (suggested qty = level − on hand in whole buy units; `onHand` and `level` now present for the Attendant via `orders.see_stock`; prices via `catalog.see_costs`). The list itself (which items, how many) has **no server draft**: client store (Q-05) |

### 28C Review and send for approval (`2UEF-0`)
| Block | Values |
|---|---|
| Header | ←; "Review your list"; "3 items · each supplier gets its own order"; no search; gap 10 |
| Tracker | labelled form, Raised = current |
| Supplier cards (one per `groups[]`) | header strip padding 12 × 14: name Geist 14/18 600; "ORDER 1 · 1 ITEM" mono 11/14 muted; total mono 14/18 right ("19,200"). Lines padding 10 × 14: name 13/18, qty mono 12/16 muted ("8 jerrican") |
| Note | label "NOTE FOR JOSEPH, STORE MANAGER (OPTIONAL)" mono 11/14 0.08em; textarea white, border 1 border-strong, radius 2, padding 10 × 12, Geist 13/18 |
| Sticky bar | row "3 orders · estimated total" Geist 13/16 muted and "KES 27,320" mono 16/20 ink; "Send for approval" primary 48 |
| Undrawn states | see Q-06 (open order for that supplier, items without a supplier, partial failure, success) |
| Code today | `createOrder` per supplier in the old screen: **delete**; the service has no review or bulk send |
| API | `POST /restock-list/review` (`groups[].problem`, `unsupplied[]`, `orderCount`, `estimatedTotal`, `approver`); `POST /restock-list/send` (`sent[]`, `failed[]`) |

### 28D Approved: send it with the LPO (`2UH2-0`)
| Block | Values |
|---|---|
| Header | ←; supplier name; subtitle "LPO-0045 · KES 3,800" |
| Tracker | labelled, Sent = current |
| Banner | success: "Joseph (Store Manager) approved this at 10:12" / "Print the LPO or share it, hand it to whoever is going, then mark it as sent." |
| Print / Share | two secondary 44 high, flex 1, gap 10, icon 16 (printer, upload) + "Print LPO", "Share PDF" |
| WHO IS GETTING IT? | label left; right "Set by Joseph (Store Manager)" Geist 12/16 muted (only when `collectedBy.setBy` is set). Card: radio rows, padding 11 × 14, gap 12; radio 18 × 18, 2 px border-strong; selected: border primary, 8 × 8 primary dot, row bg espresso-50, label 14/18 **500**; unselected label 14/18 400. Rows: "Supplier delivers" + "no one from us" (12/16 muted); sub-label "OUR CARRIERS" mono 10/12 0.06em (padding 8 14 4); one row per carrier, name + "Vehicle" (kind); "A staff member" + "Search ›" (13/16 primary, border-top); "Someone else" + text field (height 36, border-strong, margin-left 30, padding-inline 10, placeholder "Write a name" Geist 13/16 faint) |
| Items | card "ON THIS ORDER · 1 ITEM", row "Chicken wings" / "2 tray · 3,800" |
| Sticky bar | "Mark as sent" primary 48 |
| Undrawn | staff picker sheet, nothing chosen yet, send failure: Q-04 |
| Code today | no phone page for an approved order; `send-whatsapp-dialog.tsx` is the desktop dialog; the Attendant can already call `service.sendOrder` but with no `collectedBy`. **New** screen; types for `collectedBy`, `can.withdraw/remind/setCollectedBy`, `supplier.phone` are **not** mirrored in `types/index.ts` yet |
| API | `GET /orders/:id`, `GET /orders/:id/lpo` (print/share), `GET /collectors` (`carriers[]`, `staff[]`), `PUT /orders/:id/collected-by`, `POST /orders/:id/send {via:'MANUAL', collectedBy}` |

### 28E Search finds anything (`2UJO-0`)
| Block | Values |
|---|---|
| Header | no title, no eyebrow: one row, padding 8 16 16, gap 12. Field: white, radius 2, **2 px border `--color-caramel-500` #D9A65E**, height 44, padding-inline 14, gap 10, icon 16 stroke #2E2B27, text Geist **15/20** ink, clear box 18 × 18 radius 2 bg neutral-200 "×" 12/14 neutral-700; "Cancel" Geist 14/18 caramel-300 |
| Chips | All · 5, Items · 2, Suppliers · 1, Orders · 2 |
| Section heads | ITEMS, SUPPLIERS, ORDERS (label padding 14/16 20 top, 8 bottom) |
| Item row | name 14/18 500; status line "0 left · on your list: 4 jerrican" (error), "48 in stock · fine for now" (success dot, muted text); right "Added" Geist 12/16 success-fg, or "+ Add" small button |
| Supplier row | name 14/18 500; "1 open order · 6 items you buy from them" 12/16 muted; "›" |
| Order row | "LPO-0044 · Samrat Supermarket Ltd" 14/18 500; "Sent · delivery expected today" / "Paid · 28 Sep" 12/16 muted; "›" |
| States | no match: "No match for \"sal\"" / "Check the spelling or search a supplier." / "Clear search"; loading: grey rows |
| Code today | none (the old screen filtered the list in place). **New** |
| API | `GET /attendant/search?q` (1 to 60 chars) → `counts`, `items[]` (status OUT/LOW/OK/NO_LEVEL, `suggestedQty`, `onOpenOrder`), `suppliers[]`, `orders[]` |

### 28F My orders (`2UMA-0`)
| Block | Values |
|---|---|
| Header | ←; title "My orders"; subtitle "4 open · 3 need you"; "History ›" right; search "Search supplier, item or LPO"; padding-top 21 |
| Chips | All · 4, Needs me · 3, Waiting · 1, Overdue · 1 (all `flex-shrink:0`) |
| Body | padding 14 × 20, gap 10; labels "NEEDS YOU · 3", "WAITING ON OTHERS · 1" (second has padding-top 4) |
| Needs-you card | padding 14, gap 10, radius 4. Head: name 14/18 600, ref mono 11/14 muted "LPO-0045 · 2 items · 16,050", pill right. Ready to send: pill success "Ready to send", unlabelled tracker (Approved current), buttons row gap 8: primary flex-1 38 "Print or share, then send" + "Open" 84 × 38. Due today: pill info "Due today", buttons "Receive delivery" (primary) + Open. Overdue: card border `error-border`, pill error "Overdue 1 day", buttons "Call supplier" (secondary, flex-1) + Open |
| Waiting card | padding 14, one row: name 14/18 600 + line "Waiting for Joseph (Store Manager) · since 9:05" Geist 12/16 warning-fg; total mono 14/18 right |
| States | empty: "No open orders" / "Orders you raise show up here." / "Build restock list"; no search match as 28E |
| Code today | "My orders" tab of the deleted screen: **delete**, **new** screen |
| API | `GET /attendant/my-orders?filter&q` → `counts`, `needsYou[]` (`need`: RETURNED / SEND / RECEIVE), `waitingOnOthers[]`, `approver` |

### 28G History (`2UOQ-0`)
| Block | Values |
|---|---|
| Header | ←; "History"; subtitle "46 orders · Last 30 days: 12" (`summary.allTime`, `summary.inRange`); search "Search supplier, item or LPO"; padding-top 21 |
| Filters | 1.4: "Date: Last 30 days ▾", "Status: All ▾" (All, Paid, Cancelled) |
| Month group | label "OCTOBER 2026" (padding 14/16 20 top, 8 bottom) |
| Row | list row 1.6. Left: supplier 14/18 500, ref mono 11/14 muted "LPO-0044 · 4 items · 1 short" (`shortCount`). Right column (right-aligned, gap 3): value mono 14/18 (ink; muted for cancelled), status Geist 11/14: "Paid · 10 Oct" success-fg, "Cancelled · 03 Oct" error-fg. "›" Geist (system-ui) 16/20 faint |
| Value | `value` with `valueKind`: DELIVERED (paid) or ORDERED (cancelled). **Never** an invoice, payment or balance figure |
| Pager | 1.9, 20 per page, "Showing 1 to 20 of 46" is `total` after filters |
| States | empty: "No orders in this range" / "Try a longer date range." / "Change date" |
| Code today | none. **New** |
| API | `GET /attendant/history?from&to&status&q&page&pageSize` → `range`, `summary`, `months[].rows[]` |

### 28G2 History, date range sheet (`2UT0-0`)
| Block | Values |
|---|---|
| Overlay | #171512 at 45 % over the whole phone |
| Sheet | bottom-anchored, white, border-top 1 #D2CFC9, shadow `#28190A2E 0 −12px 32px`, padding 16 20 28, gap 14 |
| QUICK PICKS | label mono 10/12 0.06em #635E57; chips wrap, gap 6, height 32, padding-inline 12, border #D2CFC9, Geist 13/16 ink: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month. Selected: bg #FCF2E4, weight 600 |
| FROM / TO | two fields flex 1 with "→" (Geist 14/18 #635E57, padding-top 19) between; label mono 10/12 0.06em; field height 32, padding-inline 10, mono 13/16, "Wed 9 Sep 2026". The field being set has border 1 **#171512**, the other #D2CFC9 |
| Calendar | one month. Month row height 28: "‹ October 2026" Geist 13/16 600 ink, "›" 13/16 600 #8D8982 (disabled on the latest month). Weekday row Mo Tu We Th Fr Sa Su, each 50 wide, mono 10/12 #635E57. Day cells 50 × 34, mono 12/16: in range bg #FCF2E4 text ink; end points bg #171512 text white; later dates text #8D8982, not pickable |
| Footer | border-top 1 #E4E2DE, padding-top 12, space-between. Left (170 wide) Geist 12/16 #635E57 "30 days · later dates can't be picked." Right: Cancel (border #D2CFC9, height 32, padding-inline 14, 13/16 ink) and Apply (bg #B0610F, white 13/16 500, same size) |
| Code today | `components/ui2/date-range-picker.tsx` is the one control (panel + quick picks + From/To + calendar; below 1024 px one month with quick picks stacked). **Change**: render it as this bottom sheet on a phone (the sheet chrome, scrim and footer above); do not write a second picker |
| API | none; `from`/`to` go on `GET /attendant/history`; `to` max today (`DATE_RANGE_INVALID` 422) |

### 28H Returned: fix and resend (`2UR6-0`)
| Block | Values |
|---|---|
| Header | ←; supplier name; subtitle "LPO-0048 · returned, not yet approved"; padding-top 21, gap 10 |
| Tracker | unlabelled, white strip padding 12 × 20, Raised = current ring |
| Banner | warning: "Joseph (Store Manager) sent this back · 10:40" (13/16 600) and the note in quotes (13/18 ink) |
| Items | card "ITEMS · 3". Plain lines "Potatoes" / "6 sack". The flagged line: bg espresso-50, name 13/16 **500**, line "Joseph (Store Manager) asked for a change" Geist 11/14 warning-fg, stepper 112 × 36 border primary (glyphs Geist system-ui 18/22) |
| Reply | label "REPLY TO JOSEPH, STORE MANAGER (OPTIONAL)"; textarea white, border-strong, **radius 0**, padding 10 × 12, 13/18 |
| Sticky bar | "Send for approval again" primary 48 (15/18); "Withdraw this order" text action |
| Gap | per-line flag has no data (Q-10) |
| Code today | old step 32 "returned with a note" lived in the deleted screen and the file screen: **delete / replace** |
| API | `GET /orders/:id`; `PATCH /orders/:id` (lines, `attendantNote`) then `POST /orders/:id/submit` (two calls; the reply replaces the first note); `POST /orders/:id/withdraw` (no PIN, no reason) |

### 28I Menu (`2UYX-0`)
Drawer, 1.10. **Change**: add the sub-links in `nav-table.ts` (section 2) with the three badges; `GET /attendant/badges` feeds `receiving`, `restock`, `myOrders`, `unreadNotices`. Today the Purchasing row has no sub-items for the Attendant.

### 28J Order, sent and overdue (`2V0B-0`)
| Block | Values |
|---|---|
| Header | ←; supplier; "LPO-0043 · KES 12,250"; padding-top 21, gap 10 |
| Tracker | labelled, Delivered = current |
| Banner | error: "Overdue by 1 day" / "Expected Fri 9 Oct. Call Kagumo to find out where it is." |
| Actions | row gap 10: "Call supplier" secondary 44 flex-1; "WhatsApp" green 44 flex-1 |
| GETTING IT | card, label strip; row: collected-by label Geist 13/16 ink left, "Sent Thu 8 Oct · 10:30" Geist 12/16 muted right |
| ON THIS ORDER · 1 ITEM | item row "Chicken breast" / "5 tray · 12,250" |
| ACTIVITY | label; lines Geist 12/16 muted, newest first: "Thu 8 Oct 10:30 · Sent with Wendo van KCB 214K", "Thu 8 Oct 09:58 · Joseph (Store Manager) approved" |
| Sticky bar | "Receive delivery" primary 48 (15/18) → `receiving/[orderId]` |
| Code today | no phone order page; `purchase-file-screen.tsx` is the desktop file. **New** screen |
| API | `GET /orders/:id` (`collectedBy`, `supplier.phone`); not-overdue sent orders are undrawn (Q-11) |

### 28K Order, awaiting approval (`2V2H-0`)
| Block | Values |
|---|---|
| Header | ←; supplier; "LPO-0047 · KES 4,480" |
| Tracker | labelled, Approved = current |
| Banner | warning: "Waiting for Joseph (Store Manager) to approve" / "Sent for approval at 9:05. We will tell you as soon as he decides." (pronoun, Q-12) |
| Items | "ON THIS ORDER · 3 ITEMS", rows "6 sack · 2,400" |
| Note | label "NOTE FOR JOSEPH, STORE MANAGER"; text Geist 13/18 ink (read only, no box) |
| ACTIVITY | "09:05 · You sent it for approval" |
| Sticky bar | "Remind Joseph (Store Manager)" secondary 48 (15/18 500); "Withdraw this order" text action |
| Code today | none for the phone. **New** |
| API | `GET /orders/:id` (`can.remind`, `can.withdraw`); `POST /orders/:id/remind` (raiser only, once per 4 h; `REMINDER_TOO_SOON` 409 `details.lastRemindedAt`); `POST /orders/:id/withdraw` |

### 28L Order, closed (`2V4I-0`)
| Block | Values |
|---|---|
| Header | ←; supplier; "LPO-0044 · raised 29 Sep · closed 10 Oct" |
| Tracker | labelled, all six done (Paid last column 32 px, check circle) |
| Banner | success: "Closed · paid in full" / "You received this on Wed 30 Sep. One item was short." (no figure) |
| Value strip | white, border 1 (radius 0), two equal cells, divider 1 `border`: label mono 10/12 0.06em muted "ORDERED" / "DELIVERED"; value mono 18/22 ink; cell padding 12 × 14, gap 4 |
| Items | "ITEMS · 4"; qty mono 12/16 "82 of 82 kg"; a short line is error-fg "1 of 2 box" |
| YOUR DOCUMENTS | rows "Local purchase order" + "Print" (13/16 primary), "Delivery note DN-77120" + "View" |
| No sticky bar | |
| Code today | none for the phone. **New**; the desktop closed file shows Documents and the audit log, which the Attendant must not get |
| API | `GET /orders/:id`: delivered value only; invoice, payments and money are null; documents are LPO and delivery note (`GET /uploads/:id/url` for View) |

### 28M Supplier (`2V72-0`)
| Block | Values |
|---|---|
| Header | ←; supplier; "Dry goods · 6 items you buy from them" (category, item count); padding-top 21. Below: two buttons gap 10, height 40: "Call" (white, no border, 13/16 500 ink) and "WhatsApp" (green) |
| OPEN ORDER · 1 | card padding 12 × 14: "LPO-0044 · 30,136" mono 12/16 ink, line "Delivery expected today" Geist 12/16 info-fg; "Receive" secondary 84 × 34 |
| Items | field height 40 white border-strong, padding-inline 12, icon 16, placeholder "Search their items" 13/16 faint; label "ITEMS WE BUY FROM THEM · 6" (padding-top 4); card rows padding 10 × 14: name 13/16, line Geist 11/14 ("Low · 12 left" warning, "Out of stock" error, "In stock · 9" success), price mono 12/16 muted "KES 168" |
| Link | "See all orders with Samrat ›" Geist 13/16 primary |
| Sticky bar | "Add 3 low items to my list" primary 48 (`lowCount` = Low plus Out; hidden at 0) |
| Code today | the supplier page (`suppliers/components/supplier-page-screen.tsx`) is the desktop Manager page and needs `suppliers.read`: **new** phone page |
| API | `GET /attendant/suppliers/:id` → `supplier{phone,whatsapp,category,...}`, `openOrder`, `items[]`, `lowCount` |

### 28N Notifications (`2VF6-0`)
| Block | Values |
|---|---|
| Header | ←; "Notifications"; "3 unread · 4 you can act on" (`counts.unread`, `counts.needsMe`); "Mark all read" right; padding-top 21 |
| Chips | All · 5, Unread · 3, Needs me · 4 |
| Group head | "TODAY" mono 11/14 0.08em muted left, count mono 11/14 faint right; padding 14/16 20 top, 8 bottom |
| Row | white, gap 12, padding-block 12; **unread**: border-left 3 px #B0610F, padding-left 17, padding-right 20, title weight 600; **read**: padding-inline 20, title weight 400. Border-bottom 1 `border` (border-top on the first) |
| Icon tile | 36 × 36, 1 px border, svg 18 stroke 2: Returned warning bg/border + undo arrow #8A5A16; Approved success + check #2F6438; Due today info + clock #2C5670; Overdue error + triangle #97281D; Closed neutral-100 bg, border `border`, circle-check #635E57 |
| Text | title Geist 14/18 (+ time Geist 12/16 muted right, `flex-shrink:0`); body Geist 13/18 muted; ref line mono 11/14 faint "LPO-0048 · Nyeri Market Traders" |
| Action | 32 high, 128 wide, margin-top 3: Returned "Edit and resend" primary; Approved "Print or share", Due "Receive delivery", Overdue "Call supplier" secondary; Closed none |
| Wording | from the API `title` / `body` (map `purchasing-attendant-api.md` section 4, rows 22 to 26) |
| States | empty: "You are all caught up" / "New approvals and deliveries appear here." / no button |
| Code today | none; `shell-states` and the shell have no inbox for Purchasing. **New** |
| API | `GET /attendant/notifications?filter` (groups by day), `POST /attendant/notifications/read {keys[]}`, `POST .../read-all`; counts ignore the chip |

### 28P Restock levels (`2VAG-0`)
| Block | Values |
|---|---|
| Header | ←; "Restock levels"; "What we hold against when to reorder. Levels are set by Joseph (Store Manager)." (wraps two lines); search "Search an item or supplier"; padding-top 21 |
| Filters | "Status: All ▾" (All, Out, Low, Fine), "Supplier: All ▾" |
| List | white, border-top 1. Column head: padding 12 20 6, border-bottom 1 border-strong, mono 10/12 0.06em muted "ITEM" left, "ON HAND / REORDER AT" right |
| Row | padding 11 × 20, gap 7, border-bottom 1 `border`. Top line (baseline): name Geist 14/18 500; "0 / 8 jerrican" mono 12/16 in the tone colour. Bar: track height 4, bg neutral-100 #EEEDEA, fill height 4 in tone (error / warning / success); fill = `fill` (0..1) of the track width, capped at full |
| Pager | 1.9 (gap 4, 12 px); "Showing 1 to 6 of 42" |
| States | empty list: no copy in 28Q (Q-13) |
| Code today | `app/app/inventory/restock-levels/page.tsx` is the Store Manager page. **New** phone route for the Attendant |
| API | `GET /attendant/restock-levels?status&supplierId&q&page&pageSize` → `counts`, `suppliers[]`, `rows[]` (`onHand`, `level`, `usageUnit`, `fill`, `status`), `setBy`; only items with a level above zero. Sort order is not stated (Q-14) |

### 28Q States kit (`2VCM-0`)
Reference artboard, 820 wide (not a screen). Values:
| State | Values |
|---|---|
| Loading | "grey rows, no spinner": per row a 12-high bar (widths 150 / 120 / 170) over a 10-high bar (210 / 180 / 140), bg neutral-100, gap 6, rows gap 12 with border-bottom 1 `border` and padding-bottom 12 |
| Empty | title Geist 15/18 600 ink; line Geist 13/18 muted; one secondary button height 36, ~130 wide, border-strong, Geist 13/16 500; container padding-block 12, gap 6, button margin-top 6 |
| Error | red card (error bg/border, padding 12 × 14, gap 6): "Couldn't load this" Geist 14/18 600 error-fg; "Check your connection and try again." Geist 13/18 ink; "Try again" Geist 13/16 500 error-fg. Keep what was on screen |

Copy per screen (exact):
| Screen | Empty title | Empty line | Button |
|---|---|---|---|
| Home · restock | Nothing needs restocking | Every item is above its reorder level. | Restock levels |
| My orders | No open orders | Orders you raise show up here. | Build restock list |
| History | No orders in this range | Try a longer date range. | Change date |
| Search | No match for "sal" | Check the spelling or search a supplier. | Clear search |
| Notifications | You are all caught up | New approvals and deliveries appear here. | (none) |
| Supplier | No orders with this supplier | Add their items to your list to start. | Build restock list |

Code today: `MobileEmptyState`, `MobileLoadingState`, `MobileErrorState` (`components/app/shell/mobile-states.tsx`), `B2Empty`, `ListSkeleton`, `StockEmptyCard`/`StockErrorCard`. **Reuse** one of them and check it against these values; do not add a fourth.

### Steps 30 and 31 (Receive, unchanged)
`receive-screen.tsx` stays. Only the shared tracker change (1.1) reaches it. Reached from "Receive" / "Receive delivery" on 28A, 28F, 28J, 28M, 28N.

---

## 4. Code today, one summary
| Piece | Verdict |
|---|---|
| `attendant-purchasing-screen.tsx` (tabbed Restock / To receive / My orders) | delete, replaced by 28A to 28F |
| `compact-tracker.tsx` | change (1.1) |
| `receive-screen.tsx` | keep |
| `purchase-file-screen.tsx`, `needs-restocking-tab.tsx`, `orders-tab.tsx`, `send-whatsapp-dialog.tsx` | desktop, keep as is |
| `purchasing-service.ts` / `purchasing-api-service.ts` / `types` | add the 16 new calls and the new fields (`collectedBy`, `can.*`, `supplier.phone`); the contract test file grows to match |
| `nav-table.ts` | change (section 2) |
| `date-range-picker.tsx`, `PagerBar`, `B2Header`, buttons, states | reuse, small changes noted above |
| Everything else in 28A to 28Q | new |

---

## 5. Questions where Paper is silent (recommended default in bold)
| # | Question | Default |
|---|---|---|
| Q-01 | Header padding-top is 8 on 28A to 28E and 21 on 28F to 28N, 28P | **21 everywhere** (the majority, and close to `ScwPhoneHeader`'s 20 + 4); ask for Paper to be tidied |
| Q-02 | The drawer rail in 28I is a straight 1 px line with a square marker; the approved sidebar standard is the curved connector rail | **Use the shell's existing sub-link component** (Prep) so the phone and desktop match |
| Q-03 | Bell shown only on Home | **Home only**, as drawn. Paper has no Notifications row in the drawer, so the bell on Home is the only door; the owner may want it on the other landing screens too |
| Q-04 | 28D: nothing chosen yet; the staff picker; send failure | **"Mark as sent" disabled until a choice (or until `collectedBy` already set); staff picker = bottom sheet with a search field, rows name + role (`GET /collectors` staff); failure = red card above the bar, screen kept** |
| Q-05 | Where the restock list lives between 28B, 28E, 28M | **Client store (Zustand, selected actions), persisted per user in localStorage, emptied after a successful send**; no server draft exists |
| Q-06 | 28C undrawn: supplier already has an open order, items without a supplier, partial failure, success | **Group shows a warning note "Kagumo already has LPO-0043 open. Open it" with a link and is not sent; unsupplied items shown in a warning card "2 items have no supplier. Ask Joseph (Store Manager) to set one in Catalog" and left out; a failed supplier shows the server message on its card while the others show "Sent"; success goes to My orders with a toast "3 orders sent to Joseph (Store Manager)"** |
| Q-07 | Rows per page (UI_BUILD_RULES §4a) is not drawn on 28G / 28P | **Paper wins: fixed 20 per page, no control** |
| Q-08 | Pager differs: 28G gap 6 / 13 px, 28P gap 4 / 12 px 600 | **One pager at 28G values** and tell the owner |
| Q-09 | 28H tracker has no labels while others do | **Build as drawn** (unlabelled strip) |
| Q-10 | 28H per-line "asked for a change" flag has no data | **All lines editable with the stepper; the banner carries the note; no per-line text** until `flaggedLineIds` exists |
| Q-11 | 28J undrawn: sent and not late; sent with nobody recorded as collecting | **Info banner "Delivery expected Tue 13 Oct" / "Delivery expected today"; hide the GETTING IT card when `collectedBy` is null** |
| Q-12 | 28K copy says "as soon as he decides" (infers a pronoun from a name) | **"We will tell you as soon as it is decided."** |
| Q-13 | Empty states for Restock levels, Restock list, order pages, Restock-level search | **Reuse the Home copy for Restock list; Restock levels: "No restock levels set" / "Levels are set in Catalog by Joseph (Store Manager)." / no button** |
| Q-14 | Restock levels row order | **Out first, then Low, then Fine, by name inside each** (ask the back end to sort so; the doc is silent) |
| Q-15 | Home and My orders rows for Returned and for late-and-approved orders are not drawn | **Returned: warning pill "Sent back", primary "Edit and resend"; late sent order: "Call supplier" as on 28F** |
| Q-16 | 28G2 calendar treats 8 Oct as the last pickable day while the screens say 10 Oct; 28G sample total differs from 28G2 (27,486 vs 27,986) | **Use the real Nairobi today; sample figures are just sample data** |
| Q-17 | Times: Paper mixes "9:05" (sentences) and "09:05" (activity, lists) | **"H:mm" in sentences, "HH:mm" in lists and activity** |
| Q-18 | After "Add 3 low items to my list" on 28M | **Add the items (not those already on an open order), toast "3 items added to your list", stay on the page, bar changes to "Review list (n)"** |
| Q-19 | "See all orders with Samrat ›" destination | **History with the search set to the supplier name** |
| Q-20 | Remind button after a successful remind | **Disabled, label "Reminded at 11:20"**; `REMINDER_TOO_SOON` shows the same label from `lastRemindedAt` |
| Q-21 | "Withdraw this order" confirmation | **Confirm dialog "Withdraw LPO-0048? It will be cancelled." with Withdraw / Keep**; no PIN, no reason (API doc) |
