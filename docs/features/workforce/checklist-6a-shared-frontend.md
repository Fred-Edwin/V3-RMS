# Checklist: Shared parts, front end A (6a-shared-frontend)

Part 1 sets `Built`; part 2 sets `Verified` after the browser walk and the gates. Edit only the `Built`, `Verified` and `Note` cells.

| # | Screen | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Needs-you card, Branch Manager Home | yes | yes | `home/cards/needs-you-cards.tsx`, `needs-you/`. Walked 21 Oct: desktop and phone, badge equals card, row opens Requests |
| 2 | Needs-you card, HR, Accountant and Director Homes | yes | yes | Director gets Overdue with Send a reminder (walked, audit and notification written). Accountant walked (empty state). HR and System Admin walked; HR with rows not walked (nothing waits on HR in the lane) |
| 3 | Menu badges and nav-table changes | yes | yes | three rows removed, `wf-security` and `wf-requests-hr` added, tests pass; safety proof with the switch off done |
| 4 | Inbox Notifications tab | yes | yes | `notifications/`, one change in `InboxShell.tsx`; Mark all read clears the shell badge |
| 5 | "Is this your phone?" prompt | yes | yes | `SecurityGate`; walked for five roles; found and fixed faults 1 and 3 (decisions 23, 25) |
| 6 | My phones and remove a phone | yes | yes | `/app/workforce/my-phones`; the removed phone is refused by the server; audit entry written |
| 7 | "This wasn't me" and the password reset | yes | yes | `/app/workforce/wasnt-me`; fault 2 fixed (decision 24); audit entries and the System Admin's alert confirmed |
| 8 | System Admin Security alerts (view, clear with a note, Start alerts) | yes | yes | `/app/workforce/security`; fixes 26 and 27; audit entries confirmed |
| 9 | Shared message cards and States-kit copy | yes | yes | tests only: no screen uses the cards yet (later slices do); the empty and error copy was seen on the Home and Security alerts |
| 10 | Services, hooks and tests | yes | yes | `tsc` 0, lint 0 errors, 155 test files and 1454 tests pass, `check:imports` exit 0 (99 warnings, 0 errors), `pnpm build` exit 0; READMEs written |
