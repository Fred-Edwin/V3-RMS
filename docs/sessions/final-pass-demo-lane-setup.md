# Workforce final pass, step 0: the clean demo lane and the recording method

Working document. Delete it when Workforce ships. Paste everything below the divider into a fresh session started in the **lane 6** worktree. **This session builds a repeatable demo environment and a recording method. It does not record any section's video yet.**

---

You are a tech lead on Wendo RMS. The owner will send the client a short professional video of each Workforce section after it is polished. Every video must be recorded from a **clean lane with realistic fictional data**, and must be **repeatable**, so that after a fix the same video can be re-recorded in minutes. Read `docs/sessions/workforce-two-part-method.md` (fresh servers, background commands, gotchas) and `docs/features/workforce/FINAL_PASS.md`. Nothing is pushed; commit before your final message.

### Where you work
Lane 6 worktree (it holds `scripts/training/` untracked from other work: leave it alone and never commit it). Create `git checkout -b demo/workforce-lane origin/feat/workforce-stack-complete`. Ports: front end 3106, API 4106 (lane 6), database `wendo_rms_lane6` (check `backend/.env`; it is a throwaway lane database). Run `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate`. **You may reset this lane's database freely; never touch the owner's main database** (the read-only Postgres MCP points at it).

### The three things to build

1. **A demo seed** (`backend/src/scripts/demo-data/workforce-demo-seed.ts`, run with one pnpm command, safe to run twice, and a matching `--reset`): a believable fictional Wendo with **two branches** (Nyeri Town and one more) plus the Central Store, about 24 fictional Kenyan staff across roles (Branch Manager, a department head per department, baristas, waiters, chefs, a steward, a store attendant), plus HR, the Accountant, the Director and the System Admin. Realistic names, positions, departments, pay profiles (bank only), a few months of rota and attendance history, **one fully approved and paid previous month**, **one current month ready for payroll**, a few leave balances and requests in different states, one conduct notice with an appeal, a casual worker, and signed documents. Numbers must add up and be consistent across screens. **No real people, no client data, no real bank details**, and no figures copied from the owner's main database. Use obviously fictional account numbers. Annual leave in Rules is set to 21 days. The attendance switch is on for the demo branches (that is the point of the lane). Logins use one memorable fictional password and a clean email pattern (for example `hr@demo.wendo.test`); record the table of demo users in a README next to the script.

2. **A recording method** (`scripts/demo/`): a Playwright script runner that **drives the real app in a real browser at 1440 x 900 (desktop) and 390 x 844 (phone)**, with a small helper library: log in as a role, wait for the screen to settle, move the pointer smoothly to a target and click, type at a natural pace, scroll gently, pause on a result, and record to a video file per scene. Rules for the helper: the **happy path only**, no console errors or error toasts on screen, never shows a PIN being typed in the clear (type dots and a fixed PIN only), no real personal data. Output is a video per scene plus a **captions file** (JSON: time, text) for each. Do not use any automated pixel-diff.

3. **A captions and assembly method** (`scripts/demo/assemble`): join scenes with ffmpeg into one MP4 per section, burn in the **designed captions** (a 12-column grid with 48 px margins, the product's own type tokens and espresso brand colour, large readable text, short sentences, no voice-over), add a title card and an end card, and export 1080p. Check that ffmpeg is installed (`command -v ffmpeg`); if it is not, stop and tell the owner the exact install command for Arch (`sudo pacman -S ffmpeg`) rather than working around it.

### Prove it with one tiny scene
Record a **30 to 45 second sample** of one simple flow (log in as HR, open the Employees list, search, open a person's file) end to end with captions, assembled to MP4, and extract three frames to check readability and that nothing private shows. Put the sample in your scratchpad and name its full path in your final message. Then **run the whole thing again from a reset** and confirm the second video matches the first (same scenes, same data), so re-recording after a fix is reliable.

### Rules
Edit and Write tools only; a live task list; no subagents; commit with `git add <explicit paths>` ending with `Co-Authored-By: ` plus your attribution line. There is no call cap: the seed, the helper library and the assembly are three natural pieces. Leave the lane's servers stopped when you finish.

### Final message
(1) decisions table, (2) 5-line recap, (3) the demo users table, the exact commands to seed, reset, record a scene and assemble a video, the sample video's full path, anything the owner must install or decide, and gaps. **Do not draft the next session's prompt.** Stop for the owner's review.
