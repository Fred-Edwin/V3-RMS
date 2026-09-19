# Mid-session briefing for S5 — new frontend quality standards

Paste this to the agent already running S5 (Purchasing hub, New purchase,
Receiving worklist). This is **not a new session** — it's an update to
standards S5 is already building against, added after S5 started. Read it,
apply it to what you've already built, then continue.

---

Three new subsections were added to `docs/features/inventory/04-components.md`
after this session started, all right after "Placement rules": **"Table and
list-screen quality bar," "Interactive states,"** and **"Feedback on failed
actions."** Read all three now, in full, before continuing.

**Why they exist:** a Milestone One review found tables that matched Paper's
mock data pixel-for-pixel but broke under real conditions — no pagination
past Paper's ~5-row mock, columns that didn't hold their width, no
horizontal handling on narrow viewports. The screens had been marked done
because they visually matched Paper, and visual match was silently treated
as the whole definition of done. It isn't. The same gap applies beyond
tables: Paper draws one static state per artboard, so hover/focus/active/
disabled only exist if someone deliberately wires them, and a button that's
present and clickable but gives no feedback on a failed request looks wired
without actually being wired. This session is not exempt from any of it just
because it started before the standards were written down.

## What this means for S5 specifically

Two things in your scope are list/table surfaces the new bar applies to —
check both now, whether or not you've already built them:

1. **The Purchasing hub's Inbound and History bands** (`U7V-0`/`WUL-0`).
   - Does the History band paginate or load-more past ~20–30 rows, using the
     `limit`/`cursor` params `GET /inventory/purchasing/history` already
     returns? Or does it render everything the endpoint sends, unbounded?
   - Do the money columns (the `~KES 8,100` estimates, exact receipt totals)
     hold a fixed, right-aligned width, or do they reflow as amounts vary in
     digit count?
   - Test both bands with more rows than Paper's mock shows — create a
     handful of extra expected deliveries via the API directly if you need
     to, don't rely on the exact row count the artboard happened to draw.

2. **The Receiving worklist** (`UMS-0`/`WSO-0`).
   - Same pagination/column-width check. This screen has no bespoke
     loading/error artboards (confirmed in the plan) — if you haven't
     already built the generic screen-mirroring skeleton default per
     "Placement rules," do that now too, it's the same section.

**New purchase** (the drawer) isn't a list screen — the table/list bar
doesn't apply there — but it **is** in scope for the two items below, same as
every other screen in this session.

3. **Interactive states, all three screens, every clickable element.**
   "Receive"/"Cancel"/"Add invoice" row actions, KPI tiles if clickable,
   "Save purchase"/"+ Add line" in New purchase, filter/search controls. Each
   needs hover, focus-visible (keyboard, not just mouse), active/pressed, and
   disabled states — check each against `04-components.md`'s "Interactive
   states" section rather than assuming the default-state build already
   covers them.
4. **Failure feedback on every write action.** `POST /expected-deliveries`
   and the cancel action must show a visible error (toast/inline) on a
   400/404/409 response — trigger a real failure (e.g. save with an invalid
   supplier id) and confirm something appears on screen, not just in the
   console. Per `04-components.md`'s "Feedback on failed actions."

## Verification — this is the part most likely to have been skipped

The standards draw a hard line: **comparing by eye against Paper confirms
layout fidelity only. It does not confirm functional completeness.** (And to
be explicit: this by-eye comparison, plus `get_computed_styles` for exact
values, is the standard — the automated `pnpm visual-diff`/`pixelmatch`
script is banned project-wide, owner decision 2026-09-16; do not run it even
as an extra check.) If your
verification so far has been "I diffed it against Paper and it matches,"
that is not sufficient and should not be reported as done. Do all of these
checks separately:
1. Compare by eye against Paper (`get_screenshot` vs. the running screen),
   and check exact values via `get_computed_styles` — you may have already
   done this.
2. Table/list quality bar (items 1–2 above), with a realistic or
   larger-than-mock dataset.
3. Interactive states wired on every clickable element (item 3 above).
4. A real, triggered failure response produces visible user feedback, on
   every write action across all three screens (item 4 above).
Use the Playwright/chrome-devtools MCP against the real running page for 2–4,
not just a visual read of the code.

## What to do now

- If you haven't built the Inbound/History bands, the Receiving worklist, or
  New purchase yet: build them to all four standards from the start, no
  rework needed.
- If you've already built any of them: go back and check against all four
  points above. Fix what's missing before moving on — don't defer it to a
  later session, this is part of S5's own stop condition now, not a
  follow-up.
- Everything else in your original S5 prompt is unchanged. Continue from
  wherever you are once this is applied.
