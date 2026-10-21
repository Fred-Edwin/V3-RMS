# Workforce final pass, section 1: design notes, round 1

Paper file "Wendo RMS · Approved designs", page "Workforce · Final pass designs". Owner approved all groups on 21 Oct 2026. Fonts: Geist and Geist Mono only. Fictional names in sample data.

## Group 1: Home for every role (frames 1.1 to 1.13)
- Frames: 1.1 HR, 1.2 Director, 1.3 Accountant, 1.4 Branch Manager, 1.5 Store Manager, 1.6 Department head, 1.7 Staff, 1.8 System Admin (all 1440); 1.9 Branch Manager, 1.10 Department head, 1.11 Staff (phone 390); 1.12 Needs you "See all" list; 1.13 states kit.
- One kit: greeting, 5 KPI cards (red only for a real problem: overdue, late, security, blocks payroll), "Needs you" table (Kind, Request, Where you decide, Since), "Latest" list, bell with unread count in the top bar. No Inbox.
- "Needs you": top 5 by urgency, grouped with counts ("Pay changes · 2"), overdue first, then "Showing the top 5 of N" and "See all N". "See all" (1.12): search, kind chips with counts, Kind and Site dropdowns, pager with rows per page.
- Headline copy: "Good morning, <name>"; "N things need you, and 1 is overdue."; "Mark all read"; "See all notifications".
- Breadcrumb: feature Overviews read "Workforce / Overview" (head: "Department / Overview"); staff and System Admin read "Home".
- Phone (390): top bar with menu and bell, greeting, 2x2 KPI cards, stacked action cards with full-width 44 px buttons, short Latest. **Owner approved these as the design standard for all future phone screens.**
- States (1.13, once for all roles): loading (grey blocks), nothing waiting ("Nothing needs you"), busy ("The system is busy"), error ("We could not load this", with reference and Try again).
- Left out: product preview, AI, any Inbox.

## Group 2: the menu (frames 2.1 to 2.7, 2.3b)
- Three levels: top **Home**; one row per feature (Workforce, Inventory, Operations) that opens with **Overview**; **Company** row. Only the active row is open; closed rows show the sum of their badges.
- Workforce labels: **Staff** (Employees, Organisation, Conduct), **Time** (Shifts, Timesheets, Leave, Casual pay), **Pay** (Payroll, Payslips), **Setup** (Rules). Curved connector rail; sub-links text only.
- Search (Ctrl K) replaces "jump box"; matching letters bold; people shown only to roles that may see them.
- Personal items (My file, My payslips, My leave, Profile, Sign out) open from the name at the bottom.
- Floor staff: Home, department row named for the department (Kitchen keeps today's pages: Kitchen, Performance, History, Deliveries, Requisitions), and heads also get **Department** (Overview, My team, Shifts, Timesheets). Phone drawer 310 px, 44 to 48 px rows.
- System Admin: Home and Company only (Security alerts, Audit log, Users, Branches, Menu items). No People, Time or Pay; the admin acts as a user instead.
- Left out: Inbox, old HR group, Leave Calendar, Contract Types as links.

## Group 3 and sign-in family (frames 3.1 to 3.2, 4.1 to 4.5, 5.1)
- Left panel 560 px (desktop): gradient 3 (amber to red-brown, eased stops) with a second red-brown light bottom-right, grain 35%, centred badge 112 px, "Wendo Coffee / Bistro" (Geist 40, semibold cream over light caramel), headline "Run every branch from one place.", three proof points, footer "Built and supported by Fred" and WhatsApp +254 113 176 613. Phone hero: 240 to 300 px, same gradient and grain, centred; PIN screen uses a 200 px centred hero (64 px badge, 26 px name).
- Right side stays white. Cards 480 px (3.1, 4.3), caramel rule above headings, caramel hairline at the column join, support strip 64 px: "Need help? Call or WhatsApp Fred on +254 113 176 613 · Every day, 6 a.m. to 10 p.m." On every sign-in screen.
- Device step copy: "Confirm this device", "This is your first sign-in on this computer/phone.", "Trust this device", "Use just this once", "We will ask again next time". Device shown as "Chrome on Linux" or "Android phone" plus place and time chips.
- Steps marker (Password, This device, PIN) is kept large: 20 px icons desktop, 18 px phone.
- PIN: four digits, choose then enter again, not 1234 or one repeated digit. States (4.5): wrong password, locked, offline, session ended.
- Login placeholder: `firstname.secondname@wendo.co.ke`; "Forgot your password? Ask your manager or HR for a new one."

## Naming table
| Old link or name | New name | Module |
|---|---|---|
| Dashboard, HR Overview | Home / Overview | Home, Workforce |
| Employees, Organisation, Conduct | same | Workforce / Staff |
| Schedule, Department Shifts, Rota | Shifts | Workforce / Time |
| Timesheets, Leave Requests, Leave | Timesheets, Leave | Workforce / Time |
| Casuals, Casual pool | Casual pay | Workforce / Time |
| Payroll, Payslips (legacy) | Payroll, Payslips | Workforce / Pay |
| Rules, Contract Types | Rules | Workforce / Setup |
| Day, Past days | Branch day | Operations |
| Waste, Incidents, Discounts, Other income | same | Operations |
| Stock | Stock and counts | Inventory |
| Requisitions, Prep, Catalog, Suppliers, Purchasing, Receiving, Carriers | same | Inventory |
| Sales dashboard | Analytics | Company |
| Audit log, Security alerts | same | Company |
| Branch settings, Leadership Accounts, Menu (food) | Branches, Users, Menu items | Company |
| Team (head) | My team | Department |
| My file, My payslips, My leave, Profile | same | Account menu |
| Inbox, Leave Calendar | removed | none |
| "Jump box" | Search | menu |

## Not designed (second round)
Edit button and person label, My file on the phone, the department head's probation card, the refusal screen, Act as (sketch promised after this round), Kitchen/Bar/Service work pages.
