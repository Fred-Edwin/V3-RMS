/**
 * Workforce People (slice 1a): the public API. Route shells import the screens from here; nothing deeper is imported from outside
 * this folder. Home cards import the data hooks. See README.md.
 */
export { useRoster, usePeopleSummary } from './_shared/hooks/use-people-data';
export { attentionRows, comingUpRows, onboardingCount, peopleByBranch, type AttentionRow, type BranchCountRow, type ComingUpRow } from './_shared/lib/home-people';
export { nairobiDay } from './_shared/lib/people-dates';
export { useOrgOverview } from './organisation/_shared/hooks/use-org-data';
export { gapRows } from './organisation/_shared/lib/org-home';
export { OrganisationScreen } from './organisation/overview/components/organisation-screen';
export { DepartmentScreen } from './organisation/departments/components/department-screen';
export { EmployeesScreen } from './employees/components/employees-screen';
export { FileScreen } from './file/components/file-screen';
export { HireScreen } from './hire/components/hire-screen';
export { MyFileScreen } from './mine/components/my-file-screen';
