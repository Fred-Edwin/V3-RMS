# Pilot session: Paper catch-up and Purchasing design check

Paste this whole file as the first message of a new agent session. It runs **alongside** the lane tooling session ([pilot-lane-tooling.md](pilot-lane-tooling.md)). This session touches **only the Paper file and docs**. No app code, no servers, no database, so it cannot collide with other lanes. Only one agent edits Paper at a time.

## Read first
- `CLAUDE.md` (rules 12–14), `docs/ROADMAP.md`, `docs/features/inventory/paper-updates-needed.md` (the checklist for this session), `docs/features/inventory/decisions.md` ("Access"), `backend/src/modules/inventory/purchasing/README.md` and `frontend/features/inventory/purchasing/README.md` (if present).
- Paper file "Wendo RMS · Approved designs", id `01M3TP8J54R83RHC9FJ7RAHGKG`. Load the Paper guide first (`get_guide`), then use `get_basic_info`, `get_tree_summary`, `get_screenshot`, `get_computed_styles` and `get_jsx` for exact values. Never read sizes or colours off screenshots.

## Authority
The owner authorises Paper edits in this session **only** for the items in `paper-updates-needed.md` and for fixes found by the Purchasing check. Anything else is a question for the owner, not an edit. Items marked "update Paper, or tell the owner to choose" go to the owner as one batched list of questions with your recommendation for each; do not decide them yourself.

## Part 1: Paper catch-up
Work through every unchecked item in `paper-updates-needed.md`: the sidebar (group-level spine, chevrons, Restock levels as the sixth branch, Supplier AP removed, Dashboard and Reports hidden, Settings), the stale "Draft v0.1" cover stamps on Prep and Stock & counts, and the Session 7 deviations. Build the sidebar from the live code values (`frontend/components/app/shell/sidebar-nav.tsx`, the spine and branch construction) and the existing rail `1BI5-0`, not by eye. Tick each item in the checklist as it is done. Mark the visual check per artboard, not at the end.

## Part 2: Purchasing design check
Does the approved Purchasing design still fit what was decided since it was drawn? Check, and list every mismatch:
- the permissions table in `backend/src/modules/inventory/_shared/central-store-access.ts` (who reads, who writes; the Accountant writes supplier invoices, payments, payment methods and documents; Director and Branch Manager write nothing; the Branch Manager cannot see supplier payment details);
- the new sidebar (Supplier AP is gone; "Orders to pay" replaces it);
- read-only variants for roles that can read but not write;
- the System Admin signing with their own PIN.
Fix small mismatches in Paper. For larger ones (a missing screen, a changed flow) write them up and ask the owner. Write the findings to `docs/features/inventory/purchasing-design-check.md`.

## Rules
- Paper edits end with `finish_working_on_nodes`. Do not show raw node ids to the owner.
- Edit repo files with Edit/Write only, with a `Why:` line before each. Commit only your own files with explicit paths and the `Co-Authored-By` trailer. Open a PR for the docs changes; do not merge it.

## Recap
End with the ~5 line plain-English recap: what changed in Paper, which docs, and which artboards the owner should look at.
