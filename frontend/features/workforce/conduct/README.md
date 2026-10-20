# Workforce · Conduct (front end)

The screens of warning notices: the staff list and one notice with its stepper, signing with your code, appealing, the manager's Conduct list with Issue a warning, recording that a notice was not signed with a witness, HR's appeal and decision, the notice document, and the Conduct tab of an employee file. Spec: `docs/features/workforce/specs/5-conduct-spec.md`. API: `docs/API_CONTRACT.md` §44. Choices and departures: `docs/features/workforce/decisions-5-conduct-frontend.md`. Checklist: `checklist-5-conduct-frontend.md`.

**Status:** part 1 built (every screen of the brief, committed, type-clean, rules tested). Part 2 (browser walk, Paper comparison, gates, docs) is still to do. The letters are placeholder wording for the lawyer: this code shows what the server renders and never states the wording.

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
`nav-table.ts` and its test (`wf-conduct` built; three Me rows), `lib/route-access.ts` (two rules), `_shared/index.ts` (`CircleStepper`), `_shared/lib/capabilities.ts` (`discipline.decide`), `page-parts.tsx` (`SegmentItem.disabled`), `ui2/data-table` (`isRowSelected`), People file (`tabsFor` second argument, the Conduct tab body).
