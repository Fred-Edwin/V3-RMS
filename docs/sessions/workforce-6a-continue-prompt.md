Continue the Workforce segment 6, back end A build in the lane 3 worktree (`/home/fred/Projects/V3-RMS-lanes/lane-3`, branch `feat/workforce-6a-shared-backend`; it already holds 6 commits of mine, the last is a WIP checkpoint).

1. Run `git branch --show-current` and `git status` (should be clean) and `git log --oneline | head -8`.
2. Read `docs/sessions/workforce-6a-handover.md` in full: it lists the ground rules, what is committed, every decision made so far, and the remaining work in order (A finish Security, B Needs you, C proof, docs and gates).
3. Read the brief `docs/sessions/workforce-6a-shared-backend.md` (everything below its divider is still your brief, including the final-message format). Do not re-read the specs in full: use the handover's "Spec pointers".
4. Recreate a live task list from the handover's remaining work, then carry on from "A. Finish Security", step 1. The `CLAUDE.md` rules apply as before (Edit/Write tools only, a `Why:` line before every Edit or Write, pnpm, no `any`, `requireCapability`, commit with explicit paths and the Co-Authored-By line).
5. Stop when the brief says to: final message with the decisions table first, then the 5-line recap, then the APIs Leave and Conduct must call, departures, files touched and front-end gaps. Do not draft the next session's prompt.
