# Checklist: Conduct front end (Segment 5)

Edit only the Built, Verified and Note cells. Part 1 sets Built; part 2 sets Verified after the gate that proves it has run.

| # | Screen | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Staff list and one notice with the stepper | yes | no | `StaffListScreen`, `NoticeScreen`, kit `CircleStepper`; stat columns chosen by the server |
| 2 | Inbox message and the notice before signing | yes | no | The notice before signing is built (`NoticeScreen` when the person can sign). The Inbox message itself is the Shared parts' screen; its three Conduct links all open screens built here |
| 3 | Sign with your code and appeal | yes | no | `SignScreen` (paused code, no lock wording, first-use code), `AppealScreen` (no PIN, draft kept for the visit) |
| 4 | The list after HR decides | yes | no | Same list; the three figures and the headline come from the server; decision block with reason on the notice |
| 5 | Branch Manager Conduct list and person picker | yes | no | `DeskScreen` on the shared table; the picker is the combobox inside the issue panel |
| 6 | Issue a warning | yes | no | `IssuePanel` (right sheet 530), facts box, draft preview in a new tab, PIN, inline discard confirm |
| 7 | The notice document and phone Document view | yes | no | `ConductDocumentScreen` on `PdfViewer`; verbal note shows its record, no download; no "read as text" (API has none) |
| 8 | Record not signed (witness, PIN) | yes | no | `RecordDialog`, `WitnessPicker`, plus the witness confirm card at `/app/conduct/witness/[id]` |
| 9 | HR appeal and decision | yes | no | `AppealPanel`, `DecideDialog` (also "Change this notice"); the Director decides HR-issued notices only |
| 10 | Employee file Conduct tab and status reference | yes | no | `ConductFileTab` in the People file; status reference is a disclosure under the desk list, no popover on the tag |
| 11 | Navigation row, permissions and wiring | yes | no | `wf-conduct` built; three Me rows; route gates; the menu badge and Home rows are the Shared parts' |
| 12 | Services, hooks and tests | yes | no | 91 new tests (rules, markup, route gates) and the nav lists updated; nothing run in a browser yet |
