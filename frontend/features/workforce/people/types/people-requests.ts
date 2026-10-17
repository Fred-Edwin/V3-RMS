import type { DateString, ExitReason, FileRequestKind, HireLoginRole, MoneyString, PayChangeReason, PayoutMethod, ProbationVerdict } from './people-types';

/** Request bodies, one per write. They match the Zod schemas in `people-validators.ts`. */

export type HireEmployment = 'MONTHLY_WITH_CONTRACT' | 'MONTHLY_NO_CONTRACT_YET' | 'CASUAL';

export interface HireWho {
  name: string;
  phone: string;
  nationalId: string;
  email?: string;
  photoUrl?: string;
}
export interface HireJob {
  siteId: string;
  departmentId: string;
  positionId: string;
  reportsToId?: string | null;
  employment: HireEmployment;
  tracksTime?: boolean;
  startDate: DateString;
}
export interface HirePay {
  amount: MoneyString;
  overtimeEligible: boolean;
  standardWeekHours?: string;
  standardDayHours?: string;
}
export interface HireStatutory {
  kraPin?: string;
  nssfNumber?: string;
  shaNumber?: string;
  helbNumber?: string;
  payoutMethod: PayoutMethod;
  bankName?: string;
  bankBranch?: string;
  accountName?: string;
  accountNumber?: string;
  mpesaPhone?: string;
}
export interface HireLogin {
  email: string;
  loginRole: HireLoginRole;
  temporaryPassword: string;
}
export interface HireBody {
  draftId?: string;
  existingUserId?: string;
  who: HireWho;
  job: HireJob;
  pay?: HirePay;
  statutory?: HireStatutory;
  login?: HireLogin;
  confirmDuplicatePhone?: boolean;
}

export interface DraftBody {
  kind: 'MONTHLY' | 'CASUAL';
  step: number;
  payload: Record<string, unknown>;
}
export interface DraftRow extends DraftBody {
  id: string;
  updatedAt?: string;
}

/** Fields an edit may send; the server refuses with `FIELD_NOT_ALLOWED` any the caller may not change. */
export interface UpdateEmployeeBody {
  name?: string;
  positionId?: string;
  reportsToId?: string | null;
  tracksTime?: boolean;
  personalPhone?: string | null;
  personalEmail?: string | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  nationalId?: string | null;
  kraPin?: string | null;
  shaNumber?: string | null;
  nssfNumber?: string | null;
  helbNumber?: string | null;
  dateOfBirth?: DateString | null;
  physicalAddress?: string | null;
}
export type PatchMeBody = Omit<UpdateEmployeeBody, 'name' | 'positionId' | 'reportsToId' | 'tracksTime' | 'nationalId'>;

export interface PayProfileBody {
  payoutMethod?: PayoutMethod;
  bankName?: string | null;
  bankBranch?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  mpesaPhone?: string | null;
  overtimeEligible?: boolean;
  standardWeekHours?: string | null;
  standardDayHours?: string | null;
  reason?: string;
}
export interface PayChangeBody {
  amount: MoneyString;
  effectiveFrom: DateString;
  reason: PayChangeReason;
  note?: string;
}
export interface PayChangeDecisionBody {
  decision: 'APPROVE' | 'DECLINE';
  note?: string;
}
export interface ContractBody {
  contractTypeId?: string;
  startsOn: DateString;
  endsOn?: DateString;
}

export type ProbationDecisionBody =
  | { decision: 'CONFIRM' }
  | { decision: 'EXTEND'; months: number; reason: string }
  | { decision: 'END' };
export interface ProbationNoteBody {
  verdict: ProbationVerdict;
  note?: string;
}
export interface TransferBody {
  toSiteId: string;
  toDepartmentId: string;
  toPositionId?: string;
  toReportsToId?: string | null;
  startsOn: DateString;
}
export interface LoanBody {
  toSiteId: string;
  from: DateString;
  until: DateString | null;
}
export interface ExitBody {
  lastDay: DateString;
  reason: ExitReason;
  note?: string;
  uniformReturned?: boolean;
}
export interface RehireBody {
  startsOn: DateString;
  departmentId?: string;
  positionId?: string;
  reportsToId?: string | null;
}
export interface CreateLoginBody {
  email: string;
  loginRole: HireLoginRole;
  temporaryPassword: string;
}
export interface FileRequestBody {
  kind: FileRequestKind;
}
