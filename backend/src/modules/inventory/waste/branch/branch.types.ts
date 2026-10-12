import type { LogBranchWasteResult } from '../_shared/waste-contract';

export type {
  AllBranchesWasteQuery,
  BranchWasteDetail,
  BranchWasteEntry,
  BranchWasteItems,
  BranchWasteList,
  BranchWasteListQuery,
  LogBranchWasteInput,
  LogBranchWasteResult,
  MyBranchWasteList,
  MyBranchWasteQuery,
  ReverseBranchWasteInput,
} from '../_shared/waste-contract';

/** What the service hands the controller: the result, and whether it replays an earlier tap (HTTP 200 instead of 201). */
export type LogOutcome = { result: LogBranchWasteResult; replayed: boolean };

/** Who the caller is for a branch waste request. Decided by capability and the department rule, never by a role name. */
export type DepartmentCaller = {
  kind: 'DEPARTMENT';
  userId: string;
  /** The branch (`siteId`) of the department. */
  branchId: string;
  departmentId: string;
  departmentName: string;
};

/** How a caller may reverse: `ANY` (`branch_waste.reverse_any`), `OWN` (the department rule), or not at all. */
export type ReverseMode = 'ANY' | 'OWN' | 'NONE';
