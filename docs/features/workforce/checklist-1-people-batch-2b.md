# Checklist: People batch 2B (the People screens)

Edit only the Built, Verified and Note cells. Part 1 sets Built; Part 2 sets Verified after a real-browser walk.

| row | item | built | verified | note |
|---|---|---|---|---|
| 1 | Job and pay tab cards with Edit | yes | no | Amber underlined Edit on Job, IDs and bank, Pay; grey tag otherwise. "Deductions and rules" card not built (decision 2) |
| 2 | Edit IDs and bank | yes | no | One dialog; Accountant gets bank only; reason and Accountant note on a bank change |
| 3 | Edit pay / Change pay | yes | no | Both open the same dialog: pay now since, difference, overlap warning, PIN |
| 4 | Director review dialog | yes | no | Now, New, Difference, Starts on, Asked by, Reason, overlap warning, PIN; Decline and Approve |
| 5 | Person label (shared) | yes | no | `PersonLabel` and `PersonLabelLine` in the kit, with matching letters marked; tested |
| 6 | Person label used in all pickers and tables | yes | no | Assign head, Reports to (hire form), employee list. No other person picker exists in People |
| 7 | My file phone layout | yes | no | Still to finish with circle markers, amber Add, 56 px rows; IDs card in two columns |
| 8 | Own numbers saved at once (and Accountant told) | yes | no | Back end test on the lane database; lock and "HR will check" copy removed |
| 9 | Photo pages | yes | no | Choose, adjust (circle crop, zoom), could not save with the reference |
| 10 | Tap targets | yes | no | 44 px on Show, Edit, Add, photo pages; to measure in the browser |
| 11 | HR Documents sentence removed | yes | no | Finding 70 closed as "not shown" |
| 12 | Head's report (dialog, route, back end) | yes | no | `/app/workforce/probation/[id]/report`; three verdicts; head writes for own department |
| 13 | HR Decide dialog report block | yes | no | "name · position", "SENT 19 OCT", the note; "No report yet" when none |
| 14 | My team page and endpoint | yes | no | `/app/workforce/team`, `GET /workforce/people/team`; read only |
| 15 | Branch Manager's file | yes | no | Job tab with restricted IDs, bank and Pay cards |
| 16 | Pay history future row | yes | no | Data-driven; already drawn by the history table |
| 17 | Deletions | yes | no | Old bank dialog, own ID/bank and NSSF dialogs, "who looked" sentence, `payChangeSteps`, `NoteDialog` |
