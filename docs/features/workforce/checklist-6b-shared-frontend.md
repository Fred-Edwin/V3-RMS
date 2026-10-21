# Checklist: Shared parts, front end B (6b-shared-frontend)

Part 1 sets `Built`; part 2 sets `Verified` only after the browser walk and the gates.

| # | Screen | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Audit log list, filters and pager | yes | yes | Walked 21 Oct, no Paper pair (Paper server timed out); organization field-name crash fixed. `audit/log`; URL state, search 250 ms, Flagged, Area/Event/Site from facets, numbered pager, states |
| 2 | Entry drawer and tamper-evidence display | yes | yes | Walked, no Paper pair. `entry-drawer.tsx`; Before/After, Proof (entry number, hash, follows) |
| 3 | Export and Check the chain (with limits) | yes | yes | Export wrote `audit.exported` and downloaded Audit-log.csv with a "Your file is ready." toast; Check the chain intact, and a second run within a minute shows "once a minute". Export reason line; chain: running, intact, broken, once-a-minute wait, failure |
| 4 | Activity on my record | yes | yes | Walked; "That was me" stored; "This wasn't me" not clicked (it signs out); no Paper pair. `audit/my-record`; chips, flagged card, one entry, answers; "This wasn't me" ends in the Security reset page |
| 5 | The Director's payslip-opens digest | yes | no | Empty week draws no card (seen); never seen with data (no payslips in the lane). Home side card `workforce.payslip-openings`; rows link to the log |
| 6 | Signed documents index | yes | yes | List, filters, panel walked with 3 proof rows (removed); Open document on a real file NOT proven; no Paper pair. `documents/index`; tab of the Audit log; Open document in a PDF drawer, Copy link |
| 7 | Public verify page, all outcomes, no sign-in | yes | yes | Private window, no sign-in: genuine, replaced, mismatch, unknown seen; voided, rate limited, malformed by unit tests only. `app/verify/[kind]/[number]`; seven outcomes; role and date only |
| 8 | Signed-in verify and report a problem | yes | yes | Signer named, Open the document; Tell the Branch Manager sent. Upgrades the public answer when a session exists; Tell the {role}; "You cannot read" |
| 9 | Navigation rows, public route gate and permissions | yes | yes | Switch on: rows show; switch off: Director sees none of them; other roles by API only. `wf-audit-log` built, `wf-my-record`, `wf-staff-my-record`; route-access rules; `/verify` outside the middleware matcher |
| 10 | Services, hooks and tests | yes | yes | Gates 21 Oct: frontend tsc, lint, 173 files / 1604 tests, build; backend tsc, 3 documents files / 9 tests. 5 test files (logic, words, verify outcomes, nav); no component tests for the screens yet |
