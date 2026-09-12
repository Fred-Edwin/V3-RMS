# Inventory & Procurement — Step 3 design pointer

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Step:** 3 of the per-feature pipeline — design in Paper
**Process (current, from 2026-09-10):** **ROLE-COMPLETE design pass** — every
screen a role touches is designed as one coherent set before the next role. See
`02-screens-by-role.md` (the governing doc) and the auto-memory
`project_inventory_design_strategy.md`. Slices (A → B → …) now survive only as
**build-sequencing**, not the design unit.
**Prior process (2026-09-09, superseded):** slice-by-slice — each slice's flows +
screens + artboards frozen together. Slice A was designed and approved under this
model (below) and stays frozen as-is.

**State policy (2026-09-10):** universal `loading / empty / error /
permission-denied` = the Session-0 shell `15W-0`, never redrawn per screen. A new
screen gets a `populated` artboard + only the state artboards that change its
layout (`mid-signature`, `price-alert`, `overpayment`, …). Slice A's richer
per-screen state lists predate this and are not trimmed.

---

## Paper source of truth

| | |
|---|---|
| **File** | `V3-RMS` — id `01M1ZZJ6S3FZGF5C7PPBGTKY89` |
| **Page** | `Inventory — Feature 1` — pageId `3-0` |
| **URL** | https://app.paper.design/file/01M1ZZJ6S3FZGF5C7PPBGTKY89/3-0 |

The frozen Paper file is the reference. This doc only pins *which* artboards are
the approved ones. No screenshot export.

**Token note:** colours are real Paper tokens (`--color-*`). Read current values
from Paper at the start of any session — the owner edits between sessions
(e.g. `--color-table-header-bg` was changed to `#E7EEF7`). Paper does **not**
resolve `var()` for `fontFamily` — the signature font (Alex Brush) is applied as
a literal string per node; `--font-signature` is documentation-only.

---

## Session 0 — Shells & Primitives — APPROVED 2026-09-09

Owner-approved with the owner's own further manual edits in Paper.

| Artboard | ID |
|---|---|
| 0 · Shells & Primitives | `15W-0` |

Covers: colour + status map (§01), sidebar + rail (§02 — line icons,
underline-active), top bar (§03), controls (§04), ledger table (§05),
line-entry grid — variant A "with pricing" for Goods Receipt, variant B
"quantity only" for Requisition/Prep/Counts/Dispatch (§06), Sign sheet — 4
states (§07), signed-document + print (§08), KPI strip (§09), universal
empty/loading/error/permission-denied states (§10), right-side drawer (§11),
hub-landing shell + band pattern.

---

## Slice A — Buying, Receiving & Supplier AP — APPROVED 2026-09-10

Flows 1, 2 (2a–2e), 14, 15, 16, 17 (17a). Governing spec:
`02-screens.md` § "Consolidation & information architecture" +
the Slice A per-screen entries.

### Approved artboards

**A1 — Central Store dashboard** *(shell + landing)*
| State | ID |
|---|---|
| desktop · populated | `1UF-0` |
| desktop · all-clear | `2E7-0` |
| desktop · Attendant (no AP) | `2LZ-0` |
| desktop · loading | `2TM-0` |
| desktop · error | `31Y-0` |

**A-hub — Purchasing hub** *(new surface; INBOUND + HISTORY bands; replaces A4-page / A5 / A8)*
| State | ID |
|---|---|
| desktop · populated | `3JM-0` |
| desktop · empty | `3OH-0` |

**Receiving worklist** *(new surface — Attendant-only inbound route)*
| State | ID |
|---|---|
| Attendant · desktop | `5C8-0` |

**A2 — Suppliers / AP landing page** *(absorbs A11 aging, decision 2026-09-10)*
| State | ID |
|---|---|
| desktop · populated | `5GE-0` |
| desktop · loading | `5R3-0` |
| desktop · empty (first-run) | `5XA-0` |
| desktop · error | `63H-0` |
| desktop · permission-denied (Attendant) | `69O-0` |

KPI strip: Total invoiced (90d) · Paid · Outstanding · Overdue 30+ (all gated to
Store Manager + Accountant + Director). Table columns: Supplier (name + terms /
last-purchase sub-line + inline `disputed` flag) · Invoiced · Paid · Current ·
1–30 · 31–60 · 61–90 · 90+ · Outstanding, under a "DAYS OVERDUE" caption.
Filters: search · terms · has-balance · aging · date range. Export on the header.

**A3 — Supplier detail** *(route)* + **New / edit supplier** *(drawer)*
| State | ID |
|---|---|
| detail · desktop · populated | `6IJ-0` |
| detail · desktop · loading | `71E-0` |
| detail · desktop · submitting | `783-0` |
| detail · desktop · error | `7ES-0` |
| detail · desktop · permission-denied (Attendant) | `7LH-0` |
| new / edit supplier · drawer (over detail) | `6TF-0` |

**A4 — New purchase** *(drawer off the Purchasing hub)*
| State | ID |
|---|---|
| drawer over Purchasing hub | `4D9-0` |

**A6 — New Goods Receipt** *(route; mobile-primary)*
| State | ID |
|---|---|
| desktop · price-alert + damage-note | `3TG-0` |
| desktop · Pay now | `44L-0` |
| desktop · mid-signature (Sign sheet) | `3YT-0` |
| desktop · empty (walk-in) | `7T0-0` |
| desktop · pre-filled (from EXP) | `7Y9-0` |
| desktop · offline (local draft) | `83I-0` |
| **MOBILE (attendant)** — 390px | `898-0` |

**A7 — Goods Receipt detail (signed) + print** *(route)*
| State | ID |
|---|---|
| desktop · populated | `8CJ-0` |
| desktop · loading | `8J5-0` |
| desktop · error | `8N1-0` |
| **MOBILE** — 390px | `8RJ-0` |

**A9 — Record supplier invoice** *(drawer)*
| State | ID |
|---|---|
| drawer | `4LD-0` |

**A10 — Record supplier payment** *(drawer)*
| State | ID |
|---|---|
| drawer | `4UM-0` |
| drawer · overpayment | `53P-0` |

**A11 — Supplier aging report** — **FOLDED INTO A2 (2026-09-10).** Old artboards
kept on-canvas, dimmed, renamed `A11 · SUPERSEDED — folded into A2 · <state>`
(`8T5-0`, `938-0`, `99H-0`, `9FQ-0`, `9LZ-0`) for reference only. Not part of
the build.

**A12 — Supplier statement reconciliation** *(route; Accountant only)*
| State | ID |
|---|---|
| desktop · populated | `9U5-0` |
| desktop · matched (all lines reconcile) | `A2T-0` |
| desktop · dispute-open | `A6P-0` |
| desktop · loading | `AAL-0` |
| desktop · error | `AEH-0` |
| desktop · permission-denied (everyone else) | `AID-0` |

### Flagged follow-ups (not yet designed)

- **Print layouts.** Every document-rendering screen (A7 goods receipt, and later
  C3 delivery note, D count sheets, B requisitions, supplier statements, the A2
  aging export) needs a **dedicated print stylesheet / layout** — paper margins,
  letterhead / branding block, no app chrome, tabular mono figures, page breaks,
  "Page N of M", signature line. To be designed as its own pass — the tail of
  Slice A's build, or a standalone "Print layouts" mini-slice. See
  `02-screens.md` § Consolidation "▸ Print layouts".
- **Attendant sidebar — spec vs. prior art.** `02-screens.md` § Consolidation nav
  table hides Suppliers / Catalog / Reports for the Attendant; the earlier
  `A1 · Attendant` artboard still shows them. Slice A's newer permission-denied
  artboards follow the spec (Attendant nav = Dashboard · Receiving · Prep ·
  Dispatch · Stock & counts only). Reconcile before Slice A build if the A1
  artboard is to be the source of truth.

### Approval

**Slice A design approved by the owner on 2026-09-10.** Flows (`02-flows.md`
Slice A section) + screens (`02-screens.md` Slice A section) + the artboards
listed above are frozen. Slice A's build (Step 4 → 7) can start.
