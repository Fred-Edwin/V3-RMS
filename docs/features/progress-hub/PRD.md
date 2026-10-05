# Progress Hub — Product Requirements

Draft v0.1, 5 Oct 2026. Written from the owner's decisions in the design conversation of 4 to 5 Oct 2026. Nothing here is built.

Design reference (owner-approved): Paper file "Wendo RMS · Approved designs", page **"Progress Hub · Design"**: https://app.paper.design/file/01M3TP8J54R83RHC9FJ7RAHGKG/p-D-0

Folder map and status: [README.md](README.md).

---

## 1. Summary

The Progress Hub is a small public website with one link and no login. It shows:

1. **Where each Wendo RMS feature stands** (Designed, Approved, Built, Staff trained).
2. **An overview of each feature** as a short slide deck with notes.
3. **User journeys**: for each role, the step-by-step tasks they do, with the real screens and notes.

It is for communicating the rebuild to the client and stakeholders, and later for training staff. It is not part of the RMS application and shares no code, database or login with it.

## 2. Problem and goals

**Problem.** The rebuild happens feature by feature. The client cannot easily see what is done, what is only designed, or how a role will actually use a feature. Screens live in a design tool the client does not use, and explaining each one in a meeting does not scale.

**Goals**
- G1. The client can open one link and see the status of every feature.
- G2. A stakeholder can understand a feature without a meeting: what problem it solves, who uses it, how it works.
- G3. A person in any role can see their own step-by-step journey with the real screens.
- G4. The owner can keep the Hub up to date cheaply: edit a data file, push, done.
- G5. The material can later be used to train staff.

**Non-goals.** It is not a project-management tool, not a place to give feedback or comments (version 1), and not documentation for developers.

## 3. Audience

| Who | What they want |
|---|---|
| Director | Where the project stands and what they get |
| HR Manager | How hiring, rota, time, leave and pay will work for HR |
| Branch Manager | How to plan the rota, see who is in, fix times, review overtime |
| Store Manager | The same for the Central Store team |
| Other stakeholders (Accountant, department heads) | Their own role's journeys |
| The owner (presenter) | Something to present from a laptop in a meeting, and to send as a link |

## 4. Scope

**Version 1 (in scope)**
- Hub home with all 10 features and Inventory.
- The Workforce feature page with both tabs: **Overview** and **User journeys**.
- The Workforce overview deck (8 slides, with notes).
- Role pages and journey viewers for the Workforce journeys that are approved.
- "Being designed" outlines for journeys not yet drawn, shown honestly.
- Mobile-friendly reading.
- Public link, not indexed by search engines.

**Version 2**
- **PDF downloads** (decided by the owner, 5 Oct 2026): a whole overview and a role's journeys, with a print layout.
- Inventory deck and journeys.
- Further features as they are designed.

**Version 3 (optional)**
- **Presenter mode with hand gestures**: camera in the browser, off by default, sends "next" and "previous". See section 13.

**Out of scope**
- Login, accounts, comments, analytics beyond basic hosting stats, real company data of any kind.

## 5. Decisions already made (do not reopen)

| # | Decision |
|---|---|
| H1 | It is a **website with a slide viewer built into it**, not a single deck. |
| H2 | **Open to anyone with the link**, no login. |
| H3 | Progress columns on the hub: **Designed** (a bar), **Approved** (checkbox), **Built** (checkbox), **Staff trained** (checkbox, shown after Built). |
| H4 | The feature-level **Approved** box stays unticked until the **whole feature** is approved. Individual journeys carry their own "Approved" tag. |
| H5 | Only the owner ticks the boxes. They are set in a data file and are read-only to visitors. |
| H6 | Each feature has an **Overview** (deck) and **User journeys**. Journeys are organised **by role, then by task**. A task shared by several roles appears under each, using the same screens. |
| H7 | A role page opens with a one-line summary, then lists its journeys. A journey not yet designed appears as **"Being designed"** with an outline, never hidden and never faked. |
| H8 | **Slides and journeys show real screens plus diagrams**, not only one or the other. |
| H9 | **Notes** sit beside every slide and every journey step. They can be hidden. |
| H10 | **Plain language.** Short direct sentences. No stories, metaphors, analogies or jargon. |
| H11 | **Colours:** navy, grey and white with one blue accent. Wendo brown appears **only inside the product screenshots**. |
| H12 | Sample names and numbers only, and labelled as sample data. |
| H13 | **Build in this repository** in a new top-level folder `progress-hub/`, deployed as a **separate Vercel project**. |
| H14 | **PDF downloads wait for version 2.** |
| H15 | **Gestures are an optional later Presenter mode**, off by default. The keyboard must always work. |
| H16 | Nothing is deployed until the owner says so. |

## 6. Pages and navigation

| Page | Address (proposed) | Purpose | Paper |
|---|---|---|---|
| Hub home | `/` | All features and their progress | Artboard 1 |
| Feature page | `/<feature>` | Header with progress, tabs Overview and User journeys | Artboards 8, 8b |
| Overview slide viewer | `/<feature>/overview/<n>` | One slide with notes | Artboards 2 to 7 |
| Role page | `/<feature>/roles/<role>` | The role's journeys and their status | Artboard 9 |
| Journey viewer | `/<feature>/roles/<role>/<journey>/<step>` | One step: the real screen and notes | Artboard 10 |

Flow: Hub home, then a feature, then Overview or User journeys; from journeys choose a role, then a journey, then step through it. Every page has a way back up one level. Previous and next work with the arrow keys, buttons, and a swipe on a phone.

## 7. Content model

All content is data files in `progress-hub/content/`. No page text is typed into components.

| File | Holds |
|---|---|
| `modules.json` | The 10 features plus Inventory: name, number, one-line summary, status (`in-progress` or `planned`), designed count and total, `approved`, `built`, `staffTrained` (booleans), last updated date |
| `features/<feature>/overview.json` | The overview deck: an ordered list of slides, each with a type, text, an image or diagram reference, and its notes |
| `features/<feature>/roles.json` | The roles for the feature: name, one-line summary |
| `features/<feature>/journeys/<journey>.json` | A journey: title, role or roles, when you do it, status (`approved` or `being-designed`), and an ordered list of steps |
| A journey step | Title, device (computer or phone), where to click ("Schedule, then Rota"), screen image path, numbered notes, what happens next |

Images of real screens are exported from the approved Paper pages and stored in `progress-hub/public/screens/<feature>/`. They must show sample data only.

**Facts and where they come from.** Progress counts and status come from the feature's own README status table. If a count and the README disagree, the README wins and the content file is corrected. The role and journey counts shown in the design are estimates and are recomputed from the content files at build time.

## 8. Requirements

IDs are for tracing in the plan and in tests.

**Hub home**
- HH-1. Lists all 10 features and Inventory, grouped "In progress" and "Planned", in roadmap order.
- HH-2. Each row shows number, name, last updated, one-line summary, Designed bar with a count, Approved checkbox, Built checkbox, Staff trained.
- HH-3. Planned features show "Not started" and dashes, and have no Open button.
- HH-4. Staff trained shows "After build" until Built is ticked. Checkboxes are display only.
- HH-5. An in-progress feature has an Open button. A feature without a deck shows "Coming soon".

**Feature page**
- FP-1. Header with name, summary and the same progress strip as the hub.
- FP-2. Two tabs: Overview and User journeys. Overview is the default.
- FP-3. Overview tab: an "In short" paragraph, "Start the overview", a contents list, and a grid of all slides. Clicking a slide opens the viewer at that slide.
- FP-4. User journeys tab: "Choose your role" list showing, for each role, a one-line summary, journeys ready and journeys in design.
- FP-5. A not-yet-designed slide has a dashed border and says screens are not designed yet.

**Slide viewer and journey viewer** (one component, two uses)
- SV-1. Left: list of slides or steps with the current one marked. Middle: the slide or the real screen. Right: the notes panel.
- SV-2. Previous and next by arrow keys, buttons and swipe. A progress indicator shows position.
- SV-3. Notes can be hidden. On a phone the notes sit below the screen.
- SV-4. Every step shows who it is for, the device, and how to get there.
- SV-5. Screens are shown in a window or phone frame, with numbered markers matching the notes where needed.
- SV-6. The list of other journeys is available from a journey step.

**Role page**
- RP-1. Breadcrumb, role name, one-line summary.
- RP-2. A table of journeys: number, title, when you do it, number of steps, status (Approved or Being designed), Open.
- RP-3. A "Being designed" journey opens an outline page, not a viewer.

**Content and quality**
- CQ-1. Every slide and every journey step has notes.
- CQ-2. Writing follows section 10.
- CQ-3. No page contains real employee, pay or customer data.

## 9. Design requirements

Defined by the approved Paper page. In summary:
- **Palette:** white and fog `#F3F5F8` grounds, ink `#0B1426`, navy `#14284B`, slate text `#5B6676`, line `#D9DEE6`, one accent blue `#2C6ECB`. Status green `#2F6438` for Approved. Dashed grey for anything not designed yet.
- **Type:** Geist for text, Geist Mono for small labels. Large titles in tight semibold.
- **Layout:** information sits on surfaces, not in boxes where a rule will do. Generous space. Tables follow `docs/UI_BUILD_RULES.md` section 4 where lists are long.
- **Accessibility:** text contrast of at least 4.5 to 1, visible keyboard focus, every control reachable by keyboard, alt text on screenshots.
- **Responsive:** readable on a phone with a 16px side margin and no horizontal scroll.
- **No fake device chrome** other than the simple window and phone frames in the design.

## 10. Writing rules for all content

1. Short, direct sentences. Say what the thing does.
2. No stories, analogies or metaphors. No jargon. If a technical word is needed, explain it once.
3. Describe a role by what it does and what it sees.
4. Where something is not designed yet, say so plainly: "Screens not designed yet."
5. Dates as "5 Oct 2026". Names and numbers in screens are sample data and are labelled so.
6. Do not promise dates or features that are not decided.

## 11. Privacy and security

- The site is public to anyone with the link. It must therefore contain **no real people, pay figures, customer data or credentials**. Screens use the sample data already in the approved designs.
- Search engines are told not to index it (`robots` meta and `X-Robots-Tag: noindex`).
- It has no login, no forms, no database and no server code, so it stores nothing about visitors. Hosting-level basic statistics are acceptable.
- Content is reviewed by the owner before each deploy. Because the repository is private and only the built pages are public, nothing in `docs/` is exposed.

## 12. Technical approach and hosting

**Proposed, to be confirmed in the plan.**
- **Stack:** Next.js (App Router) with static export (`output: 'export'`), TypeScript strict, pnpm. Content in JSON files, validated with Zod at build time so a broken content file fails the build.
- **Folder:** `progress-hub/` at the repository root, with its own `package.json`. No imports from `frontend/` or `backend/`. Planned layout:

```
progress-hub/
  app/                     routes (thin shells)
  components/              hub table, tabs, viewer, notes panel, frames
  content/                 modules.json and features/<feature>/...
  lib/                     content loading and validation
  public/screens/          exported screen images (sample data only)
  README.md
```

- **Hosting:** a **separate Vercel project** with its root directory set to `progress-hub/`. Not deployed until the owner says so.
- **CI:** the existing deploy workflow runs on every push to `main` and deploys the API. Before the Hub is merged, the workflow must be changed with **path filters** so a Hub-only change does not trigger the API deploy, and an RMS-only change does not rebuild the Hub. The workflow is read before it is changed.
- **Build checks:** `pnpm build` and a content validation step, run inside `progress-hub/`.
- **Parallel lanes:** built on its own branch in its own lane, per `docs/PARALLEL_WORKFLOW.md`.

## 13. Presenter mode with gestures (version 3, optional)

For presenting from a laptop without touching the keyboard or touchpad. Recorded here so version 1 is built to allow it.

- It is **off by default**. The presenter switches it on with a button and the browser asks for camera permission.
- It runs **entirely in the browser**. No video leaves the laptop.
- It only sends the same two commands as the arrow keys: next and previous. So version 1 must expose `next()` and `previous()` from the viewer.
- Known risks and how they are handled: false triggers while talking (an arming gesture, a cooldown and a visible "armed" indicator), camera position and room lighting (the presenter checks before the meeting), and failure (keyboard and a clicker always work, and a key turns gestures off).
- Hand tracking uses an open-source model that runs in the browser (for example MediaPipe).

## 14. How content is updated

1. Edit the content files (progress, checkboxes, slides, notes, journeys) and add any new screen images.
2. Run the build, which validates the content.
3. Owner reviews the preview.
4. Merge. The Vercel project redeploys at the same link.

The owner asks the assistant to do step 1 in plain words, for example "tick Approved for Workforce" or "add the Leave journey for HR".

## 15. Phases

| Phase | Contents | Done when |
|---|---|---|
| 1. Plan | Task plan, CI path filter, content files drafted | Owner approves the plan |
| 2. Version 1 | Hub home, Workforce feature page, overview deck, Branch Manager and other approved journeys, "Being designed" outlines | Owner reviews a preview link and approves |
| 3. Publish | Vercel project, domain or default address, noindex checked | Owner says deploy |
| 4. Version 2 | PDF downloads, Inventory deck and journeys, more features as designed | Owner approves |
| 5. Version 3 | Presenter mode with gestures | Tried in a rehearsal and approved |

## 16. Success measures

- A stakeholder finds any role's journeys from the hub home in three clicks or fewer.
- The owner can update a progress box or a note and republish in under ten minutes.
- No page contains real data (checked before each deploy).
- The hub and all viewers pass a keyboard-only walkthrough and read correctly on a phone.

## 17. Risks and open questions

| # | Item | Plan |
|---|---|---|
| R1 | Some counts in the design are estimates (Workforce "9 of 16 chapters"; Inventory "11 of 11 designed, 8 of 11 approved"; role and journey counts) | Recompute from the READMEs and the content files before showing the client |
| R2 | Journey step titles and notes are drafted from the Chapter 5 to 9 screens | The assistant writes all notes from the real screens; the owner reviews |
| R3 | A public link can be forwarded | Sample data only; owner reviews each deploy |
| R4 | Deploy workflow runs the API deploy on every push to `main` | Add path filters before merging (section 12) |
| R5 | Screenshots show brown product UI inside a navy and grey site | Intended: the brown is the real product |
| O1 | Which address to use (default Vercel address or a Wendo subdomain) | Owner decides at publish time |
| O2 | Whether the site should show "Updated" dates per feature automatically or by hand | Proposed: by hand in the content file |
| O3 | Journeys for roles whose chapters are not designed (Accountant, Director) | Shown as "Being designed" outlines until the Pay, Leave and Conduct chapters are approved |
