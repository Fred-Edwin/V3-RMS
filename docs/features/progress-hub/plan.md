# Progress Hub — build plan

Written 5 Oct 2026. Source of requirements: [PRD.md](PRD.md). Designs: Paper page "Progress Hub · Design" (link in [README.md](README.md)).

The work is split into small tasks. **Each task is one short session**: the owner clears the conversation, says "task N", and the assistant does that task only. State lives in files and git, not in the conversation. This keeps every session small and cheap.

## Session protocol (every task)

1. Read this file's section for the task number, and only the PRD sections and files it lists. Do not read other project documents.
2. **Do not open Paper** unless the task says so (tasks 2 to 4 only). Use `design-spec.md` and `public/screens/` instead.
3. Check pages with a text snapshot and the browser console. Take one screenshot at the end of the task, not after every edit.
4. Follow the root `CLAUDE.md` rules: pnpm only, no `any`, edit with the Edit and Write tools, a `Why:` line before each Edit or Write, a short task list.
5. At the end: set the task's status below to Done, commit with explicit paths (never `git add -A`), nothing pushed, and finish with a 5-line plain-English recap: what changed, which files, how the owner verifies it.
6. Tell the owner to clear the conversation and name the next task.
7. If a task grows past its size, stop at a clean point, commit, mark it "Partly done" with what is left, and say so.

## Status

| # | Task | Uses Paper | Status |
|---|---|---|---|
| 1 | CI path filters and where the code lives | no | Done |
| 2 | Extract the design spec | yes | Done |
| 3 | Export screens, Workforce chapters 5 and 6 | yes | Done |
| 4 | Export screens, chapters 7 to 9 and overview images | yes | Done |
| 5 | Scaffold, content schema and validation | no | Not started |
| 6 | Hub home | no | Not started |
| 7 | Slide and journey viewer component | no | Not started |
| 8 | Feature page, tabs, role list, role page | no | Not started |
| 9 | Workforce overview content | no | Not started |
| 10 | Journey content, Branch Manager | no | Not started |
| 11 | Journey content, the other roles | no | Not started |
| 12 | Quality pass and owner preview | no | Not started |
| 13 | Vercel project and publish (only when the owner says deploy) | no | Not started |

---

## Task 1. CI path filters and where the code lives

**Goal.** Make sure a Hub-only change never triggers the API deploy, and decide the branch for the code.
**Read.** `.github/workflows/deploy.yml`, `.github/workflows/pr-checks.yml`, `docs/DEPLOYMENT.md` section 7, `docs/PARALLEL_WORKFLOW.md` (only the parts about lanes and branches). PRD sections 12 and 17 (R4).
**Do.**
- Add path filters so changes only inside `progress-hub/` and `docs/features/progress-hub/` do not run the API deploy, and API or app changes do not run Hub builds. Change the least needed.
- Add a separate PR check for `progress-hub/` (install, content validation, build) that only runs when that folder changes. It may be a stub until task 5.
- Recommend the branch or lane for the Hub code (own branch such as `feat/progress-hub`) and write the decision into README "Status".
**Done when.** The workflow diff is small and explained in the recap; the owner has seen it. Nothing pushed.
**Commit.** `ci(progress-hub): path filters so Hub changes do not trigger the API deploy`

## Task 2. Extract the design spec

**Goal.** Turn the approved Paper page into a text spec so later sessions never open Paper.
**Read.** PRD sections 6, 8 and 9. Paper page "Progress Hub · Design" (artboards 1 to 10) with `get_basic_info`, `get_children`, `get_computed_styles` and `get_jsx`. Do not take screenshots except one per artboard to confirm.
**Do.** Write `docs/features/progress-hub/design-spec.md`: colour tokens, type scale, spacing, the measurements of each component (hub table row, tabs, status strip, slide thumbnail, viewer layout, notes panel, window and phone frames, role table), and states (hover, focus, "Being designed", checkbox ticked and unticked, mobile layout).
**Done when.** A developer could build each page from the spec without Paper.
**Commit.** `docs(progress-hub): design spec extracted from Paper`

## Task 3. Export screens, Workforce chapters 5 and 6

**Goal.** Real screens for the Branch Manager rota journey and the staff day.
**Read.** PRD section 7 (content model). Paper page "Workforce · B. Schedule and time". Export the **content child** of each step frame (the second child, not the caption bar) so no caption is included.
**Do.** Export Chapter 5 steps 1 to 10 and Chapter 6 steps 1 to 6 to `progress-hub/public/screens/workforce/` as optimised images with names like `ch5-step01-rota.png`. Write `progress-hub/public/screens/workforce/MANIFEST.md`: file name, chapter, step, the step's title and its role and device as drawn in Paper. Check each image shows sample data only. Keep each file under about 400 KB.
**Done when.** Every exported step has a manifest row and no image has a caption bar.
**Commit.** `docs(progress-hub): workforce screens, chapters 5 and 6`

## Task 4. Export screens, chapters 7 to 9 and overview images

**Goal.** The rest of the approved Workforce screens, plus images for the overview slides.
**Read.** Same as task 3, for Chapters 7, 8 and 9, and the "Shared · Notifications" section.
**Do.** Export the steps (Chapter 7: 6, Chapter 8: 5, Chapter 9: 3) and add them to the manifest. Also export the one or two screens the overview slides need ("Screens in context" uses the rota and the phone clock-in).
**Done when.** The manifest covers every approved Workforce step.
**Commit.** `docs(progress-hub): workforce screens, chapters 7 to 9`

## Task 5. Scaffold, content schema and validation

**Goal.** An empty Hub site that builds, with a content format that fails loudly when wrong.
**Read.** PRD sections 7 and 12. `design-spec.md` (tokens only).
**Do.** Create `progress-hub/` (Next.js, static export, TypeScript strict, pnpm). Add the colour and type tokens. Define Zod schemas for `modules.json`, `overview.json`, `roles.json` and journey files. Write the content loader, and a `pnpm validate:content` script. Add `modules.json` with all 10 features and Inventory (progress values from the README tables; mark any estimate with a `TODO verify` note in the file). Add the `noindex` meta and header.
**Done when.** `pnpm build` and `pnpm validate:content` pass inside `progress-hub/`, and a deliberately broken content file fails validation.
**Commit.** `feat(progress-hub): scaffold, content schema and validation`

## Task 6. Hub home

**Goal.** The page in Paper artboard 1.
**Read.** PRD HH-1 to HH-5. `design-spec.md` (hub table).
**Do.** Build the hub home from `modules.json`. Read-only checkboxes. "After build" for Staff trained. Mobile layout. Keyboard focus.
**Done when.** It matches the spec; one screenshot at desktop and one at phone width.
**Commit.** `feat(progress-hub): hub home`

## Task 7. Slide and journey viewer component

**Goal.** The one viewer used for slides and journey steps.
**Read.** PRD SV-1 to SV-6 and section 13 (the `next()` and `previous()` requirement). `design-spec.md` (viewer, notes panel, frames).
**Do.** Build the viewer: step or slide list, stage with window and phone frames and numbered markers, notes panel that can be hidden, previous and next by buttons, arrow keys and swipe, progress indicator. Expose `next()` and `previous()` so gestures can be added later. Test with a small sample content file.
**Done when.** It works by keyboard only and on a phone width.
**Commit.** `feat(progress-hub): slide and journey viewer`

## Task 8. Feature page, tabs, role list, role page

**Goal.** Paper artboards 8, 8b and 9.
**Read.** PRD FP-1 to FP-5 and RP-1 to RP-3. `design-spec.md` (tabs, status strip, slide grid, role table).
**Do.** Build the feature page with the Overview and User journeys tabs, the all-slides grid, the role list, the role page, and the "Being designed" outline page. Counts for "journeys ready" and "in design" are computed from the content files, not typed.
**Done when.** Navigation works from the hub to a journey step and back, with sample content.
**Commit.** `feat(progress-hub): feature page, role pages`

## Task 9. Workforce overview content

**Goal.** The 8 overview slides and their notes.
**Read.** PRD sections 5, 10 and the Workforce rows of `docs/features/workforce/README.md` (status table only). Paper artboards 2 to 7 are already summarised in `design-spec.md`.
**Do.** Write `content/features/workforce/overview.json`: title, the problem today, how it works, who does what, screens in context, the journey, Pay (outline, "Screens not designed yet"), status and next steps. Every slide has notes in the plain-language rules of PRD section 10.
**Done when.** `pnpm validate:content` passes and the owner can click through all 8 slides.
**Commit.** `content(progress-hub): workforce overview`

## Task 10. Journey content, Branch Manager

**Goal.** The Branch Manager journeys with real screens and notes.
**Read.** `public/screens/workforce/MANIFEST.md`. `docs/features/workforce/README.md` (status table and Chapters 5, 7, 8 rows). Do not open Paper.
**Do.** Write the journey files: Build and publish the rota (10 steps), Check who is in today, Fix a wrong clock time, Review timesheets and overtime. For each step: title, device, where to click, image, numbered notes, what happens next. Add "Being designed" outlines for Approve a leave request and Raise a warning. Notes are written from the screens and the approved wording, not invented.
**Done when.** Validation passes and the owner has read the notes for the first journey.
**Commit.** `content(progress-hub): branch manager journeys`

## Task 11. Journey content, the other roles

**Goal.** The remaining roles, reusing screens where tasks are shared.
**Read.** Same as task 10, plus the Chapter 1 to 4 and 9 rows. Role summaries from PRD section 5 and `docs/features/workforce/README.md` navigation table.
**Do.** Department head, HR Manager, Store Manager, Staff, Accountant, Director. Shared tasks reference the same journey file, not a copy. Roles without designed screens get "Being designed" outlines. Update `roles.json`.
**Done when.** Every role page lists its journeys with the right status and counts.
**Commit.** `content(progress-hub): other role journeys`

## Task 12. Quality pass and owner preview

**Goal.** Ready for the owner to review.
**Read.** PRD sections 9, 11 and 16.
**Do.** Keyboard-only walk-through, phone widths, contrast, alt text, `noindex` check, a scan of all content and images for real data, correct the estimated figures against the README tables (PRD R1), update `progress-hub/README.md`, and run `pnpm build`. Produce a local preview for the owner.
**Done when.** The checks pass and the owner has reviewed the preview.
**Commit.** `fix(progress-hub): quality pass`

## Task 13. Vercel project and publish

**Do only when the owner says deploy.**
**Do.** Create the Vercel project with root directory `progress-hub/`, confirm the address with the owner (PRD O1), confirm the `noindex` header on the live page, and record the link in README.
**Done when.** The owner opens the live link and approves.

---

## Later (not in this plan)

Version 2: PDF downloads, the Inventory deck and journeys, more features as they are designed. Version 3: Presenter mode with gestures. Each gets its own plan section when it starts.
