# HR Module — Feature Specification
## Wendo Coffee Bistro RMS (V2)

**Status:** Pre-implementation reference
**Author:** System Architect
**Date:** 2026-04-10

---

## 1. Purpose

This document defines what the HR module must do, who it serves, and the industry-standard
capabilities it should cover. It is the authoritative reference for implementation planning.
No implementation decisions have been made yet — this is a requirements and design intent document.

---

## 2. What This Module Is

The HR module is Wendo's internal system of record for everything related to its employees.
It replaces paper files, WhatsApp notes, and the HR manager's memory with a structured,
searchable, and documented record of every staff member's employment history at Wendo.

It is used primarily by the **HR Manager** and **Directors**, with limited self-service
access for staff members to view their own information.

---

## 3. Who Uses It

| Role | What They Can Do |
|---|---|
| Director | Full read access across all branches; approve/reject escalated decisions |
| HR Manager | Full read/write access across all branches; owns all HR records |
| Branch Manager | Read/write for their branch staff; initiate disciplinary actions; approve leave |
| Staff (self) | View own profile, leave balances, leave history, received formal notices |

---

## 4. Core Capabilities

### 4.1 Staff Profiles (Extended Employee Records)

Every staff member in the system already has a `users` record covering their operational
identity (role, branch, auth). The HR module extends this with an `EmployeeProfile` that
covers the employment relationship.

**What is stored:**

- **Personal details** — national ID number, date of birth, personal phone number, personal email address (if any), physical address
- **Emergency contact** — name, relationship, phone number
- **Employment details** — employment type (full-time / part-time / casual), start date, end date (if applicable), probation end date, job title (can differ from system role), reporting manager
- **Compensation** — salary/wage, pay frequency (weekly / bi-weekly / monthly), bank account details (for payroll reference only — not processed by the system in V2)
- **Documents** — uploaded files attached to the employee record (see §4.4)
- **Notes** — free-text internal notes visible only to HR and Directors

**Key design intent:**
The `users` table owns authentication and operational identity. The `EmployeeProfile` is a
separate table with a one-to-one relationship to `users`. This keeps the operational system
clean and avoids bloating the auth layer with HR data.

---

### 4.2 Leave Management

Wendo staff need a formal, documented process for requesting and approving leave. Currently
this happens informally — a text message or verbal request — with no central record of
balances or history.

#### Leave Types

| Type | Description |
|---|---|
| Annual Leave | Paid leave accrued by the employee over time |
| Sick Leave | Paid leave for illness; may require a medical certificate above a threshold |
| Emergency Leave | Unplanned short-notice leave for personal emergencies |
| Unpaid Leave | Approved absence without pay |
| Maternity / Paternity Leave | Statutory leave entitlements per Kenyan employment law |

#### Leave Balances

Each employee has a leave balance per leave type. Balances are:
- Configured per employee (HR sets the annual entitlement)
- Decremented automatically when leave is approved
- Visible to the employee as a self-service read

Annual leave accrues over time. The accrual rate is configurable per employee.
The system tracks days used, days remaining, and days pending approval.

#### Leave Request Flow

```
Staff member submits request
        ↓
Branch Manager notified (via Internal Comms inbox — see separate spec)
        ↓
Branch Manager approves or rejects with a comment
        ↓
Staff member notified of decision
        ↓
If approved: balance decremented, record created
        ↓
HR Manager has full visibility and can override any decision
```

**Rules:**
- A request cannot be submitted for dates already taken (overlap detection)
- Sick leave above 3 consecutive days requires a medical certificate (uploaded as a document)
- Rejected leave requests remain on record with the rejection reason
- Cancelled leave (where the employee withdraws before the start date) is also recorded

#### Leave Calendar

HR and Branch Managers can view a calendar showing approved leave across the branch,
so they can assess staffing coverage before approving new requests.

---

### 4.3 Disciplinary Records

The disciplinary record is the most legally sensitive part of the HR module. Every action
must be timestamped, attributed to the person who took it, and permanently attached to
the employee's record. Records cannot be deleted — only superseded.

#### Disciplinary Process (Standard Kenyan Employment Law Alignment)

The standard progressive discipline model:

```
1. Verbal Warning      — informal, but recorded in the system
2. First Written Warning
3. Final Written Warning
4. Suspension (with or without pay)
5. Termination
```

Each step is a `DisciplinaryRecord` entry. Not every incident follows the full sequence —
gross misconduct can go directly to termination. The system supports any step at any time
but records what step was taken and why.

#### What Is Recorded Per Incident

- **Date of incident** — when it occurred
- **Date of action** — when the formal action was taken (can differ)
- **Incident category** — from a configurable list (e.g. Insubordination, Attendance, Misconduct, Performance, Policy Violation, Other)
- **Description** — detailed written account of what happened
- **Action taken** — the disciplinary step (Verbal Warning / Written Warning / Final Warning / Suspension / Termination)
- **Outcome** — what was agreed or decided
- **Issued by** — the manager or HR person who issued the action (linked to their user record)
- **Witnesses** — optional, free-text list
- **Attachments** — supporting documents (incident reports, CCTV references, written statements)
- **Employee acknowledgement** — whether the staff member acknowledged receipt of the formal notice (timestamped; delivered via Internal Comms inbox)
- **Right of appeal** — whether the employee appealed; outcome if so
- **Expiry date** — some warnings have a defined period after which they are no longer active (e.g. a verbal warning that expires after 6 months of clean record)

#### Key Design Intent

Disciplinary records are **append-only**. HR can add notes or attachments after the fact,
but the original record cannot be edited. This protects both the employer and the employee.

A staff member's active warnings affect their status. The system surfaces how many active
(non-expired) warnings a staff member currently has on their profile.

---

### 4.4 Document Storage

Every employee can have documents attached to their HR profile. Documents are tied to the
employee record and optionally to a specific leave request or disciplinary record.

#### Document Types

| Type | Example |
|---|---|
| Contract | Signed employment contract PDF |
| ID Copy | National ID scan |
| Certificate | Food handler's certificate, First Aid, etc. |
| Medical Certificate | For sick leave above threshold |
| Incident Report | Written statement for disciplinary file |
| Warning Letter | Issued formal warning document |
| Other | Any other HR-relevant file |

#### Rules

- File types: PDF, JPG, PNG (documents and image scans)
- Storage: Cloudinary (consistent with the existing image upload infrastructure)
- Access: HR Manager and Directors always; Branch Managers for their branch staff;
  Staff members can view their own documents but not upload or delete
- Documents cannot be deleted once attached to a disciplinary record or leave request
- General profile documents (e.g. ID copy) can be replaced but the old version is retained

---

### 4.5 HR Dashboard (Management View)

The HR manager and directors need a consolidated view of the organisation's HR state.

**What the dashboard surfaces:**

- Headcount by branch and role (active staff only)
- Staff currently on approved leave (today)
- Pending leave requests awaiting approval
- Staff on probation (approaching or past probation end date)
- Staff with active disciplinary warnings
- Upcoming contract end dates (for fixed-term staff)
- Recent HR activity feed (last 30 days — leave decisions, disciplinary actions)

---

## 5. What This Module Does Not Cover (V2 Scope Boundary)

- **Payroll processing** — the system stores compensation data as a reference, but does not
  calculate or process payroll. This is out of scope for V2.
- **Recruitment / applicant tracking** — managing job applicants before they are staff members
- **Performance appraisal scoring** — structured KPI-based reviews are not in V2; informal
  performance notes are stored under disciplinary records as a reference
- **Time and attendance integration** — clock-in/out data exists in Phase 5 (shifts module)
  but is not yet surfaced in HR reporting

---

## 6. Integration Points

| Integrates With | How |
|---|---|
| `users` table | `EmployeeProfile` has a one-to-one FK to `users.id` |
| Internal Comms module | Formal notices are delivered via the comms inbox; acknowledgements write back to the HR record |
| Shifts module (Phase 5) | Clock-in/out history is visible from the employee profile (read-only reference) |
| FCM Push | Leave approval/rejection triggers a push notification to the staff member |
| Cloudinary | Document uploads use the same upload infrastructure as menu item images |

---

## 7. Open Questions Before Implementation

1. **Leave accrual** — Does annual leave accrue monthly (e.g. 1.75 days/month for 21 days/year)
   or is the full balance granted at the start of the leave year?
2. **Leave year** — Does Wendo's leave year follow the calendar year (Jan–Dec) or the
   financial year or the employee's hire date anniversary?
3. **Kenyan statutory minimums** — Confirm exact statutory leave entitlements to be
   coded as defaults (Employment Act 2007: 21 days annual, varies for maternity/paternity).
4. **Who approves leave for branch managers themselves?** — Escalates to Director or HR Manager?
5. **Disciplinary appeal process** — Is there a formal internal appeal path or is this
   handled informally and just noted on the record?
