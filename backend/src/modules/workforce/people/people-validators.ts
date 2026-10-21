import { z } from 'zod';
import {
  EXIT_REASONS,
  FILE_REQUEST_KINDS,
  HIRE_LOGIN_ROLES,
  HR_DOCUMENT_TYPES,
  PAY_CHANGE_REASONS,
  PROBATION_VERDICTS,
  REVEALABLE_FIELD_LIST,
} from './people.constants';
import { PAYOUT_CASH_REFUSAL, PAYOUT_METHODS, kraPinField, nssfField, payoutAllowed, shaField } from './statutory-formats';

const id = z.uuid();
const nairobiDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals');
const hours = z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, 'Use hours such as 48 or 7.5');
const text = (max: number) => z.string().trim().min(1).max(max);
const phone = z.string().trim().regex(/^[0-9 +()-]{7,20}$/, 'Not a phone number');
const email = z.email().max(254).transform((value) => value.toLowerCase());
const pin = z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'); // the signing PIN, checked in the request, never stored
const paging = { page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(20) };
const notEmpty = (value: object): boolean => Object.keys(value).length > 0;

// ---- params and queries -------------------------------------------------------------------
export const IdParamsSchema = z.object({ id });
export const MoveParamsSchema = z.object({ id, moveId: id });
export const DocumentParamsSchema = z.object({ id, docId: id });
export const ChangeParamsSchema = z.object({ changeId: id });
export const RequestParamsSchema = z.object({ id, requestId: id });

export const EMPLOYEE_FILTERS = ['all', 'needs_finishing', 'blocks_payroll', 'no_contract', 'casual_pool', 'on_probation', 'exited'] as const;
export const ListQuerySchema = z.object({
  siteId: id.optional(),
  departmentId: id.optional(),
  filter: z.enum(EMPLOYEE_FILTERS).default('all'),
  q: z.string().trim().max(80).optional(),
  ...paging,
});
export const SummaryQuerySchema = z.object({ siteId: id.optional() });
export const PageQuerySchema = z.object(paging);
export const DuplicateQuerySchema = z
  .object({ nationalId: text(20).optional(), phone: phone.optional(), email: email.optional() })
  .refine((v) => v.nationalId !== undefined || v.phone !== undefined || v.email !== undefined, 'Give at least one to check');
export const SignInSuggestQuerySchema = z.object({ name: z.string().trim().min(1).max(120) });
export const TemporaryPasswordBodySchema = z.strictObject({ employeeId: id.optional() });
export const PayChangesQuerySchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED']).default('PENDING') });

// ---- hire (the five steps; a casual has three) ---------------------------------------------
export const WhoSchema = z.object({
  name: text(120),
  phone,
  nationalId: text(20),
  email: email.optional(),
  photoUrl: z.url().optional(),
});
export const JobSchema = z.object({
  siteId: id,
  departmentId: id,
  positionId: id,
  reportsToId: id.nullable().optional(),
  employment: z.enum(['MONTHLY_WITH_CONTRACT', 'MONTHLY_NO_CONTRACT_YET', 'CASUAL']),
  tracksTime: z.boolean().optional(),
  startDate: nairobiDate,
});
export const PaySchema = z.object({
  amount: money, // monthly salary, or the daily rate for a casual
  overtimeEligible: z.boolean().default(false),
  standardWeekHours: hours.optional(),
  standardDayHours: hours.optional(),
});
export const StatutorySchema = z
  .object({
    kraPin: kraPinField.optional(),
    nssfNumber: nssfField.optional(),
    shaNumber: shaField.optional(),
    helbNumber: text(30).optional(),
    payoutMethod: z.enum(PAYOUT_METHODS),
    bankName: text(80).optional(),
    bankBranch: text(80).optional(),
    accountName: text(120).optional(),
    accountNumber: text(40).optional(),
    mpesaPhone: phone.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payoutMethod === 'BANK' && (!v.bankName || !v.accountNumber)) {
      ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'A bank payout needs the bank and the account number' });
    }
    if (v.payoutMethod === 'MPESA' && !v.mpesaPhone) {
      ctx.addIssue({ code: 'custom', path: ['mpesaPhone'], message: 'An M-Pesa payout needs the phone number' });
    }
  });
export const LoginSchema = z.object({
  email,
  loginRole: z.enum(HIRE_LOGIN_ROLES),
  temporaryPassword: z.string().min(10).max(72), // shown once to HR; never stored or logged
});
export const CreateLoginSchema = LoginSchema;

export const HireBodySchema = z
  .object({
    draftId: id.optional(),
    existingUserId: id.optional(),
    who: WhoSchema,
    job: JobSchema,
    pay: PaySchema.optional(),
    statutory: StatutorySchema.optional(),
    login: LoginSchema.optional(),
    confirmDuplicatePhone: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const casual = v.job.employment === 'CASUAL';
    if (casual && v.login) ctx.addIssue({ code: 'custom', path: ['login'], message: 'A casual has no login' });
    if (casual && v.statutory) ctx.addIssue({ code: 'custom', path: ['statutory'], message: 'A casual has no statutory or bank step' });
    if (v.statutory && !payoutAllowed(casual, v.statutory.payoutMethod)) {
      ctx.addIssue({ code: 'custom', path: ['statutory', 'payoutMethod'], message: PAYOUT_CASH_REFUSAL });
    }
    if (casual && v.existingUserId) ctx.addIssue({ code: 'custom', path: ['existingUserId'], message: 'A casual has no account' });
    if (v.existingUserId && v.login) ctx.addIssue({ code: 'custom', path: ['login'], message: 'The account already exists' });
  });

export const DraftBodySchema = z.object({
  kind: z.enum(['MONTHLY', 'CASUAL']),
  step: z.number().int().min(1).max(5),
  payload: z.record(z.string(), z.unknown()),
});

// ---- the file ------------------------------------------------------------------------------
export const UpdateEmployeeSchema = z
  .strictObject({
    name: text(120),
    positionId: id,
    reportsToId: id.nullable(),
    tracksTime: z.boolean(),
    personalPhone: phone.nullable(),
    personalEmail: email.nullable(),
    emergencyName: text(120).nullable(),
    emergencyRelation: text(60).nullable(),
    emergencyPhone: phone.nullable(),
    nationalId: text(20).nullable(),
    kraPin: kraPinField.nullable(),
    shaNumber: shaField.nullable(),
    nssfNumber: nssfField.nullable(),
    helbNumber: text(30).nullable(),
    dateOfBirth: nairobiDate.nullable(),
    physicalAddress: text(200).nullable(),
  })
  .partial()
  .refine(notEmpty, 'Nothing to change');

export const PatchMeSchema = z
  .strictObject({
    personalPhone: phone.nullable(),
    personalEmail: email.nullable(),
    physicalAddress: text(200).nullable(),
    emergencyName: text(120).nullable(),
    emergencyRelation: text(60).nullable(),
    emergencyPhone: phone.nullable(),
    nssfNumber: nssfField.nullable(),
    shaNumber: shaField.nullable(),
    helbNumber: text(30).nullable(),
    kraPin: kraPinField.nullable(),
    dateOfBirth: nairobiDate.nullable(),
    nationalId: text(20).nullable(),
    bankName: text(80).nullable(),
    accountNumber: text(40).nullable(),
  })
  .partial()
  .refine(notEmpty, 'Nothing to change');

export const RevealSchema = z.strictObject({ field: z.enum(REVEALABLE_FIELD_LIST) });
export const DocumentUploadSchema = z.strictObject({ documentType: z.enum(HR_DOCUMENT_TYPES) });
export const FileRequestSchema = z.strictObject({ kind: z.enum(FILE_REQUEST_KINDS) });

// ---- pay and contract ----------------------------------------------------------------------
export const PayProfileSchema = z
  .strictObject({
    payoutMethod: z.enum(PAYOUT_METHODS),
    bankName: text(80).nullable(),
    bankBranch: text(80).nullable(),
    accountName: text(120).nullable(),
    accountNumber: text(40).nullable(),
    mpesaPhone: phone.nullable(),
    overtimeEligible: z.boolean(),
    standardWeekHours: hours.nullable(),
    standardDayHours: hours.nullable(),
    reason: text(200), // required by the service when an existing bank account changes
  })
  .partial()
  .refine(notEmpty, 'Nothing to change');
export const PayChangeSchema = z.strictObject({
  amount: money,
  effectiveFrom: nairobiDate, // not in the past (the service checks against today)
  reason: z.enum(PAY_CHANGE_REASONS),
  note: text(300).optional(),
  pin,
});
export const PayChangeDecisionSchema = z
  .strictObject({ decision: z.enum(['APPROVE', 'DECLINE']), note: text(300).optional(), pin })
  .refine((v) => v.decision === 'APPROVE' || v.note !== undefined, { message: 'Say why it is declined', path: ['note'] });
export const ContractSchema = z
  .strictObject({ contractTypeId: id.optional(), startsOn: nairobiDate, endsOn: nairobiDate.optional() })
  .refine((v) => v.endsOn === undefined || v.endsOn >= v.startsOn, { message: 'The end cannot be before the start', path: ['endsOn'] });

// ---- probation, moves, exit ----------------------------------------------------------------
export const ProbationDecisionSchema = z.discriminatedUnion('decision', [
  z.strictObject({ decision: z.literal('CONFIRM') }),
  z.strictObject({ decision: z.literal('EXTEND'), months: z.number().int().min(1).max(12), reason: text(300) }),
  z.strictObject({ decision: z.literal('END') }),
]);
export const ProbationNoteSchema = z.strictObject({ verdict: z.enum(PROBATION_VERDICTS), note: text(500).optional() });
export const TransferSchema = z.strictObject({
  toSiteId: id,
  toDepartmentId: id,
  toPositionId: id.optional(),
  toReportsToId: id.nullable().optional(),
  startsOn: nairobiDate,
});
export const LoanSchema = z
  .strictObject({ toSiteId: id, from: nairobiDate, until: nairobiDate.nullable() })
  .refine((v) => v.until === null || v.until >= v.from, { message: 'Until cannot be before from', path: ['until'] });
export const ExitSchema = z.strictObject({
  lastDay: nairobiDate,
  reason: z.enum(EXIT_REASONS),
  note: text(500).optional(),
  uniformReturned: z.boolean().default(false),
});
export const ExitChecklistSchema = z.strictObject({ uniformReturned: z.boolean() });
export const RehireSchema = z.strictObject({
  startsOn: nairobiDate,
  departmentId: id.optional(),
  positionId: id.optional(),
  reportsToId: id.nullable().optional(),
});
