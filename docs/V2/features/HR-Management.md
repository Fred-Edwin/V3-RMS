# Feature Spec: HR Management
## Wendo Coffee Bistro — RMS V2.2
**Status:** Draft — Open questions remain (see Section 8)
**Phase:** V2.2
**Last Updated:** 2026-03-22

---

## 1. Overview

The HR Management feature brings staff performance tracking, supervisory assessments, and disciplinary records into the system. It replaces an entirely paper-based and memory-dependent HR process with a structured, auditable digital record for every staff member.

**Primary problem it solves:** Decisions about warnings, recognition, and disciplinary action are currently made without documented evidence. As Wendo scales to 10 branches, branch-level HR decisions cannot be made reliably without a consistent, cross-branch record system.

---

## 2. Actors

| Actor | Role | What They Do |
|---|---|---|
| Director / HR | `DIRECTOR` | Full HR access — view any staff profile, issue disciplinary records, view cross-branch reports |
| Branch Manager | `MANAGER` | View and manage HR records for staff within their branch |
| Supervisors | `CHEF`, `WAITER` (with supervisor designation — pending scoping) | Submit structured assessments for staff they supervise |
| Staff Member | Any operational role | View own performance data (pending scoping decision) |

---

## 3. Feature Areas

### 3.1 Staff Performance Profile

Every staff member has an HR profile that surfaces data already collected by V1:

**Quantitative metrics (derived from V1 data at query time):**
- Orders handled this month / this week (from `Order.createdById`)
- Average orders per shift
- Prep ticket claim rate and average prep time (from `PrepTicket`)
- Attendance rate: shifts attended / shifts assigned (from `ShiftAssignment` vs `ClockRecord`)
- Late clock-ins count (clock-in time > shift start + grace period)

**Qualitative data (new in V2):**
- Supervisory assessment history
- Disciplinary record history

No new data is collected for performance metrics — they are computed from existing V1 tables on demand.

### 3.2 Supervisory Assessments

Branch supervisors (Head Chef, Assistant Chef, Head Waiter, Assistant Waiter) submit structured assessments about the staff they supervise. Assessments are attached permanently to the staff member's record.

**Assessment structure:**
- Period covered (start and end date)
- Scored dimensions (e.g. conduct, punctuality, teamwork, quality of work — exact dimensions to be confirmed in scoping)
- Overall score (0.0–5.0)
- Free-text notes

Assessments are visible to the Branch Manager and Director. Whether the staff member sees their own assessments is a pending scoping decision.

### 3.3 Disciplinary Records

A formal, permanent record of disciplinary events against a staff member.

**Warning types (in progression):**
1. `VERBAL` — verbal warning issued, documented for record
2. `WRITTEN` — first formal written warning
3. `FINAL_WRITTEN` — final written warning (next step may be termination)

Each record includes:
- Date and time (automatic)
- Type
- Description of the incident or conduct
- Who issued the warning
- Supporting notes

Records are **never deleted**. They can be annotated but the original record is permanent. This protects the business and provides an auditable history.

### 3.4 HR Reporting

Structured reports for the Director and Branch Manager:

- **Attendance report:** Shift attendance rates, late clock-ins, absences — per branch or cross-branch, over a date range
- **Performance ranking:** Staff ranked by order volume, prep times, attendance — useful for identifying top and bottom performers
- **Disciplinary summary:** Count and type of disciplinary actions per branch over a period
- **Assessment history:** All assessments submitted in a period, filterable by assessor and staff member

---

## 4. Data Models

See `docs/V2/DATA_MODEL_ADDENDUM.md` Section 3.

Key models:
- `PerformanceAssessment` — structured supervisory feedback per staff member per period
- `DisciplinaryRecord` — permanent disciplinary history with `DisciplinaryType` enum

V1 models used for performance metrics (read-only in HR context):
- `Order` — order counts per staff member
- `PrepTicket` — prep times and claim rates
- `ShiftAssignment`, `ClockRecord` — attendance and punctuality

---

## 5. API Endpoints

See `docs/V2/API_CONTRACT_ADDENDUM.md` Section 3 for full endpoint specs.

Key endpoints:
- `GET /hr/staff/:userId/profile` — full HR profile with computed metrics
- `POST /hr/assessments` — submit supervisory assessment
- `POST /hr/disciplinary` — issue disciplinary record
- `GET /hr/reports/performance` — performance ranking report
- `GET /hr/reports/attendance` — attendance trends
- `GET /hr/reports/disciplinary` — disciplinary activity summary

---

## 6. Frontend Screens

- `/app/admin/hr` — HR overview: staff list with summary indicators (attendance rate, open disciplinary items)
- `/app/admin/hr/staff/[userId]` — individual HR profile: tabs for Performance, Assessments, Disciplinary History
- `/app/admin/hr/staff/[userId]/assess` — submit assessment form
- `/app/admin/hr/staff/[userId]/disciplinary/new` — issue disciplinary warning
- `/app/admin/hr/reports` — HR reports (tabbed: Attendance / Performance / Disciplinary)

---

## 7. Business Rules

- A staff member's disciplinary record can never be deleted by any user, including `SYSTEM_ADMIN`
- Branch Managers can only view and manage HR records for staff assigned to their own branch
- Supervisors can only submit assessments for staff they supervise (branch-scoped)
- HR reports for a Branch Manager are branch-scoped only; the Director can see all branches
- Assessment dimensions must follow the agreed structure (Zod schema enforced once dimensions are finalised)

---

## 8. Open Questions

| # | Question | Impact |
|---|---|---|
| 1 | Assessment form dimensions — what are the exact categories? Frequency — periodic or event-triggered? | Determines Zod schema for assessment submission |
| 2 | Can staff members view their own performance data, assessments, and disciplinary records? | Determines frontend screens and RBAC for self-view endpoints |
| 3 | Who has authority to issue a disciplinary warning — Director and Branch Manager only, or can supervisors (Head Chef, Head Waiter) also issue? | Determines `requireRole` on `POST /hr/disciplinary` |
| 4 | Does a warning require approval before it is formally recorded, or is it immediate on submission? | Determines if a `PENDING` disciplinary status is needed |
| 5 | Cross-branch HR visibility — can Branch Managers see HR summaries across all branches, or only their own? | Determines query scoping on report endpoints |
| 6 | How are V1 historical records carried forward? Is there a one-time data migration to pre-populate performance baselines? | Determines if a migration script is needed for V2.2 launch |
