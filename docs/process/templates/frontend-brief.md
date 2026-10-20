# Template: front-end brief

Copy to `docs/sessions/<feature>-<segment>-frontend.md` on the stack, fill the `<…>` parts, commit. Start it only after the back end it needs has been accepted and merged into the stack by the orchestrator.

---

# <Feature> segment <n>: <name>, front end

Working document. Delete it when the feature ships. Paste everything below the divider into a fresh session started in the <lane> worktree. **Start only after the back end has been accepted and merged into the lane branch.**

---

You are a tech lead on Wendo RMS building the **screens of <name>** (Paper "<page>", <chapters>) against the **real back end that already exists**. Do not edit `backend/` except small gaps inside `backend/src/modules/<feature>/<sub>/` (own commit `fix(<feature>-<sub>):`, with tests, no migrations; never legacy tables or services). Nothing pushed.

### The owner's standing rule: production-ready, not Paper-only
Paper is a demonstration. Build screens that look exactly like Paper **and** behave in production: every loading, empty, error, offline, locked and no-permission state; a wrong, missing or locked-out PIN; a "changed underneath you" conflict; long names; large lists; a failed or slow download; keyboard and screen-reader use; narrow widths. The spec lists these under "What production adds": build all of them and anything else real use needs. **Log every addition** in `docs/features/<feature>/decisions-<n>-frontend.md` (*question, choice, why, what changing it takes*). Decide by default using your recommendation; stop only if truly blocked or the choice is expensive to reverse. Your last message opens with the decisions table, then a 5-line recap.

### Where you work
Lane <n> worktree, branch `<branch>` (prepared by the orchestrator: it holds the back end). Run `git branch --show-current` and confirm <a folder the back end created>; if not, stop and say so. Ports: front end `pnpm exec next dev -p 310<n>`, API 410<n> from this worktree's `backend/` (start it; run `migrate deploy` on the lane database). Lane browser address `http://lane<n>.localhost:310<n>`. Logins (password `password123`): `admin@`, `director@`, `bm.town@`, `accountant@`, `store.manager@`, `hr@wendo.test`, plus other roles found with the read-only Postgres MCP. To get the feature on a lane site, switch it on as the role that owns the switch and **switch it off again when you finish**. `CLAUDE.md` applies in full: pnpm only; no `any`; **Edit and Write tools only (never sed, awk, heredocs, scripts or `cp` for editing)**; one line starting `Why:` before **every** Edit or Write; a live task list; commit with `git add <explicit paths>` ending with the attribution line the session gives you; recap in plain English.
<If another session edits the same shared front-end files in parallel (`capabilities.ts`, `use-workforce-permissions.ts`-style permission hooks, `nav-table.ts`, `route-access.ts`, the Home card registry), name them and say: keep edits small, on separate lines, and list every line-level change in the sub-module README.>

### Speed and method (the owner's priority)
Assemble from the kit and the existing screens; they carry look, hover, focus, motion and accessibility. **Do not re-verify them.** The **spec file is your source for values and copy**; do not re-derive them from Paper. Open Paper only for **one screenshot beside your build per screen** (desktop 1440, phone 390) and fix visible differences. No per-component or per-dialog audits; no automated pixel-diff, ever. One keyboard run of each screen's main task; one test per new interactive component. Browser walk: the main role and one refused role; check the other roles through the API against the spec's permissions table. Parity manifest: one line per screen.

### Tidy and cost
Files aim for 250 lines or fewer, never over 350 (tests 400); one main component per file; no catch-all `utils`; **no folder over 12 files**; per sub-module `components/ hooks/ lib/ services/ types/` plus `index.ts`; `app/` pages are thin shells; never import another feature's internals. Size checks after each screen. No subagents; read only what is named; never re-read a file; run only the tests for what you change while iterating, then the full suite, `pnpm lint` and `pnpm build` once at the end; commit after each screen.

### Read first (only these)
1. `docs/features/<feature>/specs/<n>-<name>-spec.md` and its decisions file (every screen, documents, the status machine, the permissions table, the gap list) and `docs/features/<feature>/decisions-<n>-backend.md` (what the back end really does and where it departed from the spec, including "gaps for the front end").
2. The back-end module README and `API_CONTRACT.md` section, and the validators and types files only for request and response shapes.
3. `frontend/features/<feature>/_shared/README.md` and `index.ts` (the kit), the feature's earlier front-end decisions files (rules that still apply), `frontend/components/app/shell/nav-table.ts`, `lib/route-access.ts`, `docs/UI_BUILD_RULES.md`.

### Facts from the back-end report you must honour
<Paste the back end's "gaps for the front end": wire names, request shapes that differ from the spec, error codes, what is not built on the back end and must be derived on screen, capability names to add or remove.>

### Scope
**In:** <the screens, dialogs, documents and exports; the navigation rows and Home cards (shown only where the feature switch is on); services, types, hooks and tests for every endpoint used; button visibility from the API's permissions, never role names; the entry points the spec's gap list names.>
**Out:** <other segments' screens; anything that changes a site whose feature switch is off.>

### Gates and finish
`pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` all pass, lint included; size checks clean. **Prove the safety property:** with the switch off, the main roles see nothing new. Then one flow end to end on a lane site with the switch on, with audit entries confirmed. **Leave every lane site switched off.** Update READMEs, the parity manifest, the ledger rows, `docs/PROJECT_STATUS.md` and the feature README. Final message: (1) decisions table, (2) 5-line recap, (3) beyond-Paper items and back-end fixes made. Nothing "to do". **Do not draft the next session's prompt.** Stop for the owner's review.
