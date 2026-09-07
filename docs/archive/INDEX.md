# Archive

Historical documentation. **Not current guidance.** These files record how the
system was built and decisions made along the way. The authoritative record of
what the code does now is the code itself, plus the active docs in `docs/`.

Archived 2026-09-07 as part of the documentation cleanup that preceded the
feature-by-feature redo (see `docs/FEATURE_REDO_PLAYBOOK.md`).

## phases/

One file per historical build phase (Phase 0 through Phase 12), plus phase
addenda, module context docs, and one-off reports. Covers the build from
project foundation through order corrections, HR, accountant role, discounts,
payslips, guest split, comms, and the department-head shift scheduler.

Also here:
- `BUILD_ORDER.md` — the original 12-phase build sequence (superseded by the playbook)
- `AUDIT_REPORT.md` — pre-SaaS codebase audit, 2026-05-04 (point-in-time)
- `REFINEMENT_CONTEXT.md` — cross-phase refinement notes
- `UI_SYSTEM_ROADMAP.md` — the old "warm" design-system overhaul plan (dead;
  replaced by the new enterprise design system built in Phase 0 of the redo)
- `template.md` — old per-feature context doc template

## inventory/

Phase 1 build log and Phase 2 planning material from before the redo workflow.
Kept for reference; superseded by the playbook process. The Phase 1 *as-built*
behaviour that is still live in production is documented in the kept files under
`docs/inventory/`, not here.

- `INVENTORY_PHASE1_SESSION_PLAN.md` — the 9-session Phase 1 build log
- `INVENTORY_PHASE2_SESSION_PLAN.md`, `PHASE2_SESSION_*_AGENT_PROMPT.md` —
  old Phase 2 plans (old workflow, old design system)
- `UI_UX_DESIGN_AUDIT.md`, `UI_UX_AUDIT_HANDOVER.md`, `*_REDESIGN_PROMPT.md`,
  `*Screens UI Mockup Generation Prompts.md` — tied to the old design system
- `PILOT_DEMO_VIDEO_PLAN.md` — pilot demo scripting
- `old-mockups/` — old PNG screen mockups
