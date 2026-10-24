# Workforce final pass: what the People section taught us (read before planning any section)

Written 24 Oct 2026 by the orchestrator, for the owner to review and correct. These are working rules for sections 2 to 10. They come from what actually cost time or caused rework in People.

## What cost time, and the rule that fixes it
| What happened | Rule for every later section |
|---|---|
| A review of 78 findings was too long for the owner to read; the owner's own live walk found the real problems | **The owner's watch is the review.** An agent drives one browser, role by role, and records the owner's words. No long findings sheet first. A short agent-found list is added after, only for what the owner did not see. |
| Fix batches were written before the designs were approved, and some screens changed twice (Edit button, menu, sign-in, My screens) | **Design first, build second.** A section starts with a design pass for anything that needs one; builds start only from approved frames and a short design-notes file. |
| Menu, Homes and sign-in touched the same shared files as the People screens | **Parallel batches have a "stay out of" list.** One batch owns the shell (menu, Homes, route guard), the other owns the screens. A shared file is changed in its own small commit, named in the report. |
| Two copies of a session started on one lane and overwrote each other | **One session per lane.** Before pasting a brief, check `pgrep -fa claude` for that lane; the background-sessions list shows what is working. |
| The database tests could not run: lanes seeded with demo data lack the test logins and PINs | **Tests run on a clean prepared lane database** (`TESTING.md`, written in the People close-out); the demo seed is only for lane 6 and for the owner's watch. Prove the database tests every section, not at the end. |
| A 150-call cap and two-part sessions slowed small jobs | **Part 1 and part 2 only for big batches** (a back end plus many screens). Small jobs run as one continuous session. No call cap. |
| A brief's rule contradicted a later owner decision (Profile removed after Batch 3 added it) | **Late decisions are sent as a short message to the running session, and the orchestrator checks the merged result for contradictions** (a test that asserts the old rule is flipped, not deleted). |
| "Deleted later" would have left old code in place | **Delete as you go**, after a search; every report lists Deleted and Kept, because X still uses it. |
| Counts disagreed between Home, Organisation and Employees | **Define a number once** (for example "active", "no head") in one place and read it everywhere; the report names the definition. |

## What made it faster (keep doing it)
- Plain-English plan before any build; the owner decides in one reply.
- Designs approved in Paper in groups, with one design-notes file the builders read; Paper wins where the notes differ.
- The pre-filled decisions file: the owner changes only what they disagree with.
- A realistic demo seed that rebuilds in one command, so every watch and video starts from the same company.
- Two parallel build lanes plus a demo lane, merged by the orchestrator, gates run once on the merged result.
- One browser page for the whole watch; the agent announces the plan, waits for "go", asks "what should be corrected", records the owner's words.

## The loop for each remaining section (proposed)
1. **Plan** (short, with the owner): what the section is, what it hands to the next section, what is not built.
2. **Watch**: the agent drives the real product role by role, the owner watches and speaks; the agent records. A back end is checked with the clean test database.
3. **Decide**: the orchestrator groups the feedback into design, build and later; the owner answers a handful of questions.
4. **Design** only what needs it, in groups, owner approving each.
5. **Build** in parallel lanes with a stay-out list; gates once on the merged stack.
6. **Close-out**: clean-up, proof, documents (one session per section, as in People).
7. **Video**: recorded from the demo lane; the owner watches it as sign-off.

## Rules that never change
Paper wins over notes; no pixel-diff; one browser page; no Central Store or Inventory screens in demos; fictional data only; edit with the Edit and Write tools; commit before the final message; never write to the owner's main database; nothing is merged to `main` or pushed to production without the owner's word. The whole feature ships once, when it is ready (owner decision, 24 Oct 2026).
