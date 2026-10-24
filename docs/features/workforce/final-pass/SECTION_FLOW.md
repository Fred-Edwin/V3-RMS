# The flow for every remaining section (owner-approved 24 Oct 2026)

This replaces the four-step loop in `FINAL_PASS.md` for sections 2 to 10. It comes from what People taught us (`LESSONS.md`). Follow it in order; do not skip a step and do not go back to an earlier one except where a step says so. The orchestrator keeps the status table at the bottom current.

## The six steps
| # | Step | Who | What happens | Output |
|---|---|---|---|---|
| 1 | **Orient** | One agent, alone, read-only | Reads the section's approved Paper frames, its module READMEs and the final-pass conventions (`LESSONS.md`, the design notes of rounds 1 to 3, the People cross-cutting list). Predicts what must change before anyone watches anything. | `final-pass/<n>-<name>-carry-forward.md`: a table of what must change and why, the coverage list of screens, roles and states to watch, and a plain-words "how it works" |
| 2 | **Watch** | An agent drives one browser, the owner watches and speaks | Realistic demo data first (the owner approves it). Then role by role: the agent announces its plan, waits for "go", walks slowly, asks "what should be corrected?", records the owner's words. No Paper comparison. No fixing. | `final-pass/<n>-<name>-walk-feedback.md` (the owner's words, plus a short list of what the agent saw) |
| 3 | **Decide** | The orchestrator, then the owner | Groups the carry-forward list and the owner's feedback into **design**, **build** and **later**. The owner answers a handful of questions, nothing more. | `final-pass/<n>-<name>-decisions.md` (pre-filled; the owner changes only what they disagree with) |
| 4 | **Design** | A design agent in Paper, the owner approves each group | Only the gaps: screens that do not exist yet or that the conventions change. Groups of frames, one stop per group. | `final-pass/design-notes-<n>-round-1.md` |
| 5 | **Build** | Two or three lanes in parallel, each with a "stay out of" list | Part 1 and part 2 only for big batches; small jobs run as one session. Delete as you go. Gates run once on the merged result by the orchestrator. | Merged on `feat/workforce-stack-complete`, pushed as a backup |
| 6 | **Close-out, then video** | One lean session, then the demo lane | Clean-up (files over 350 lines, folders over 12 files), the database tests on the clean prepared database, documents. Then the demo video; **watching it is the sign-off**. | `final-pass/<n>-<name>-closed.md`; the video |

## Rules that never change
1. One session per lane; check `pgrep -fa claude` before pasting a brief. Reviews and walks use lane 4 or lane 1; builds lanes 2 and 4; design lane 3; demo lane 6; the orchestrator merges in lane 1.
2. Design before build. A build starts from approved frames and a design-notes file.
3. Late owner decisions go to the running session as a short message; the orchestrator checks the merged result for contradictions.
4. Define a number once and read it everywhere (the report names the definition).
5. Tests run on the clean prepared database (`TESTING.md` after the People close-out), every section.
6. Nothing is merged to `main`, pushed to production or deployed without the owner's word. The whole feature ships once, when it is ready (owner, 24 Oct 2026).
7. No Central Store or Inventory screens in demos; fictional data only.

## Status
| # | Section | Orient | Watch | Decide | Design | Build | Close-out and video |
|---|---|---|---|---|---|---|---|
| 1 | People | n/a | done | done | done | done | close-out running, video recording |
| 2 | Schedule (Shifts, then Attendance) | next | | | | | |
| 3 | Timesheets | | | | | | |
| 4 | Rules | | | | | | |
| 5 | Payroll | | | | | | |
| 6 | Payslips and casual pay | | | | | | |
| 7 | Leave | | | | | | |
| 8 | Conduct | | | | | | |
| 9 | Shared parts (and Act as another user) | | | | | | |
| 10 | Whole feature | | | | | | |

## Parked, to discuss while Schedule's first session runs
- **Feature switch per branch** (a general mechanism for every feature, with the Attendance switch as its first user): see the orchestrator's proposal in the conversation of 24 Oct 2026; decide scope after the owner answers.
- **Glossary** (`docs/GLOSSARY.md`): needs the owner's definitions of "staff" and "floor staff".
