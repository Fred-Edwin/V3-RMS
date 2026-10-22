# Checklist: People batch 2B (the People screens)

Edit only the Built, Verified and Note cells. Part 1 sets Built; Part 2 sets Verified after a real-browser walk.

| row | item | built | verified | note |
|---|---|---|---|---|
| 1 | Job and pay tab cards with Edit | yes | yes | Seen as HR, Accountant, Branch Manager. Amber underlined Edit; pale grey tag otherwise; one card shell and row grid. Layout is the two columns of 12.1 for every role; the stacked Pay and "Deductions and rules" card of 7.1 are not built (decisions 2, 22) |
| 2 | Edit IDs and bank | yes | yes | Saved as HR (audit holds field names only, no numbers); the Accountant's is "Edit bank" with no ID fields. Subtitle and Accountant note follow 7.2; the HELB label wording and a divider above Bank are not as drawn |
| 3 | Edit pay / Change pay | yes | yes | Sent KES 26,000 as HR with a PIN. The PIN is one wide field and the reason is a picker, not four boxes and free text (decisions 20, 21) |
| 4 | Director review dialog | yes | yes | Now, New, Difference tiles, asker with position and site, wrong PIN refused ("That PIN is not right"), then approved. Cancel is a button, not the amber link of 7.4 |
| 5 | Person label (shared) | yes | yes | Two-line picker label seen in Assign head and Reports to; one-line label seen in the employee list. Matching letters are covered by the unit test, not seen live |
| 6 | Person label used in all pickers and tables | yes | yes | Assign head, Reports to (hire form and Edit job; Edit job was missed in part 1 and fixed here), employee list |
| 7 | My file phone layout | yes | yes | 390 px, as Joseph Kamau. Matches 8.1 and 8.2 values (rows, columns, note, contact card, saved bar) except the dark identity card, kept on the owner's instruction (decision 19), and the page ground, which is the app canvas |
| 8 | Own numbers saved at once (and Accountant told) | yes | no | The form opens with the in-app pad; a save from My file and the Accountant's note were not clicked through in the browser. Back end test from part 1 stands |
| 9 | Photo pages | yes | yes | Choose, adjust and "Photo not saved" seen at 390 px against 8.4 to 8.6. A successful save could not be seen: the lane has no image storage key, so the save fails (the failed page is real) |
| 10 | Tap targets | yes | yes | Measured at 390 px: every My file target is 44 px or more. The shell's "Open menu" is 32 px (Batch 2A's file) |
| 11 | HR Documents sentence removed | yes | yes | No such sentence in the code (grep); the Documents tab was not opened in the browser |
| 12 | Head's report (dialog, route, back end) | yes | yes | As Kelvin Kings at 390 px: full page (9.1), Needs work with no note refused, then sent. Saved as `NEEDS_WORK` by a head. The desktop dialog (9.3) was not compared with Paper |
| 13 | HR Decide dialog report block | yes | yes | Shows "Kelvin Kings · Chef", "SENT 22 OCT" and the note. The "WHAT WE KNOW" kicker, the left bar on the block and the "On time" cell of 9.4 are not drawn |
| 14 | My team page and endpoint | yes | yes | Phone list matches 9.2 (status and shift at the right). The desktop table (9.5) was not compared with Paper |
| 15 | Branch Manager's file | yes | yes | Tags, lock icons, wording and six rows match 12.1; the header band and Overview tab differ from the frame and are not this batch's |
| 16 | Pay history future row | yes | no | Data-driven; there was no approved future-dated change in the lane to see it |
| 17 | Deletions | yes | yes | Old bank dialog, own ID/bank and NSSF dialogs, "who looked" sentence, `payChangeSteps`, `NoteDialog`; and in part 2 `jobRows`, the old Job rows and the old photo page markup |
