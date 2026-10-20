# Checklist: Shared parts, front end A (6a-shared-frontend)

Part 1 sets `Built`; part 2 sets `Verified` after the browser walk and the gates. Edit only the `Built`, `Verified` and `Note` cells.

| # | Screen | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Needs-you card, Branch Manager Home | yes | no | `home/cards/needs-you-cards.tsx`, `needs-you/` |
| 2 | Needs-you card, HR, Accountant and Director Homes | yes | no | Director also gets Overdue with Send a reminder |
| 3 | Menu badges and nav-table changes | yes | no | three rows removed, `wf-security` and `wf-requests-hr` added, tests updated |
| 4 | Inbox Notifications tab | yes | no | `notifications/`, one change in `InboxShell.tsx` |
| 5 | "Is this your phone?" prompt | yes | no | `SecurityGate` in `app/app/layout.tsx` |
| 6 | My phones and remove a phone | yes | no | `/app/workforce/my-phones` |
| 7 | "This wasn't me" and the password reset | yes | no | `/app/workforce/wasnt-me`; asks the current password once (decision 16) |
| 8 | System Admin Security alerts (view, clear with a note, Start alerts) | yes | no | `/app/workforce/security`; designed from the kit (decisions 18, 19) |
| 9 | Shared message cards and States-kit copy | yes | no | `messages.ts`, `message-cards.tsx`, `states-copy.ts`; not yet used by a screen |
| 10 | Services, hooks and tests | yes | no | unit and static-markup tests for each new part; sub-module READMEs and the docs pass are part 2 |
