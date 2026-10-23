# Workforce final pass, section 1: design notes, round 3 (the desktop "My ..." screens)

Paper file "Wendo RMS · Approved designs", page "Workforce · Final pass designs", frames 13.3 to 13.13 (13.1 and 13.2 are the notifications frames). 1440 wide, Geist and Geist Mono only, fictional names (Mercy Achieng, HR Manager, is the viewer). Status 23 Oct 2026: Group 1 approved; Group 2 approved with the changes below, redrawn; Group 3 drawn, waiting for the owner's look.

## Group 1: My file (frames 13.3 to 13.7)
- 13.3: the phone content on a wide page. Identity header (avatar 72, name 26, "position · site", progress "2 OF 4" at the right). Two columns of 560 px, gap 20. Left: Still to finish, Your job, Sign-in and alerts. Right: IDs and bank (last four digits, Show, Edit, blue note), Your contact (Edit).
- Sign-in and alerts card (new): Sign-in email, Password (Change), Notifications ("Off on this computer", Turn on), "Lost a phone? Signs you out on every device." with red-brown underlined "Sign out everywhere". It replaces the Profile page.
- Photo and bank flows are centred dialogs over a dimmed page: 13.4 Add your photo (480), 13.5 Adjust your photo (520, circle crop, zoom 1.4x), 13.6 Photo not saved (480), 13.7 Your ID and bank (560, KRA PIN error as on the phone). Desktop wording: "Choose a photo", "From this computer".
- Edit, Add, Show, Change: amber `#A8680A`, underlined, 14 px.

## Group 2: the other screens (frames 13.8 to 13.12)
- 13.8 My leave: four KPI cells, filters, list 660 + detail 460, "Open leave slip". Redrawn in the new shell from the approved desktop frame. The sentence about a manager's leave is dropped (the viewer is HR).
- 13.9 My payslips: latest payslip card (dots until shown), buttons, "This year so far" with dots coloured like the bar (Earned green, Taken off amber, Net paid dark), all-payslips table with year chips, P9 card.
- 13.10 One payslip: a right drawer (560) over 13.9, not a page. Net figure, This month / Year to date, Earned, Taken off, Net pay strip, View document, Download PDF.
- 13.11 My notices: stat cells (To sign, Can appeal, Ended), one notice, circle stepper, Download signed notice, "Appeal this notice" (red outline). Sample reads "From your Director".
- 13.12 Activity on my record: chips, table with the numbered pager and "6 rows per page", detail panel with "That was me" and "This wasn't me". No "My phones" link.

## Group 3: sidebar (frame 13.13)
- A: Workforce open. Each sub-header (Staff, Time, Pay, Setup) has its line touching the header text, as the line touches "Workforce": 1 px at x 23.5, `#B5823E` at 70%, starting at the header text's bottom edge and ending at the last elbow.
- B: the name and role block at the bottom opens one item: **Sign out**. Profile is gone; My account is My file, My leave, My payslips, Activity on my record, My notices.

## Decisions (owner, 23 Oct)
- No page lists a person's phones or devices. The system keeps device records in the background only. "My phones" and its remove dialog are deleted.
- A lost phone: "Sign out everywhere" on My file, and "This wasn't me" on Activity (signs out every device).
- The first sign-in on a new phone still asks "Is this your phone?" (frames 3.1, 3.2).
- Profile page removed. Account name and phone follow the HR record; an account name change goes through HR (not drawn).
- One payslip opens in a right drawer.

## Not obvious from the frames
- Sidebar highlight follows the page; the breadcrumb reads "My account / <page>".
- Dialogs close on Cancel or Esc; the drawer on the X or Esc.
- Clone glitches in Paper, not design: sidebar logo image, count alignment in 13.13 A, "Published" tag in 13.10's background.

## Left out
- Phone versions of the new My file card and the drawer; older chapters (Audit and security step 03, frame 12.6) still show My phones and must be redrawn or ignored.
- Empty and error states beyond the states kit; Director-only variants.
- Build follow-ups: remove `my-phones` and `profile` routes and nav rows, add the card and "Sign out everywhere" action, the drawer for one payslip.
