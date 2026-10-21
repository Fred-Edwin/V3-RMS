# Workforce · Conduct (front end)

The screens of warning notices: the staff list and one notice with its stepper, signing with your code, appealing, the manager's Conduct list with Issue a warning, recording that a notice was not signed with a witness, HR's appeal and decision, the notice document, and the Conduct tab of an employee file. Spec: `docs/features/workforce/specs/5-conduct-spec.md`. API: `docs/API_CONTRACT.md` §44. Choices and departures: `docs/features/workforce/decisions-5-conduct-frontend.md`. Checklist: `checklist-5-conduct-frontend.md`.

**Status:** built and walked in a real browser on 21 Oct 2026 (fresh servers, real logins, one flow end to end with the audit entries read from the database); awaiting the owner's review. The letters are placeholder wording for the lawyer: this code shows what the server renders and never states the wording.

## Parity manifest (one line per screen)

| Screen | Paper | Built | Notes |
|---|---|---|---|
| Staff list (figures, rows, download) | 2ZFG-0 left, 1HFB-0 | `staff/staff-list-screen` | Figure row spacing fixed to Paper's 110 px. Verbal note shows "no letter" and no download. Compared to Paper. |
| One notice with the stepper | 2ZFG-0 right | `staff/notice-screen` | Also the "before signing" layout. The decision block with the reason shows after HR decides. By eye. |
| Sign with your code | 1GX7-0 left | `staff/sign-screen` | Wrong code: field cleared, "That code is not right.", cleared again on typing. Number pad on a phone. Enter never signs (rule 09). |
| Appeal | 1GX7-0 right | `staff/appeal-screen` | No PIN. Button shows why it is off. |
| Desk list and panel | 1GB0-0 | `desk/` | Compared to Paper. The status chips wrap to a second line in the 500 px list (shared table toolbar). Stacks under the list below 1280 px. |
| Issue a warning, person picker | 1GLY-0, 1QJN-0 | `issue/` | No-login person: callout and small print say the letter is given by hand. Wrong PIN keeps the panel open. |
| Notice document, phone Document view | 1GUF-0 | `document/` | Both the desk and the phone view show the 2-page letter with the decision page. By eye. |
| Record not signed, witness card | 1HRW-0 | `record/` | The witness card is beyond Paper (built in the Sign screen's style). |
| HR appeal, decide dialog | 1GYE-0, 1H7K-0 | `desk/appeal-panel`, `decide/` | Options use the kit's `RadioCards look="ink"` (Paper's ink fill). Compared to Paper. |
| Employee file Conduct tab | 1HGH-0 | `file-tab/` | By eye. Timeline reads the replaced chain. |
| Status reference | 1I1E-0 | `desk/desk-screen` (disclosure) | A disclosure under the list, not a popover on each tag. |

## Folders
| Folder | What it holds |
|---|---|
| `_shared/` | API types, services (JSON and the PDF door), Nairobi dates, words and refusals, routes, hooks (online, signed act, session draft, letter download), the problem block, the signing PIN, legacy rows |
| `staff/` | The staff list, one notice, sign, appeal |
| `desk/` | The manager, HR and Director list, the table, the standard and appeal panels, the dialog host |
| `issue/` | The Issue a warning panel, the person picker, the facts box, the draft preview |
| `record/` | Record not signed, the witness picker, the witness confirm card |
| `decide/` | The decision dialog |
| `document/` | The phone Document view (staff and desk) |
| `file-tab/` | The Conduct tab of an employee file |

## Routes (thin shells in `app/`)
Staff: `/app/conduct`, `/app/conduct/[id]`, `.../sign`, `.../appeal`, `.../document`, `/app/conduct/witness/[id]`. Desk: `/app/workforce/conduct` (`?id=` chooses a notice; `?status=appealed|ended`, `?site=`, `?search=`, `?page=`), `/app/workforce/conduct/[id]` (redirects to `?id=`), `.../document`. The file tab: `/app/workforce/employees/[id]?tab=conduct`.

## Rules that must not drift
- A button is drawn only when the server says so (`actions`, `canIssue`, the capability list). No role names.
- A signed act uses the person's own PIN through `SigningPin`; Enter never sends; a paused PIN is a countdown, never a lock.
- Names carry their role; messages use the role alone; no he, she, her or his.
- Dates are Nairobi time through `_shared/lib/conduct-dates.ts`.
- Conduct does not import People (the file tab imports Conduct).

## Shared files touched (small blocks)
`nav-table.ts` and its test (`wf-conduct` built; three Me rows; all four Conduct rows carry `needsAttendance` so a branch that is switched off sees no new link), `lib/route-access.ts` (two rules), `_shared/index.ts` (`CircleStepper`), `_shared/lib/capabilities.ts` (`discipline.decide`), `page-parts.tsx` (`SegmentItem.disabled`), `_shared/components/choice-controls.tsx` (`RadioCards look="ink"`, additive), `ui2/data-table` (`isRowSelected`), People file (`tabsFor` second argument, the Conduct tab body).
