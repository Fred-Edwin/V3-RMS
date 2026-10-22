# People live walk: the owner's feedback

Working file. Delete it when Workforce ships. Written during the live walk (22 Oct 2026), one role at a time, in the owner's own words. The last column is left blank for the fix session.

| # | Role | Where (screen) | What the owner said | Your note (what you saw, or "not seen by me") | Fix or defer (leave blank) |
|---|---|---|---|---|---|
| 1 | HR Manager | My file (`/app/workforce/my-file`) | "We need a desktop version of this screen because it looks weird." (screenshot: a narrow phone-style column in the middle of a wide desktop page, empty space on both sides) | Seen: the page is one 600 px column with a dark header card, a big "Your file is complete" box, then Your job and IDs and bank. Probably the same for My leave, My payslips and My notices (not checked). Needs a desktop design in Paper first. | |
| 2 | Director | Sidebar menu, Workforce group (Staff, Time, Pay, Setup sub-headers) | "I have an issue with the menu. It should look like the image, but now it's... you see how in the image the title, that vertical spine, looks like it's emanating from the header text. ... In the current version, only under Workforce that spine is okay. But when I look at Staff, it should look the same as Workforce; it should be positioned just the way Workforce has been positioned. I'm not worried about hierarchy, but you could consider hierarchy and ensure the vertical spine emanates from the sub-headers the same way it emanates from the main header, which is Workforce." (images: the reference Operations and Manage sidebar with one continuous line and elbow connectors; the current Workforce menu) | Seen: under the Workforce header the spine starts at the header and runs down; under Staff, Time, Pay and Setup the line is in separate short pieces that do not start at the sub-header text. Same menu for HR (seen in the HR walk). | |
| 3 | Director | My phones (`/app/workforce/my-phones`), and "all such screens" | "All such screens need a desktop version." (screenshot: My phones is a narrow single column in the middle of a wide page) | Seen: same narrow column as My file (row 1). Also the Director's My file. Likely all the "My ..." screens (My leave, My payslips, My notices, Activity on my record, Profile): not all checked by me. | |
| 4 | Department head (said at the end of this role; applies to every role) | Sidebar bottom section (the person's menu: Profile and Sign out) | "I see you have removed the other links from the bottom section, but now it only contains the profile and sign-out links. I only wanted the bottom section to be for signing out, nothing else. So include the profile link among the other old links where they belong." | Seen: the bottom menu (name and role at the bottom left) opens a small menu with two items, Profile and Sign out, for every role. The Profile page itself also appears in the "My account" group (HR, Director) as "Profile". | |
| 5 | System Admin (applies to all roles) | Sidebar menu groups, open or closed by default | "And another thing on the sidebar menu: how should we do this? Should the links be default? Should the dropdown be default, or should it default to being closed? What do you think?" | Seen: the group of the current page opens by itself, others stay closed; on blocked pages and on My file the Workforce group collapses; the department head's Department group changes between pages. Recommended (not yet agreed): open only the current page's group, never collapse it, remember a hand choice per device, keep sub-link order fixed. | |
| 6 | System Admin | Audit log, "Who looked at this log" box | "I saw a section in the audit log that said something like 'who saw this audit log?' What's that about? I think we need to remove it." | Seen: a box on the right listing who opened the log (it showed Mercy Akinyi, 18:23, who had not opened it) with the payslip note. The same opens are already rows in the log ("Audit log opened"). | |

## Things the walker saw while walking (not the owner's words; the owner may keep or drop them)

| # | Role | Where | What I saw |
|---|---|---|---|
| W1 | HR Manager | Home and Employees | Home says 49 active staff; Employees says 48 active (50 people on file). |
| W2 | HR Manager | Home and Organisation | Home says "No head 5"; Organisation says 2 without a head, and Nyeri Town shows "Complete" although Housekeeping has only an acting head. The two Central Store departments count as "no head" on Home. |
| W3 | HR Manager | Hire, step 1 | After changing a duplicate phone number the red "different person" warning stayed on the first Continue; it went on the second. |
| W4 | HR Manager | Undo exit | Says "login works again" for a person with no login; does not say until when the undo works. |
| W5 | HR Manager | Employee file | The life timeline shows dates with no year (for example "17 Dec" for a 2025 date). |
| W6 | HR Manager | Home | "The oldest is 0 days old" and "Waiting 0 days" read oddly on a same-day item. |
| W7 | HR Manager | Not available page | Tells HR "Ask your manager or HR" when the person is HR. |
| W8 | HR Manager | Hire steps 3 to 5 | Not walked (Pay, Statutory and bank, Login). |
| W9 | Director | Home and Needs you | Home says "9 in 4 kinds", the Needs you page says "9 things in 3 kinds". |
| W10 | Director | Needs you | Pay-change rows show the date as "2026-11-01"; other rows use "Fri 16 Oct". |
| W11 | Director | Notifications | "A pay change waits for your decision" and "A person's exit was recorded" carry no names. |
| W12 | Director | Needs you | Probation and "no head" rows say "Waiting for HR" but the Director has the same Decide and Assign head buttons. |
| W13 | Director | Pay review | Worked: Victor Mutua KES 44,000 to 48,000 approved with the PIN, Grace Wanjiku KES 29,000 declined with a reason (the reason is required). Both are correct in the database. |
| W14 | Director | `/app/workforce/my-team` | Plain black "404 This page could not be found" screen, not the app's look (the menu marks My team "not built"). |
| W16 | Accountant | Home, notices | The owner had no corrections for the Accountant. "Bank details changed" shows in Latest but only says "A person's bank details were changed" (no name). |
| W17 | Accountant | Home card "Pay changes this month 3" | Links to `employees?filter=pay_change`; the list ignores it and shows all 50 people (there is no such chip). The HR and Director Home cards use the same link. |
| W18 | Accountant | Employees, Blocks payroll | Two Branch Managers appear only because of "Job details missing". |
| W19 | Accountant | Menu | Only Overview, Employees, Payroll and Rules (Payslips is marked "not built"). The blocked-page screen collapses the Workforce menu group. |
| W20 | Accountant | My file | Not walked (expected the same narrow screen as rows 1 and 3). |
| W21 | Branch Manager (Nyeri Town) | General | The owner had no corrections for the Branch Manager. Worked: own site only (26 people), pay columns never shown, IDs/bank/pay locked on Dorcas's file, hire has 2 steps, probation report dialog, blocked Payroll page with "Open My payslips". |
| W22 | Branch Manager | Dorcas Naliaka (hired today) | No sign on the front of the file of the 24-hour correction; the Job tab has an Edit link but no text says it lasts 24 hours or that after it "Ask HR to change this" shows. |
| W23 | Branch Manager | Home and Organisation | Home says "No head 1"; Organisation says "Without a head 0" (Housekeeping has an acting head only). |
| W24 | Branch Manager | Employees | Own row says "Job details missing" and "No head yet". |
| W25 | Branch Manager | Probation report dialog | Says "Only HR and your Branch Manager can read this" although the writer is the Branch Manager. |
| W26 | Branch Manager | Menu and Home | No "Today board" in the menu although Home has "Your team today" with an Open button. |
| W27 | Branch Manager | Not walked | Grace Wanjiku's file (Dorcas's checked instead), own My file, sending a hire. |
| W28 | Store Manager | General | The owner had no corrections for the Store Manager. Worked: Central Store only, pay and IDs locked, 2-step hire with the site fixed, Organisation for the hub reads "No heads here / The unit manager", blocked Payroll page. |
| W29 | Store Manager | Home and Organisation | Home says "No head 2 departments without a head" (amber); Organisation says "Without a head 0, no heads here". |
| W30 | Store Manager | Home | "Nothing needs you" but a "Build shifts" button, and Leave waiting and Timesheets waiting cards, although the menu has no Leave, Timesheets or Shifts. |
| W31 | Store Manager | Employees and Organisation | Employees shows 3 of the 6 Central Store people (Head Office staff hidden); Organisation says 6 people and 3 in each department. |
| W32 | Store Manager | Hassan Abdi's file | The Overview left side is empty (half-empty page). |
| W33 | Store Manager | Not walked | Own My file, sending a hire, the Job tab edit. |
| W34 | Department head (Kelvin Mwai) | Home, My team | The "My team" card links to `/app/workforce/my-team`, which shows "Not available for your role, this page is for the person it belongs to". The page that works is `/app/workforce/team` (7 people, no pay or IDs, no way to open a person). |
| W35 | Department head | Employees blocked screen | Says to use My team, whose link (`/my-team`) is the same dead end; "Open My team" button goes to the not-available screen. |
| W36 | Department head | Probation | Could not reach "write the head's report" for Jackline Wavinya (no way into a person from My team). Home says "In probation 1, 0 reports due" although Jackline is on day 46 (earlier, with older data, it said "2 reports due"). |
| W37 | Department head | Menu | Two groups: "Kitchen 6 waiting" (not opened) and "Department". The Department group shows Overview, Shifts, Team today, Casual pay on Home but only Overview and Casual pay on the My team page; no "My team" link. |
| W38 | Department head | Home | "Kitchen team today 0/0 people" while My team shows 7 people, none on shift; three identical "A new person joined your department" notices with no names. |
| W39 | Department head | Not walked | The "Kitchen" menu group, own My file, Shifts, Team today. |
| W40 | Staff member (Grace Wanjiku, phone) | General | The owner had no corrections for the department head beyond row 4, and none for the staff member. Worked on a phone (390 px, phone emulation): sign-in, first-time Set your PIN, Home, menu drawer, My file, Emergency contact form, blocked Employees screen. |
| W41 | Staff member | Sign-in on a phone | "This is your first sign-in on this computer" and "Chrome on Linux" (no phone wording). The Set your PIN screen differs between phone (keypad, one row at a time) and desktop (both rows). |
| W42 | Staff member | Bottom bar and drawer | My file and My payslips show New order, Orders, Inbox, Menu tabs; Home shows none. The menu drawer shows a "Ctrl K" keyboard hint. |
| W43 | Staff member | Home | "Leave days left" shows a dash (no balance); the notice "HR asks for a detail" opens `/my-time`, not My file. |
| W44 | Staff member | My file | Shows the initials circle and "Photo, Add" although the seed hire gave a photo (may be seed data, not the product). |
| W45 | Staff member | Not walked | Hidden-amounts payslip (Grace has none; use Susan Wafula), My leave, My notices, Profile. The plain page resize jumped back to desktop and could not go narrower than 500 px, so phone emulation was used. |
| W46 | System Admin | Home | "Needs you 7" lists Ann Wangui's and Kennedy Mugo's probation (Decide) and "5 departments without a head" (Assign heads), which lead to the "Not available" screen for this role. |
| W47 | System Admin | Blocked Employees screen | Lists the System Admin among the roles the page is for. |
| W48 | System Admin | My file | The admin has no file: a red "Your file did not load. Try again" box that can never succeed. No My account group in the admin menu. |
| W49 | System Admin | Menu | One group, Company, with eight links including Payroll (the admin gets no Pay screens) and Users and Branches pointing to the same page. |
| W50 | System Admin | Worked | Home cards, Security alerts (empty state and Start alerts button), Audit log (121 entries, filters, numbered pager), People blocked as decided. Not walked: Users, Branches, Act as, Attendance clock. |
| W15 | Director | Blocked page | I could not find a page the Director is blocked from, so the "Not available" screen was not shown for this role. |
