import type { AppRole } from '@/types/auth';

/**
 * The Workforce part of the route gate (`route-access.ts` calls it). Returns the answer for any Workforce path (`/app/workforce/*` and
 * the person's own `/app/conduct/*`), and `null` for a path that is not Workforce so the caller carries on with its own rules.
 */
export const workforcePathAccess = (pathname: string, role: AppRole, isDepartmentHead: boolean): boolean | null => {
  const under = (prefix: string): boolean => pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (!under('/app/workforce') && !under('/app/conduct')) {
    return null;
  }

  // Workforce (Chapter 1 frame): the Home of the five desktop roles that have a Workforce menu. Floor staff get a Home link when Attendance
  // (slice 3) gives them a clock card; a later slice widens this for My time, My leave and My payslips. Each slice's own routes narrow or widen it here.
  // The person's own file (slice 1a): everyone with a login and a file opens it, floor staff included. The API shows only their own
  // record. The System Admin has no file (the account is not a person on the payroll), so the page answers "Not available".
  if (under('/app/workforce/my-file')) {
    return role !== 'SYSTEM_ADMIN';
  }

  // Organisation: the roles the access table gives `org.read` (HR, Branch Manager, Store Manager, Director). The table is the
  // authority (finding 57); the API gives the Accountant no organisation access at all.
  if (under('/app/workforce/organisation')) {
    return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'DIRECTOR';
  }

  // The Rota (slice 2): a department head plans their own team on a phone, so the Rota pages (the grid and its printed page) open for a
  // head as well as the five desktop roles. Shift templates stay with the desktop roles. The API decides what each person can do.
  if (under('/app/workforce/schedule/rota')) {
    return isDepartmentHead || role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR';
  }

  // People, batch 2B: a head's probation report and My team (read only). Heads, and the roles that already see their people.
  if (under('/app/workforce/team') || under('/app/workforce/probation')) {
    return isDepartmentHead || role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'DIRECTOR';
  }

  // Attendance (slice 3). The Today board is for the roles that read it (and a department head, for their own people); the per-site
  // switch is the System Admin's alone (owner, 18 Oct 2026). Both pages show nothing for a branch whose new clock is off.
  if (under('/app/workforce/today')) {
    return isDepartmentHead || role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'DIRECTOR';
  }
  if (pathname === '/app/workforce/attendance/switch') {
    return role === 'SYSTEM_ADMIN';
  }

  // Timesheets and Requests (slice 4a, Segment 1A): the roles that read timesheets (the managers, HR, the Director, the Accountant to read).
  // A department head does not (spec D7). The API decides what each can do; a branch whose new clock is off shows an empty page.
  if (under('/app/workforce/timesheets') || under('/app/workforce/requests')) {
    return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR';
  }

  // Rules (segment 1B): everyone who holds `rules.read` (the five desktop roles and the System Admin, who reads every tab). Heads and floor
  // staff have no link and the page answers 403. The API decides which rows each person can change.
  if (under('/app/workforce/rules')) {
    return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  // Payroll (segment 2): the roles that hold `payroll.read`. Branch and Store Managers see no pay. The API decides what each can do.
  if (under('/app/workforce/payroll')) {
    return role === 'HR_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  // Conduct (Segment 5). The desk (the list, the issue panel, the appeal screen) is for the roles that hold `discipline.read`: the Branch Manager,
  // the Store Manager, HR and the Director. The Accountant and a department head do not. The API decides what each can do and answers 404 for a
  // notice outside their reach.
  if (under('/app/workforce/conduct')) {
    return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'DIRECTOR';
  }
  // A person's own notices, the sign and appeal pages, and the witness card: everyone with a staff file (`discipline.read_own`), so every
  // role but the System Admin, who has no file.
  if (under('/app/conduct')) {
    return role !== 'SYSTEM_ADMIN';
  }

  // My time, My rota and My requests (slice 4a): everyone who clocks in, the floor staff and the Store Attendant included, and the desktop
  // roles' own time. The System Admin has no clock.
  if (under('/app/workforce/my-time')) {
    return role !== 'SYSTEM_ADMIN';
  }

  // My payslips (Segment 3): everyone who has a payslip. The System Admin has none (access table). The code is checked by the API.
  if (under('/app/workforce/my-payslips')) {
    return role !== 'SYSTEM_ADMIN';
  }

  // My leave (Segment 4): everyone who can ask for leave, floor staff and the desktop roles' own leave. The System Admin has none.
  if (under('/app/workforce/my-leave')) {
    return role !== 'SYSTEM_ADMIN';
  }

  // Leave (Segment 4): the people who decide or read it, with the rota in front of them. A department head is told by notice and sees Leave
  // on the rota, so has no page; the Accountant has none. The API's leave.read, leave.approve and leave.balance_adjust decide the rest.
  if (under('/app/workforce/leave')) {
    return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  // Casual pay (Segment 3): the head records, the Branch Manager and the Director approve; HR, the Accountant and the Store Manager read.
  // The API's casual.record / casual.approve / casual.read decide what each can do.
  if (under('/app/workforce/casuals')) {
    return isDepartmentHead || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'HR_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR';
  }

  // Security alerts (Segment 6a): the System Admin's alone; everyone else is bounced (the API answers 404 to them).
  if (under('/app/workforce/security')) {
    return role === 'SYSTEM_ADMIN';
  }

  // My phones (Segment 6a): everyone with a login lists, confirms and removes their own phones. The API shows only the person's own.
  // "This wasn't me" is the same person's own page.
  if (under('/app/workforce/my-phones') || under('/app/workforce/wasnt-me')) {
    return true;
  }

  // Activity on my record (Segment 6b): everyone with a login reads their own file's activity; the API shows only their own.
  if (under('/app/workforce/my-record')) {
    return true;
  }

  // The Audit log and its Signed documents tab (Segment 6b): the five desktop roles and the System Admin. What each may read, per category
  // and per document type, is the API's decision (a reader with nothing to read gets a 404 there).
  if (under('/app/workforce/audit-log')) {
    return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  // Notifications (Home's bell and "See all notifications"): every person reads their own; the API shows only theirs.
  if (under('/app/workforce/notifications')) {
    return true;
  }

  // Needs you, "See all": the people who hold the capability (the five desktop roles, and the System Admin for security alerts).
  if (under('/app/workforce/needs-you')) {
    return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  // The System Admin's Home: its one card is Needs you (open security alerts). The other desktop roles reach Home through the rule below.
  if (pathname === '/app/workforce' && role === 'SYSTEM_ADMIN') {
    return true;
  }

  // The Home of the floor staff and department heads: their clock card. The menu shows the link only on a branch with the new clock on;
  // a branch that is off has no clock card, so the page would only say that nothing needs them.
  if (pathname === '/app/workforce' && (isDepartmentHead || role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'STEWARD' || role === 'HOUSEKEEPING' || role === 'STORE_ATTENDANT')) {
    return true;
  }

  return role === 'HR_MANAGER' || role === 'MANAGER' || role === 'STORE_MANAGER' || role === 'ACCOUNTANT' || role === 'DIRECTOR';
};
