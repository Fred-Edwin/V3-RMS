# Workforce final pass, section 1: People, the demo video (lane 6)

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 6** worktree. The demo lane, the recorder and the assembler already exist (`demo/workforce-lane`). **This session closes their gaps and builds the People scenes. The final recording happens after the owner says the People fixes are merged.**

---

You are a tech lead on Wendo RMS. Read, once: `scripts/demo/README.md`, `backend/src/scripts/demo-data/workforce/README.md`, `docs/sessions/final-pass-demo-lane-setup.md` (the standing rules for demo work), and `docs/sessions/workforce-two-part-method.md` (only "Servers, proofs and long commands" and "Known gotchas"). Use plain words with the owner.

### Where you work
Lane 6 worktree, branch `demo/workforce-lane` (clean; leave `scripts/training/` alone and never commit it). Merge `origin/feat/workforce-stack-complete` into it (it now holds Batch 1, 2A, 2B and the People data added by the live walk; the demo seed was extended there, so **keep the walk's People additions and resolve conflicts in favour of keeping both**). Ports: front end 3106, API 4106, database `wendo_rms_lane6`, Redis 6406 (`docker start wendo-lane-6-redis`). Run `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate` in `backend/`. Never touch the owner's main database. Start servers fresh from current code and prove it. Commit with `git add <explicit paths>`; push nothing; leave servers stopped.

### Part A: close the known gaps
1. Seed: Central Store staff must have department and position ("Job details missing"); the seed must run clean from `--reset` twice in a row on the merged code (the sign-in address style, access change and PIN rules have changed); the attendance switch is on for the demo branches.
2. Look at every screen People touches as HR, Director, Accountant, Branch Manager, a head and a staff member in the lane, and fix the **seed** (never the product) where data looks empty or silly. Report product bugs you see in a short list; do not fix them.
3. Assembler: build the **phone layout** (device shape, caption at the left, as in Paper frame C on the Paper page "Demo videos · Caption design"). Re-film the sample once to check the arrow cursor and click ring.
4. Use one browser window per scene as the recorder already does.

### Part B: the People scenes (happy path only, no PIN shown, no console error, fictional data)
Write the scenes and the section file `scripts/demo/sections/people.json` (title card, scenes, end card) for a client who has not seen the product, **about 5 minutes in total**, short captions (owner-approved structure, 22 Oct 2026). **One running fictional person, Wanjiru, follows the story from hire to exit**; each chapter hands over to a different role. Add Wanjiru (and a fictional department head and Director where missing) to the seed so the whole story is repeatable from `--reset`. The chapters, in order:
- **0. Start the day (30 s, desktop):** HR Manager signs in (the device step shown briefly), lands on Home: the cards and the "Needs you" list (an overdue probation, a pay change waiting, a department without a head).
- **1. Hire a person (50 s, desktop):** HR hires Wanjiru through the steps (who, job, pay, bank), then the single sign-in address and the temporary password handed over. No real numbers: fake account number only.
- **2. Her first day (40 s, phone):** Wanjiru signs in, sets her PIN (masked), opens My file, adds her emergency contact, and sees ID and bank hidden behind Show.
- **3. Probation (40 s, phone then desktop):** the department head writes a report on a phone; HR opens the Decide dialog, sees the report, confirms Wanjiru.
- **4. A raise (45 s, desktop, two roles):** HR sends a pay change with a PIN (masked); the Director sees Now, New and Difference and approves.
- **5. Who leads each team (30 s, desktop):** Organisation: a department with no head, assign one from the picker that shows name, position and site.
- **6. Each role sees its own world (30 s, desktop montage):** the Homes of the Director, Accountant and Branch Manager in quick succession, then one blocked page showing "Not available for your role".
- **7. When someone leaves (30 s, desktop):** HR records an exit, shows the 7-day undo, and opens the certificate of service.
- **End card (10 s):** "Next: Schedule and Time".
Captions are short, one idea each; a caption in chapter 4 notes that approvals need a PIN. Use the running person's name consistently and leave out anything that fails or shows an error.
Because the story spans roles and devices, write each chapter as one scene file that signs in as the roles it needs (the recorder signs in off camera each time) and records the whole chapter in one browser window. Record each scene once to prove it works, assemble `people.json`, and check three frames by eye for readability and for anything private (real names, PINs, the owner's data). Re-run from a `--reset` and confirm the same scenes and data appear. Put the video in your scratchpad and name its full path.

### Do not
Record the final People video now: the fixes in Batch 3 and the desktop "My ..." screens are still being built, so screens will change. Leave the scenes ready so the final recording is one command. Do not change the product. Edit and Write tools only; a live task list; no subagents.

### Final message
(1) decisions table, (2) 5-line recap, (3) the exact commands to seed, record a scene, record the whole People section and assemble it, the sample video's full path, product bugs seen (a short list), gaps. **Do not draft the next session's prompt.** Stop for the owner.
