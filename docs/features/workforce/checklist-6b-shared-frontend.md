# Checklist: Shared parts, front end B (6b-shared-frontend)

Part 1 sets `Built`; part 2 sets `Verified` only after the browser walk and the gates.

| # | Screen | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Audit log list, filters and pager | yes | no | `audit/log`; URL state, search 250 ms, Flagged, Area/Event/Site from facets, numbered pager, states |
| 2 | Entry drawer and tamper-evidence display | yes | no | `entry-drawer.tsx`; Before/After, Proof (entry number, hash, follows) |
| 3 | Export and Check the chain (with limits) | yes | no | Export reason line; chain: running, intact, broken, once-a-minute wait, failure |
| 4 | Activity on my record | yes | no | `audit/my-record`; chips, flagged card, one entry, answers; "This wasn't me" ends in the Security reset page |
| 5 | The Director's payslip-opens digest | yes | no | Home side card `workforce.payslip-openings`; rows link to the log |
| 6 | Signed documents index | yes | no | `documents/index`; tab of the Audit log; Open document in a PDF drawer, Copy link |
| 7 | Public verify page, all outcomes, no sign-in | yes | no | `app/verify/[kind]/[number]`; seven outcomes; role and date only |
| 8 | Signed-in verify and report a problem | yes | no | Upgrades the public answer when a session exists; Tell the {role}; "You cannot read" |
| 9 | Navigation rows, public route gate and permissions | yes | no | `wf-audit-log` built, `wf-my-record`, `wf-staff-my-record`; route-access rules; `/verify` outside the middleware matcher |
| 10 | Services, hooks and tests | yes | no | 5 test files (logic, words, verify outcomes, nav); no component tests for the screens yet |
