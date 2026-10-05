# Progress Hub

A small public website that shows the client and stakeholders where each Wendo RMS feature stands, how each feature works, and how each role uses it step by step. One link, no login. It is a communication tool for the rebuild, not part of the RMS application.

Nothing is built yet. The PRD is in draft.

## Where things live

| What | Where |
|---|---|
| What we are building and why, requirements, scope, phases | [PRD.md](PRD.md) |
| How the screens look (owner-approved, 5 Oct 2026) | Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`), page **"Progress Hub · Design"**: https://app.paper.design/file/01M3TP8J54R83RHC9FJ7RAHGKG/p-D-0 |
| The code (when built) | `progress-hub/` at the repository root. Its own `package.json`. It imports nothing from `frontend/` or `backend/`. |
| The content the site shows (when built) | `progress-hub/content/` (JSON files, one per feature, role and journey) |
| Where the facts come from (progress, chapters, notes) | `docs/features/<feature>/README.md` status tables and the feature's approved Paper pages |

If sources disagree: **Paper "Progress Hub · Design" page > PRD.md > code** for how the site looks and behaves. For facts about a feature's progress, **that feature's own README > the Hub's content files**, and the Hub's content is corrected to match.

## Paper artboards (page "Progress Hub · Design")

| # | Artboard | What it defines |
|---|---|---|
| 1 | Hub home | The feature list with Designed, Approved, Built and Staff trained columns |
| 2 | Deck viewer (Workforce) | Slide list, slide, notes panel |
| 3 to 7 | Sample slides | Screens in context, title, the problem today, who does what, the journey |
| 8 | Feature page, User journeys tab | Choose a role |
| 8b | Feature page, Overview tab | Summary, contents, all-slides grid |
| 9 | Role page (Branch Manager) | The role's journeys and their status |
| 10 | Journey viewer | Steps, real screen, notes |

## Status

| Part | Status |
|---|---|
| Designs in Paper | Approved by the owner, 5 Oct 2026 |
| PRD | Draft v0.1, owner has seen the outline and approved the direction |
| Plan | [plan.md](plan.md): 13 small tasks, one short session each. Task status is kept in that file. |
| Build | Not started |
| Branch | Hub work lives on `feat/progress-hub` (branched 5 Oct 2026 from `docs/workforce-design` so it carries the PRD and plan, which are not on `main` yet). Built in lane 3. Before any PR, rebase onto `main` or cherry-pick only the Hub commits so Workforce docs and Hub code merge separately. |
| CI | Done (task 1). `deploy.yml` ignores pushes that only touch `progress-hub/` or `docs/features/progress-hub/`. `progress-hub-checks.yml` runs on PRs that touch `progress-hub/` (stub until task 5). Vercel must also skip builds for non-Hub changes when the project is created (task 13). |
| Deploy | Not started. Nothing is deployed until the owner says so. |

## Next

Task 2 in [plan.md](plan.md). To start any task, clear the conversation and say "task N".
