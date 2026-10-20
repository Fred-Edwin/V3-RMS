import { AppError, ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { payrollEntry } from '../payroll-audit';
import { assertState, payrollActor, requireMonth } from '../payroll-context';
import { buildBankFile, type BuiltBankFile } from './bank-build';
import { bankFileName } from './bank-format';
import { bankRepository } from './bank-repository';

/** At most this many downloads per person in this many minutes (a stuck button must not hammer the server). */
export const BANK_LIMIT = 12;
export const BANK_WINDOW_MINUTES = 10;

export const STALE_FILE_REASON = 'The payment details or a payslip changed after the file was downloaded.';

export interface BankFileState {
  state: 'NONE' | 'DOWNLOADED' | 'VOIDED';
  version: number | null;
  filename: string | null;
  hash: string | null;
  downloadedAt: string | null;
  downloadedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

/** What the pay-out card shows for the newest download, judged against the month as it is now (a moved hash means voided). */
export async function fileStateOf(month: Pick<MonthRow, 'id' | 'monthKey'>, built: BuiltBankFile): Promise<{ file: BankFileState; good: boolean }> {
  const latest = (await bankRepository.files(month.id))[0];
  if (!latest) return { file: { state: 'NONE', version: null, filename: null, hash: null, downloadedAt: null, downloadedBy: null, voidedAt: null, voidReason: null }, good: false };
  const names = await monthsRepository.userNames([latest.downloadedById]);
  const stale = latest.state === 'DOWNLOADED' && latest.hash !== built.hash;
  const state = latest.state === 'VOIDED' || stale ? 'VOIDED' : 'DOWNLOADED';
  return {
    good: state === 'DOWNLOADED',
    file: {
      state,
      version: latest.version,
      filename: latest.fileName,
      hash: latest.hash,
      downloadedAt: latest.downloadedAt.toISOString(),
      downloadedBy: names.get(latest.downloadedById)?.name ?? null,
      voidedAt: latest.voidedAt?.toISOString() ?? null,
      voidReason: latest.voidReason ?? (stale ? STALE_FILE_REASON : null),
    },
  };
}

/** S8: the pay-out card. HR, Director and System Admin read it without buttons; no account number is ever in this answer. */
export async function payoutView(subject: AccessSubject, monthKey: string) {
  const ctx = await payrollActor(subject, 'payroll.read');
  const month = await requireMonth(ctx.companyId, monthKey);
  if (month.state !== 'PUBLISHED' && month.state !== 'PAID') throw new ConflictError('Pay out opens once the payslips are published.', 'TAB_NOT_AVAILABLE', { state: month.state });
  const built = await buildBankFile(month);
  const { file, good } = await fileStateOf(month, built);
  const blockedBy = built.plan.cannotPay.length > 0 ? 'CANNOT_PAY' : !good && built.plan.people > 0 ? 'NO_FILE' : null;
  return {
    monthKey,
    state: month.state,
    locked: month.state === 'PAID',
    methods: [{ method: 'BANK', people: built.plan.people, amount: built.plan.total, file }],
    cannotPay: built.plan.cannotPay,
    nothingToPay: built.plan.nothingToPay,
    otherMethods: built.plan.otherMethods,
    canMarkPaid: month.state === 'PUBLISHED' && blockedBy === null,
    blockedBy,
    nextFilename: bankFileName(monthKey, file.state === 'DOWNLOADED' ? (file.version ?? 1) : (file.version ?? 0) + 1),
  };
}

export interface BankDownload {
  filename: string;
  text: string;
  version: number;
  hash: string;
  repeat: boolean;
}

/**
 * The Accountant downloads the bank file (S8). PUBLISHED: records the download (a row, an audit entry) and, when the payslips or the
 * payment details have moved since an earlier download, voids that one and numbers a new version. PAID: the file can still be taken
 * again, audited, with no row and no change (the month is locked). People with no bank account stop it: the card lists them first.
 */
export async function downloadBankFile(subject: AccessSubject, monthKey: string, body: { idempotencyKey: string }, now: Date = new Date()): Promise<BankDownload> {
  const ctx = await payrollActor(subject, 'payroll.pay');
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['PUBLISHED', 'PAID'], 'BANK_FILE_NOT_AVAILABLE', 'The bank file opens once the payslips are published');
  const built = await buildBankFile(month);
  if (built.plan.cannotPay.length > 0) throw new ConflictError(`${built.plan.cannotPay.length} ${built.plan.cannotPay.length === 1 ? 'person has' : 'people have'} no bank account. Fix that first.`, 'PEOPLE_CANNOT_BE_PAID', { cannotPay: built.plan.cannotPay });

  if (month.state === 'PAID') {
    const last = (await bankRepository.files(month.id))[0];
    const version = last?.version ?? 1;
    await runAudited<void>(async () => ({ result: undefined, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.bank_file_downloaded', category: 'PAY_RUN_DECIDE', monthId: month.id, after: { month: monthKey, version, again: true, people: built.plan.people, hash: built.hash } })] }));
    return { filename: bankFileName(monthKey, version), text: built.text, version, hash: built.hash, repeat: false };
  }

  const same = await bankRepository.byKey(month.id, subject.id, body.idempotencyKey);
  if (same) {
    if (same.hash !== built.hash) throw new ConflictError('The file changed since. Download it again.', 'BANK_FILE_CHANGED');
    return { filename: same.fileName, text: built.text, version: same.version, hash: same.hash, repeat: true };
  }
  const since = new Date(now.getTime() - BANK_WINDOW_MINUTES * 60_000);
  if ((await bankRepository.countSince(subject.id, since)) >= BANK_LIMIT) throw new AppError(429, 'BANK_FILE_RATE_LIMIT', 'Too many downloads just now. Wait a few minutes and try again.');

  return runAudited<BankDownload>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.state !== 'PUBLISHED') throw new ConflictError('The month changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    const active = await bankRepository.activeFile(month.id, tx);
    const reuse = active !== null && active.hash === built.hash;
    let voided = 0;
    if (active && !reuse) voided = await bankRepository.voidActive(tx, month.id, STALE_FILE_REASON, now);
    const version = reuse ? active.version : await bankRepository.nextVersion(tx, month.id);
    const filename = bankFileName(monthKey, version);
    await bankRepository.insertFile(tx, { monthId: month.id, version, formatId: built.formatId, fileName: filename, hash: built.hash, people: built.plan.people, total: built.plan.total, downloadedById: subject.id, downloadedAt: now, idempotencyKey: body.idempotencyKey });
    const common = { companyId: ctx.companyId, actor: ctx.auditActor, category: 'PAY_RUN_DECIDE' as const, monthId: month.id };
    // The entry names the file and its size; it carries the total because the audit about money may (E9), never an account number.
    const entries = [payrollEntry({ ...common, action: 'payroll.bank_file_downloaded', after: { month: monthKey, version, file: filename, people: built.plan.people, total: built.plan.total, hash: built.hash, again: reuse } })];
    if (voided > 0) entries.push(payrollEntry({ ...common, action: 'payroll.bank_file_voided', after: { month: monthKey, files: voided, because: 'the month changed after the download' } }));
    return { result: { filename, text: built.text, version, hash: built.hash, repeat: false }, entries };
  });
}
