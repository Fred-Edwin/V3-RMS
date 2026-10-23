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
Write the scenes and the section file `scripts/demo/sections/people.json` (title card, scenes, end card) for a client who has not seen the product, about 3 to 4 minutes in total, one idea per scene, short captions:
1. HR Home: the cards and "Needs you" (desktop).
2. Employees: search, open a file, the Edit button on a card (desktop).
3. Hire a person: the steps, the single sign-in address and temporary password (desktop).
4. Change pay: HR sends it with a PIN, the Director reviews it (Now, New, Difference) and approves (two roles, desktop).
5. Probation: a head writes the report on a phone, HR decides (phone, then desktop).
6. Organisation: assign a head, the person label in the picker (desktop).
7. My file on the phone: IDs and bank hidden, Show, edit a number (phone).
8. A role that cannot open a page: the "Not available for your role" screen (desktop).
Record each scene once to prove it works, assemble `people.json`, and check three frames by eye for readability and for anything private (real names, PINs, the owner's data). Re-run from a `--reset` and confirm the same scenes and data appear. Put the video in your scratchpad and name its full path.

### Do not
Record the final People video now: the fixes in Batch 3 and the desktop "My ..." screens are still being built, so screens will change. Leave the scenes ready so the final recording is one command. Do not change the product. Edit and Write tools only; a live task list; no subagents.

### Final message
(1) decisions table, (2) 5-line recap, (3) the exact commands to seed, record a scene, record the whole People section and assemble it, the sample video's full path, product bugs seen (a short list), gaps. **Do not draft the next session's prompt.** Stop for the owner.
