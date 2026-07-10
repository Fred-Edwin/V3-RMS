'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, RefreshCw } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  ExcelTable,
  PageHeader,
  PageLayout,
  Sheet,
  SkeletonTable,
  TourButton,
  useSheetEngine,
} from '@/components/ui';
import type { ExcelColumn, SheetRowIndicator, SheetUpdate } from '@/components/ui';
import { usePageTour } from '@/hooks/usePageTour';
import { PAYROLL_TOUR_PAGE_KEY, payrollTourSteps } from './payroll-tour';
import { PayslipDetailModal } from '@/components/payslips/PayslipDetailModal';
import { PayslipTable } from '@/components/payslips/PayslipTable';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { updateEmployeeProfile } from '@/services/hrService';
import { payslipService } from '@/services/payslipService';
import { staffService } from '@/services/staffService';
import { waiterLiabilityService } from '@/services/waiterLiabilityService';
import { useAuthStore } from '@/store/authStore';
import type { Payslip } from '@/types/payslip';
import type { WaiterLiabilitySummaryReport } from '@/types/waiterLiability';
import { formatCurrency, formatPayPeriod } from '@/components/payslips/payslip-utils';
import {
  buildBankFileCsv,
  csvFilenameSlug,
  downloadCsv,
  type PayrollExportRow,
} from '@/lib/payroll-csv';
import { buildPayrollRegisterWorkbook, downloadBlob } from '@/lib/payroll-xlsx';
import { buildStaffDetailPatch, formatSheetAccount } from '@/lib/payroll-staff-details';
import { CARRIED_FIELDS, isAllZeroSource, isBlankMoney, priorPeriod } from '@/lib/payroll-carry-forward';
import { cn } from '@/lib/cn';
import {
  EDITABLE_COLUMNS,
  EXCLUDED_ROLES,
  carryForwardRow,
  computeRow,
  computeTotals,
  currentPeriod,
  normalizeClipboardValue,
  payslipToRow,
  rowToUpsertPayload,
  sheetRoleRank,
  staffToRow,
  type EditableColumnKey,
  type RowState,
  type SheetRow,
} from './payroll-sheet';
import { buildPayrollGroups, type StaffDetailField } from './sheet-config';

type TabId = 'entry' | 'records' | 'stale';

type StaleWaiter = WaiterLiabilitySummaryReport['waiters'][number];

const money = (value: number): string => formatCurrency(value.toFixed(2));

/* ── Auto-save status indicator ─────────────────────────────────── */
function AutoSaveStatus({ dirty, saving, error }: { dirty: number; saving: number; error: number }) {
  if (error > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-danger-border bg-danger-bg px-3.5 py-1.5 text-label-sm font-medium text-danger">
        <span className="size-1.5 shrink-0 rounded-full bg-sheet-dot-error" />
        Auto-save failed — check connection
      </div>
    );
  }
  if (saving > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-label-sm font-medium text-blue-600">
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
        Saving…
      </div>
    );
  }
  if (dirty > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-label-sm font-medium text-amber-600">
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-sheet-dot-pending" />
        {dirty} row{dirty > 1 ? 's' : ''} pending save…
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-success-border bg-success-bg px-3.5 py-1.5 text-label-sm font-medium text-success">
      <span className="size-1.5 shrink-0 rounded-full bg-success" />
      All changes saved · Staff see updates on refresh
    </div>
  );
}

/* ── Small filter control (label over control) ──────────────────── */
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sheet-band font-bold uppercase text-stone-400">{label}</span>
      {children}
    </div>
  );
}

const filterControlClasses =
  'h-8 rounded-md border border-stone-300 bg-white px-2.5 font-sans text-label-md text-office-ink outline-none';

export default function HrPayslipsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const actorOrgId = useAuthStore((state) => state.organizationId);
  const actorRole = useAuthStore((state) => state.role);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('entry');
  const [activePeriod, setActivePeriod] = useState(currentPeriod);
  const [selectedBranchId, setSelectedBranchId] = useState(actorOrgId ?? '');
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [records, setRecords] = useState<Payslip[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [recordPeriod, setRecordPeriod] = useState('');
  const [recordBranchId, setRecordBranchId] = useState('');
  const [recordStatus, setRecordStatus] = useState('');
  const [recordStaffId, setRecordStaffId] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Stale-Order Deductions tab — per-waiter liability rollup (read-only; HR keys the
  // amount into the N.C.N.S/Deductions column on the Payroll Entry tab manually).
  const [staleSummary, setStaleSummary] = useState<WaiterLiabilitySummaryReport | null>(null);
  const [isLoadingStale, setIsLoadingStale] = useState(false);
  const [expandedWaiterId, setExpandedWaiterId] = useState<string | null>(null);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const rowsRef = useRef<SheetRow[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Staff-detail (KRA PIN / bank) edits persist to the employee profile via a
  // separate path from the money-field auto-save (which upserts payslips). Keyed
  // by userId so a save dot can show per row independent of the payslip state.
  const staffDetailTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [staffDetailState, setStaffDetailState] = useState<Record<string, RowState>>({});

  useEffect(() => {
    if (!accessToken) return;
    branchService.listBranches(accessToken)
      .then((loaded) => {
        // Sort A–Z so the branch dropdown, the all-branches sheet, and the CSV
        // exports all present branches in the same alphabetical order.
        const active = loaded
          .filter((b) => b.isActive && !b.isHub)
          .sort((a, b) => a.name.localeCompare(b.name));
        setBranches(active);
        // Auto-select first branch if no branch is pre-selected (avoids empty sheet on load)
        setSelectedBranchId((prev) => {
          if (prev) return prev;
          return active[0]?.id ?? '';
        });
      })
      .catch(() => { /* non-critical */ });
  }, [accessToken]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: 'All branches' },
      ...branches.map((b) => ({ value: b.id, label: b.name })),
    ],
    [branches],
  );

  const selectedBranchName = useMemo(
    () => branches.find((b) => b.id === selectedBranchId)?.name ?? 'All branches',
    [branches, selectedBranchId],
  );

  // All-branches is a consolidated, read-only view: editing and publishing are
  // per-branch, so here the sheet is for review + CSV export only.
  const isAllBranches = !selectedBranchId;
  // Cells are non-editable when a period is published OR in the all-branches view.
  const editLocked = isPublished || isAllBranches;

  // Build sheet rows for a single branch from its staff + payslips.
  //
  // `priorPayslips` (optional) holds the most recent prior period's payslips for
  // this branch. When a staff member has NO payslip in the current period but
  // DOES have one in the prior period, the recurring figures carry forward as an
  // editable draft (see carryForwardRow) so HR only edits what changed.
  const buildBranchRows = useCallback((
    branchName: string,
    staffResult: Awaited<ReturnType<typeof staffService.listStaff>>,
    payslips: Payslip[],
    priorPayslips: Payslip[] = [],
  ): SheetRow[] => {
    const eligible = staffResult
      .filter((s) => !EXCLUDED_ROLES.has(s.role))
      .sort((a, b) => {
        const ra = sheetRoleRank(a.role);
        const rb = sheetRoleRank(b.role);
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
    const payslipMap = new Map(payslips.map((p) => [p.userId, p]));
    const priorMap = new Map(priorPayslips.map((p) => [p.userId, p]));

    return eligible.map((staff) => {
      const base = staffToRow(staff, branchName);
      const existing = payslipMap.get(staff.id);
      if (existing) {
        const ep = existing.user.employeeProfile;
        base.kraPIN = ep?.kraPIN ?? null;
        base.bankAccount = formatSheetAccount(ep?.accountNumber, ep?.bankName);
        base.bankName = ep?.bankName ?? null;
        base.accountNumber = ep?.accountNumber ?? null;
        Object.assign(base, payslipToRow(existing));
        return base;
      }

      // No current-period payslip — carry forward from the prior period if we
      // have one for this staff member. Staff details (KRA PIN/bank) come from
      // the live employee profile, not the old payslip.
      const prior = priorMap.get(staff.id);
      if (prior) {
        const ep = prior.user.employeeProfile;
        base.kraPIN = ep?.kraPIN ?? null;
        base.bankAccount = formatSheetAccount(ep?.accountNumber, ep?.bankName);
        base.bankName = ep?.bankName ?? null;
        base.accountNumber = ep?.accountNumber ?? null;
        Object.assign(base, carryForwardRow(prior));
      }
      return base;
    });
  }, []);

  // Find the most recent prior period (looking back up to `MAX_CARRY_LOOKBACK`
  // months) that has any saved payslips for this branch, and return them. Used
  // to seed a fresh period via carry-forward. Returns [] if nothing is found —
  // e.g. a branch's very first payroll run.
  //
  // A period is only usable as a carry-forward source if at least one payslip
  // in it has real (non-zero) figures. A period that was published all-zero
  // and then reverted still has its payslip rows in the DB (revert only flips
  // isLocked back to false — it never clears the amounts), so without this
  // check that zeroed period would be "found" and either block the copy
  // entirely (every field looks already-filled) or silently copy zeros.
  const MAX_CARRY_LOOKBACK = 3;
  const fetchPriorPayslips = useCallback(
    async (orgId: string, fromPeriod: string): Promise<Payslip[]> => {
      if (!accessToken) return [];
      for (let back = 1; back <= MAX_CARRY_LOOKBACK; back += 1) {
        const period = priorPeriod(fromPeriod, back);
        const result = await payslipService.listHrPayslips(accessToken, {
          payPeriod: period,
          organizationId: orgId,
          page: 1,
          perPage: 200,
        });
        const usable = result.items.filter((p) => !isAllZeroSource(p));
        if (usable.length > 0) return usable;
      }
      return [];
    },
    [accessToken],
  );

  const loadSheet = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingSheet(true);
    try {
      // All-branches mode: no branch selected. Fan out across every active branch
      // and concatenate into one consolidated, read-only sheet (editing/publish are
      // per-branch, so the combined view is view + export only).
      if (!selectedBranchId) {
        if (branches.length === 0) { setIsLoadingSheet(false); return; }

        const perBranch = await Promise.all(
          branches.map(async (branch) => {
            const [staffResult, payslipResult] = await Promise.all([
              staffService.listStaff(accessToken, { organizationId: branch.id, isActive: true }),
              payslipService.listHrPayslips(accessToken, { payPeriod: activePeriod, organizationId: branch.id, page: 1, perPage: 200 }),
            ]);
            return buildBranchRows(branch.name, staffResult, payslipResult.items);
          }),
        );

        // Preserve branch order (branches[]), and within a branch the role/name sort.
        const sheetRows = perBranch.flat();
        setIsPublished(false);
        setRows(sheetRows);
        return;
      }

      const orgId = selectedBranchId;

      const branchName = branches.find((b) => b.id === orgId)?.name ?? '';
      const [staffResult, payslipResult] = await Promise.all([
        staffService.listStaff(accessToken, { organizationId: orgId, isActive: true }),
        // Scope to the selected branch so isPublished reflects THIS branch only.
        // Without organizationId this returns payslips across all branches, so a draft
        // in any other branch would make a locked branch look editable (and edits to
        // its locked rows would be silently skipped server-side).
        payslipService.listHrPayslips(accessToken, { payPeriod: activePeriod, organizationId: orgId, page: 1, perPage: 200 }),
      ]);

      // Fresh period (no payslips saved yet) → carry forward the most recent
      // prior period so HR only edits what changed. A period that already has
      // data is left exactly as saved (no auto carry-forward over real figures).
      const priorPayslips = payslipResult.items.length === 0
        ? await fetchPriorPayslips(orgId, activePeriod)
        : [];

      const sheetRows = buildBranchRows(branchName, staffResult, payslipResult.items, priorPayslips);
      const allPublished = payslipResult.items.length > 0 && payslipResult.items.every((p) => p.isLocked);
      setIsPublished(allPublished);
      setRows(sheetRows);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load payroll sheet', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoadingSheet(false);
    }
  }, [accessToken, activePeriod, selectedBranchId, branches, buildBranchRows, fetchPriorPayslips, toast]);

  useEffect(() => {
    void loadSheet();
  }, [loadSheet]);

  const autoSaveRow = useCallback(async (userId: string) => {
    if (!accessToken) return;
    const orgId = selectedBranchId || actorOrgId;
    if (!orgId) return;

    const row = rowsRef.current.find((r) => r.userId === userId);
    if (!row || row.state === 'saved') return;

    setRows((prev) => prev.map((r) => r.userId === userId ? { ...r, state: 'saving' } : r));

    try {
      const result = await payslipService.bulkUpsert(
        {
          payPeriod: activePeriod,
          organizationId: orgId,
          rows: [rowToUpsertPayload(row, activePeriod)],
        },
        accessToken,
      );

      // A 200 response does NOT guarantee the row persisted: the backend skips rows
      // whose payslip is already locked (published). Treat a skipped row as an error
      // instead of a false "saved" — otherwise the edit is silently lost on refresh.
      if (result.skipped.includes(userId)) {
        setRows((prev) =>
          prev.map((r) =>
            r.userId === userId
              ? { ...r, state: 'error', errorMsg: 'Period is published — revert to draft before editing this row.' }
              : r,
          ),
        );
        return;
      }

      setRows((prev) => prev.map((r) => r.userId === userId ? { ...r, state: 'saved' } : r));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Auto-save failed';
      setRows((prev) =>
        prev.map((r) => r.userId === userId ? { ...r, state: 'error', errorMsg: msg } : r),
      );
    }
  }, [accessToken, activePeriod, actorOrgId, selectedBranchId]);

  const scheduleAutoSave = useCallback((userId: string) => {
    if (debounceTimers.current[userId]) clearTimeout(debounceTimers.current[userId]);
    debounceTimers.current[userId] = setTimeout(() => { void autoSaveRow(userId); }, 1500);
  }, [autoSaveRow]);

  // Persist every row that isn't already saved — carried-over drafts (never
  // touched, so `idle`) and in-flight edits alike — in one bulkUpsert. Used
  // before publishing so unchanged, carried-forward staff are not published as
  // blank/absent. Returns true on success. Rows the server skips (already
  // locked) are marked as errors and reported.
  const flushPendingRows = useCallback(async (): Promise<boolean> => {
    if (!accessToken) return true;
    const orgId = selectedBranchId || actorOrgId;
    if (!orgId) return false;

    const pending = rowsRef.current.filter((r) => r.state !== 'saved');
    if (pending.length === 0) return true;

    setRows((prev) => prev.map((r) => (r.state !== 'saved' ? { ...r, state: 'saving' } : r)));
    try {
      const result = await payslipService.bulkUpsert(
        {
          payPeriod: activePeriod,
          organizationId: orgId,
          rows: pending.map((r) => rowToUpsertPayload(r, activePeriod)),
        },
        accessToken,
      );
      const skipped = new Set(result.skipped);
      setRows((prev) =>
        prev.map((r) => {
          if (r.state === 'saved') return r;
          if (skipped.has(r.userId)) {
            return { ...r, state: 'error', errorMsg: 'Period is published — revert to draft before editing this row.' };
          }
          return { ...r, state: 'saved', carriedOver: false };
        }),
      );
      return skipped.size === 0;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Save failed';
      setRows((prev) => prev.map((r) => (r.state === 'saving' ? { ...r, state: 'error', errorMsg: msg } : r)));
      return false;
    }
  }, [accessToken, activePeriod, actorOrgId, selectedBranchId]);

  const updateRowsBatch = useCallback((updates: SheetUpdate<EditableColumnKey>[]) => {
    const affectedUserIds = new Set<string>();

    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      updates.forEach((update) => {
        const row = next[update.rowIndex];
        if (!row) return;
        row[update.columnKey] = update.value;
        row.state = 'dirty';
        row.errorMsg = '';
        row.carriedOver = false;
        affectedUserIds.add(row.userId);
      });
      return next;
    });

    affectedUserIds.forEach(scheduleAutoSave);
  }, [scheduleAutoSave]);

  const updateRow = (userId: string, field: EditableColumnKey, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.userId === userId ? { ...row, [field]: value, state: 'dirty' as RowState, errorMsg: '', carriedOver: false } : row,
      ),
    );
    scheduleAutoSave(userId);
  };

  /* ── Excel-grid engine (selection, copy/paste, drag-fill, keyboard) ─ */
  const engine = useSheetEngine<EditableColumnKey>({
    columnKeys: EDITABLE_COLUMNS,
    rowCount: rows.length,
    locked: editLocked,
    getValue: (rowIndex, columnKey) => rowsRef.current[rowIndex]?.[columnKey] ?? '',
    onBatchUpdate: updateRowsBatch,
    normalizePasteValue: normalizeClipboardValue,
  });

  /* ── Staff payment details (KRA PIN / bank) ───────────────────────── */
  // These are employee-profile attributes, not period figures, so they persist
  // to PATCH /hr/profiles/:userId (HR_MANAGER/DIRECTOR-gated) — independent of
  // the payslip money auto-save and always editable, even for published periods.

  // Persist all three staff-detail fields together on each debounced flush, so a
  // quick edit of one field can never drop an unsaved edit of another on the same row.
  const saveStaffDetail = useCallback(async (userId: string) => {
    if (!accessToken) return;
    const row = rowsRef.current.find((r) => r.userId === userId);
    if (!row) return;

    setStaffDetailState((prev) => ({ ...prev, [userId]: 'saving' }));
    try {
      await updateEmployeeProfile(userId, buildStaffDetailPatch(row), accessToken);
      // Keep the derived bankAccount display string in sync with its parts.
      setRows((prev) =>
        prev.map((r) =>
          r.userId === userId
            ? { ...r, bankAccount: formatSheetAccount(r.accountNumber, r.bankName) }
            : r,
        ),
      );
      setStaffDetailState((prev) => ({ ...prev, [userId]: 'saved' }));
    } catch (error) {
      setStaffDetailState((prev) => ({ ...prev, [userId]: 'error' }));
      toast({
        variant: 'error',
        title: 'Could not save staff detail',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }, [accessToken, toast]);

  const updateStaffDetail = (userId: string, field: StaffDetailField, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.userId === userId ? { ...row, [field]: value } : row)),
    );
    setStaffDetailState((prev) => ({ ...prev, [userId]: 'dirty' }));
    if (staffDetailTimers.current[userId]) clearTimeout(staffDetailTimers.current[userId]);
    staffDetailTimers.current[userId] = setTimeout(() => { void saveStaffDetail(userId); }, 1500);
  };

  // Save immediately on blur (cancel the pending debounce), but only if there is
  // an unsaved edit — avoids a redundant PATCH when tabbing through unchanged cells.
  const flushStaffDetail = (userId: string) => {
    if (staffDetailState[userId] !== 'dirty') return;
    if (staffDetailTimers.current[userId]) clearTimeout(staffDetailTimers.current[userId]);
    void saveStaffDetail(userId);
  };

  const [isCopying, setIsCopying] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);

  // Manually re-pull the previous period's recurring figures over the current
  // sheet, even when this period already has data. Only fills EMPTY money cells
  // per row and never overwrites a figure HR has already entered; the resulting
  // rows are carried-over drafts that still need saving.
  const copyFromPreviousMonth = useCallback(async () => {
    if (!accessToken || isAllBranches) return;
    const orgId = selectedBranchId || actorOrgId;
    if (!orgId) return;

    setIsCopying(true);
    try {
      const prior = await fetchPriorPayslips(orgId, activePeriod);
      if (prior.length === 0) {
        toast({ variant: 'info', title: 'Nothing to copy', message: 'No earlier payroll was found for this branch.' });
        return;
      }
      const priorMap = new Map(prior.map((p) => [p.userId, p]));

      // Compute, per row, which blank recurring cells the prior period can fill.
      // Derive from the current rows snapshot (rowsRef) so the count and the
      // scheduled saves are computed exactly once, outside the setRows updater.
      const patches = new Map<string, Partial<SheetRow>>();
      for (const row of rowsRef.current) {
        const source = priorMap.get(row.userId);
        if (!source) continue;
        const carried = carryForwardRow(source);
        const patch: Partial<SheetRow> = {};
        for (const field of CARRIED_FIELDS) {
          // Only fill blank recurring cells — never clobber a value HR already
          // typed. "Blank" includes stale zero figures (e.g. left over from a
          // publish → revert cycle), not just the empty string — otherwise a
          // 0.00 cell reads as "already filled" and copy silently no-ops.
          if (isBlankMoney(row[field]) && !isBlankMoney(carried[field])) {
            patch[field] = carried[field] as string;
          }
        }
        if (Object.keys(patch).length > 0) patches.set(row.userId, patch);
      }

      if (patches.size > 0) {
        setRows((prev) =>
          prev.map((row) => {
            const patch = patches.get(row.userId);
            return patch ? { ...row, ...patch, state: 'dirty', carriedOver: true, errorMsg: '' } : row;
          }),
        );
        // Persist the freshly-filled rows through the normal debounced auto-save.
        patches.forEach((_patch, userId) => scheduleAutoSave(userId));
      }
      const filled = patches.size;
      toast({
        variant: filled > 0 ? 'success' : 'info',
        title: filled > 0 ? 'Copied from previous month' : 'Nothing to fill',
        message: filled > 0
          ? `${filled} row${filled > 1 ? 's' : ''} pre-filled. Review and save.`
          : 'Every row already has figures — no blank cells to fill.',
      });
    } catch (error) {
      toast({ variant: 'error', title: 'Copy failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsCopying(false);
      setShowCopyConfirm(false);
    }
  }, [accessToken, isAllBranches, selectedBranchId, actorOrgId, activePeriod, fetchPriorPayslips, scheduleAutoSave, toast]);

  const handlePublish = async () => {
    if (!accessToken) return;
    const orgId = selectedBranchId || actorOrgId;
    if (!orgId) return;
    setIsPublishing(true);
    try {
      // Persist any pending rows first — carried-forward drafts included — so
      // publishing never locks in blank payslips for unchanged staff.
      const flushed = await flushPendingRows();
      if (!flushed) {
        toast({
          variant: 'error',
          title: 'Cannot publish yet',
          message: 'Some rows could not be saved. Resolve the flagged rows, then publish again.',
        });
        return;
      }
      await payslipService.publishPeriod({ payPeriod: activePeriod, organizationId: orgId }, accessToken);
      setIsPublished(true);
      setRows((prev) => prev.map((r) => ({ ...r, state: 'saved' as RowState })));
      toast({ variant: 'success', title: 'Payroll published', message: `${formatPayPeriod(activePeriod)} is now finalised. Staff can view and print their payslips.` });
    } catch (error) {
      toast({ variant: 'error', title: 'Publish failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsPublishing(false);
      setShowPublishConfirm(false);
    }
  };

  const handleRevert = async () => {
    if (!accessToken) return;
    const orgId = selectedBranchId || actorOrgId;
    if (!orgId) return;
    setIsPublishing(true);
    try {
      await payslipService.revertPeriod({ payPeriod: activePeriod, organizationId: orgId }, accessToken);
      setIsPublished(false);
      toast({ variant: 'success', title: 'Reverted to draft', message: `${formatPayPeriod(activePeriod)} is back in draft. You can now edit payroll figures.` });
    } catch (error) {
      toast({ variant: 'error', title: 'Revert failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsPublishing(false);
      setShowRevertConfirm(false);
    }
  };

  const loadRecords = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingRecords(true);
    try {
      const result = recordBranchId
        ? await payslipService.listBranchPayslips(recordBranchId, accessToken, {
            payPeriod: recordPeriod || undefined, page: 1, perPage: 50,
          })
        : await payslipService.listHrPayslips(accessToken, {
            payPeriod: recordPeriod || undefined,
            isLocked: recordStatus === '' ? undefined : recordStatus === 'PUBLISHED',
            page: 1,
            perPage: 50,
          });
      setRecords(result.items);
    } catch {
      toast({ variant: 'error', title: 'Failed to load records', message: 'Please try again.' });
    } finally {
      setIsLoadingRecords(false);
    }
  }, [accessToken, recordBranchId, recordPeriod, recordStatus, toast]);

  useEffect(() => {
    if (activeTab === 'records') void loadRecords();
  }, [activeTab, loadRecords]);

  const loadStaleSummary = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingStale(true);
    try {
      // selectedBranchId empty = all active branches (cross-branch roles).
      const result = await waiterLiabilityService.getWaiterSummary(accessToken, selectedBranchId || undefined);
      setStaleSummary(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load stale-order deductions', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoadingStale(false);
    }
  }, [accessToken, selectedBranchId, toast]);

  useEffect(() => {
    if (activeTab === 'stale') void loadStaleSummary();
  }, [activeTab, loadStaleSummary]);

  const totals = useMemo(() => computeTotals(rows), [rows]);

  const statusCounts = useMemo(() => ({
    saved: rows.filter((r) => r.state === 'saved').length,
    dirty: rows.filter((r) => r.state === 'dirty').length,
    saving: rows.filter((r) => r.state === 'saving').length,
    error: rows.filter((r) => r.state === 'error').length,
    // Carried-over rows still awaiting review (untouched drafts from a prior month).
    carried: rows.filter((r) => r.carriedOver && r.state === 'idle').length,
  }), [rows]);

  /* ── CSV exports ─────────────────────────────────────────────────── */
  const toExportRows = useCallback((): PayrollExportRow[] =>
    rows.map((r) => {
      const { totalDeductions, netSalary } = computeRow(r);
      const num = (v: string) => Number(v || 0);
      return {
        branchName: r.branchName || selectedBranchName,
        name: r.name,
        role: r.role,
        kraPIN: r.kraPIN,
        bankName: r.bankName,
        accountNumber: r.accountNumber,
        grossPay: num(r.grossPay),
        paye: num(r.paye),
        sha: num(r.sha),
        nssfTier1: num(r.nssfTier1),
        nssfTier2: num(r.nssfTier2),
        housingLevy: num(r.housingLevy),
        ncnsAmount: num(r.ncnsAmount),
        ncnsNote: r.ncnsNote,
        advance: num(r.advance),
        incentives: num(r.incentives),
        overtime: num(r.overtime),
        allowances: num(r.allowances),
        totalDeductions,
        netSalary,
      };
    }), [rows, selectedBranchName]);

  const exportSlug = useCallback(() => {
    const period = csvFilenameSlug(formatPayPeriod(activePeriod));
    const scope = isAllBranches ? 'All-Branches' : csvFilenameSlug(selectedBranchName);
    return `${scope}-${period}`;
  }, [activePeriod, isAllBranches, selectedBranchName]);

  const handleExportBankFile = useCallback(() => {
    if (rows.length === 0) return;
    const { csv, excluded, includedCount } = buildBankFileCsv(toExportRows());
    if (!csv) {
      toast({ variant: 'error', title: 'Nothing to export', message: 'No staff have a bank account and a payable net salary for this period.' });
      return;
    }
    downloadCsv(`Wendo-Bank-Payment-${exportSlug()}.csv`, csv);
    if (excluded.length > 0) {
      toast({
        variant: 'success',
        title: `Bank file exported · ${includedCount} staff`,
        message: `${excluded.length} excluded (no bank account or zero net): ${excluded.slice(0, 5).join(', ')}${excluded.length > 5 ? '…' : ''}`,
      });
    } else {
      toast({ variant: 'success', title: 'Bank file exported', message: `${includedCount} staff included.` });
    }
  }, [rows.length, toExportRows, exportSlug, toast]);

  const handleExportRegister = useCallback(async () => {
    if (rows.length === 0) return;
    const generated = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Nairobi' }).format(new Date());
    const scopeLabel = isAllBranches ? 'All Branches' : selectedBranchName;
    try {
      const blob = await buildPayrollRegisterWorkbook(toExportRows(), formatPayPeriod(activePeriod), generated, scopeLabel);
      downloadBlob(`Wendo-Payroll-Register-${exportSlug()}.xlsx`, blob);
      toast({ variant: 'success', title: 'Payroll register exported', message: `${rows.length} staff across ${isAllBranches ? 'all branches' : selectedBranchName}.` });
    } catch {
      toast({ variant: 'error', title: 'Export failed', message: 'Could not build the Excel workbook. Please try again.' });
    }
  }, [rows.length, toExportRows, exportSlug, activePeriod, isAllBranches, selectedBranchName, toast]);

  // Guided tour for the Payroll Entry tab. The page is HR_MANAGER/DIRECTOR-scoped,
  // but gate explicitly so no tour UI/auto-start leaks to other roles. Only enable
  // once the entry tab's sheet has finished loading, so the anchored controls are
  // in the DOM before driver.js measures them.
  const canTour = actorRole === 'DIRECTOR' || actorRole === 'HR_MANAGER';
  const { startTour } = usePageTour({
    pageKey: PAYROLL_TOUR_PAGE_KEY,
    steps: payrollTourSteps,
    enabled: canTour && activeTab === 'entry' && !isLoadingSheet,
  });

  /* ── Sheet column groups (styling lives in the config + primitives) ─ */
  const groups = buildPayrollGroups({
    engine,
    // Branch + period in the title band so context survives fullscreen mode.
    periodLabel: `${isAllBranches ? 'ALL BRANCHES' : selectedBranchName.toUpperCase()} — ${formatPayPeriod(activePeriod).toUpperCase()}`,
    isAllBranches,
    totals,
    staffDetailState,
    onMoneyChange: updateRow,
    onStaffDetailChange: updateStaffDetail,
    onStaffDetailBlur: flushStaffDetail,
  });

  const rowIndicator = (row: SheetRow): SheetRowIndicator | null => {
    if (row.state === 'dirty' || row.state === 'saving') return { tone: 'pending' };
    if (row.state === 'error') return { tone: 'error', title: row.errorMsg };
    if (row.carriedOver && row.state === 'idle') {
      return { tone: 'info', title: 'Carried over from previous month — review and save' };
    }
    return null;
  };

  // Entry-tab controls — rendered in the normal controls row AND in the
  // sheet's fullscreen action bar, so period/branch/exports/publish stay
  // reachable while the sheet covers the page.
  const entryControls = (
    <>
      <FilterField label="Pay Period">
        <input
          data-tour="pay-period"
          type="month"
          value={activePeriod}
          onChange={(e) => e.target.value && setActivePeriod(e.target.value)}
          className={cn(filterControlClasses, 'min-w-[150px]')}
        />
      </FilterField>
      <FilterField label="Branch">
        <select
          data-tour="branch"
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className={cn(filterControlClasses, 'min-w-[140px] cursor-pointer')}
        >
          {branchOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FilterField>

      <div className="h-8 w-px shrink-0 bg-stone-200" />

      <AutoSaveStatus
        dirty={statusCounts.dirty}
        saving={statusCounts.saving}
        error={statusCounts.error}
      />

      <div className="ml-auto flex items-center gap-2">
        {/* CSV exports — available in any branch scope, incl. all-branches */}
        <Button
          data-tour="export-bank"
          variant="secondary"
          size="sm"
          leftIcon={<Download size={13} />}
          onClick={handleExportBankFile}
          disabled={rows.length === 0}
          title="Strict CSV for the bank, grouped by branch (net pay per employee)"
          className="h-8 border-sheet-band-green text-sheet-band-green hover:bg-sheet-tint-green-soft"
        >
          Bank File
        </Button>
        <Button
          data-tour="export-register"
          variant="secondary"
          size="sm"
          leftIcon={<Download size={13} />}
          onClick={() => void handleExportRegister()}
          disabled={rows.length === 0}
          title="Full payroll register as a formatted Excel workbook — all columns, branch subtotals & grand total"
          className="h-8 border-stone-300 text-stone-600 hover:bg-stone-100"
        >
          Full Register (Excel)
        </Button>

        {/* Copy from previous month — fills blank recurring cells from the
            most recent prior period. Per-branch, editable periods only. */}
        {!isAllBranches && !isPublished && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={13} />}
            onClick={() => setShowCopyConfirm(true)}
            disabled={isCopying || rows.length === 0}
            title="Fill blank Gross/PAYE/SHA/NSSF/Housing Levy/Allowance cells from the most recent prior month"
            className="h-8 border-stone-300 text-stone-600 hover:bg-stone-100"
          >
            {isCopying ? 'Copying…' : 'Copy from previous month'}
          </Button>
        )}

        {/* Publish/Revert are per-branch only — hidden in the consolidated all-branches view */}
        {isAllBranches ? (
          <span className="inline-flex h-8 items-center gap-1.5 pl-1.5 text-caption italic text-stone-400">
            View &amp; export only · pick a branch to edit or publish
          </span>
        ) : isPublished ? (
          <Button
            data-tour="publish"
            variant="destructive"
            size="sm"
            onClick={() => setShowRevertConfirm(true)}
            disabled={isPublishing}
            className="h-8"
          >
            ↩ Revert to Draft
          </Button>
        ) : (
          <Button
            data-tour="publish"
            variant="primary"
            size="sm"
            leftIcon={<Check size={13} />}
            onClick={() => setShowPublishConfirm(true)}
            disabled={isPublishing || rows.length === 0}
            className="h-8"
          >
            Publish Payroll
          </Button>
        )}
      </div>
    </>
  );

  return (
    <PageLayout className="animate-fade-up !mx-0 flex !max-w-none flex-col !px-0 !py-0 [height:calc(100vh-56px)] bg-crema">
      {/* Page header */}
      <div className="px-6 pb-3 pt-5">
        <PageHeader
          title="Payroll"
          subtitle="Enter and manage staff payroll per pay period. Staff see figures as drafts in real time."
          className="mb-0 border-b-0 pb-0"
          titleClassName="text-heading-md font-bold text-office-ink"
          action={canTour ? <TourButton onClick={startTour} className="flex-shrink-0" /> : undefined}
        />
      </div>

      {/* Main tabs (underline style) */}
      <div data-tour="tabs" className="flex flex-shrink-0 border-b border-stone-200 px-6">
        {([['entry', 'Payroll Entry'], ['records', 'Payslip Records'], ['stale', 'Stale-Order Deductions']] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-label-md font-medium transition-colors',
              activeTab === id
                ? 'border-espresso font-bold text-office-ink'
                : 'border-transparent text-stone-500 hover:text-stone-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── PAYROLL ENTRY TAB ──────────────────────────── */}
      {activeTab === 'entry' && (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden px-6 pb-6 pt-4">

          {/* Controls row */}
          <div className="mb-2 flex flex-wrap items-end gap-3">
            {entryControls}
          </div>

          {/* Published banner */}
          {isPublished && (
            <div className="mb-3 flex flex-shrink-0 items-center gap-2 rounded-lg border border-success-border bg-success-bg px-4 py-2.5 text-label-md font-normal text-success">
              ✓ &nbsp;<strong>{formatPayPeriod(activePeriod)} is published.</strong>&nbsp; Staff can see and print their payslips. Click &ldquo;Revert to Draft&rdquo; to make corrections.
            </div>
          )}

          {/* Carry-forward banner — figures pre-filled from a prior month await review */}
          {!isPublished && statusCounts.carried > 0 && (
            <div className="mb-3 flex flex-shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-label-md font-normal text-blue-800">
              <RefreshCw size={13} className="flex-shrink-0" />
              <span>
                <strong>{statusCounts.carried} row{statusCounts.carried > 1 ? 's' : ''} carried over</strong> from the previous month.
                Recurring figures are pre-filled — update any that changed (variable items like overtime &amp; advances start blank),
                then <strong>Publish</strong> to finalise. Publishing saves carried figures automatically.
              </span>
            </div>
          )}

          {/* The sheet */}
          <Sheet
            dataTour="sheet"
            groups={groups}
            rows={rows}
            rowKey={(r) => r.userId}
            engine={engine}
            locked={isPublished}
            disabled={editLocked}
            rowIndicator={rowIndicator}
            isLoading={isLoadingSheet}
            skeletonColumns={12}
            fullscreenBar={<div className="flex flex-wrap items-end gap-3">{entryControls}</div>}
            toolbar={
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw size={12} />}
                onClick={() => void loadSheet()}
                className="h-[22px] px-2 text-sheet-header"
              >
                Refresh
              </Button>
            }
            statusBar={{
              left: (
                <>
                  {isAllBranches ? `All branches · ${branches.length} branches` : isPublished ? 'Published' : 'Draft'} · {rows.length} staff
                  {!isAllBranches && statusCounts.saved > 0 && !isPublished && ` · ${statusCounts.saved} saved`}
                  {!isAllBranches && statusCounts.dirty > 0 && ` · ${statusCounts.dirty} pending`}
                  {!isAllBranches && statusCounts.error > 0 && ` · ${statusCounts.error} error`}
                </>
              ),
              right: (
                <>
                  <span><span className="mr-1 opacity-65">Gross:</span><strong>Ksh {money(totals.grossPay)}</strong></span>
                  <span><span className="mr-1 opacity-65">Deductions:</span><strong>Ksh {money(totals.totalDeductions)}</strong></span>
                  <span><span className="mr-1 opacity-65">Net:</span><strong>Ksh {money(totals.netSalary)}</strong></span>
                </>
              ),
            }}
          />
        </div>
      )}

      {/* ── RECORDS TAB ───────────────────────────────── */}
      {activeTab === 'records' && (
        <div className="space-y-4 px-6 pb-6 pt-4">
          {/* Filter bar */}
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
              <FilterField label="Pay Period">
                <input
                  type="month"
                  value={recordPeriod}
                  onChange={(e) => setRecordPeriod(e.target.value)}
                  className={cn(filterControlClasses, 'min-w-[150px]')}
                />
              </FilterField>
              <FilterField label="Branch">
                <select
                  value={recordBranchId}
                  onChange={(e) => setRecordBranchId(e.target.value)}
                  className={cn(filterControlClasses, 'min-w-[140px] cursor-pointer')}
                >
                  {branchOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FilterField>
              <FilterField label="Staff Member">
                <select
                  value={recordStaffId}
                  onChange={(e) => setRecordStaffId(e.target.value)}
                  className={cn(filterControlClasses, 'min-w-[160px] cursor-pointer')}
                >
                  <option value="">All staff</option>
                  {Array.from(new Map(records.map((r) => [r.userId, r.user.name])).entries()).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Status">
                <select
                  value={recordStatus}
                  onChange={(e) => setRecordStatus(e.target.value)}
                  className={cn(filterControlClasses, 'min-w-[120px] cursor-pointer')}
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </FilterField>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            {isLoadingRecords ? (
              <div className="p-5"><SkeletonTable rows={6} columns={7} /></div>
            ) : (
              <PayslipTable
                payslips={recordStaffId ? records.filter((r) => r.userId === recordStaffId) : records}
                emptyHeading="No payslips found"
                emptyBody="Adjust the filters to find payslips."
                showBranch
                onView={(p) => { setSelectedPayslip(p); setIsDetailOpen(true); }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── STALE-ORDER DEDUCTIONS TAB ─────────────────── */}
      {activeTab === 'stale' && (() => {
        const waiters = staleSummary?.waiters ?? [];
        const hasData = waiters.length > 0;
        const singleBranch = Boolean(selectedBranchId);
        const fmtShortDate = (iso: string) =>
          new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });

        const staleColumns: ExcelColumn<StaleWaiter>[] = [
          {
            key: 'waiter',
            label: 'Waiter',
            render: (w) => <span className="font-semibold">{w.waiterName}</span>,
          },
          ...(singleBranch
            ? []
            : [{
                key: 'branch',
                label: 'Branch',
                tone: 'muted' as const,
                render: (w: StaleWaiter) => w.branchName,
              }]),
          {
            key: 'orders',
            label: 'Orders',
            align: 'center',
            width: 90,
            render: (w) => <span className="tabular-nums">{w.orderCount}</span>,
          },
          {
            key: 'amount',
            label: 'Potential Deduction (Ksh)',
            numeric: true,
            tone: 'negative',
            width: 170,
            render: (w) => <span className="font-bold">{formatCurrency(w.totalLiability)}</span>,
          },
        ];

        return (
          <div className="space-y-3 px-6 pb-6 pt-4">
            {/* Header row: title + action note + branch filter (compact) */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-3xl">
                <h3 className="text-body-sm font-bold text-office-ink">Potential Stale-Order Deductions</h3>
                <p className="mt-0.5 text-label-md font-normal leading-snug text-stone-500">
                  Unpaid orders waiters never closed, totalled per waiter. Resolved orders drop off
                  automatically. Key each amount into the <strong>N.C.N.S / Deductions</strong> column on Payroll Entry.
                </p>
              </div>
              <FilterField label="Branch">
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className={cn(filterControlClasses, 'min-w-[150px] cursor-pointer')}
                >
                  {branchOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FilterField>
            </div>

            <ExcelTable
              columns={staleColumns}
              rows={waiters}
              rowKey={(w) => w.waiterId}
              numbered
              headerTone="navy"
              isLoading={isLoadingStale}
              emptyState={
                <>
                  <p className="text-body-sm font-semibold text-stone-700">No unresolved stale orders</p>
                  <p className="mt-1 text-label-md font-normal text-stone-400">Every order in the selected branch has been closed or accounted for.</p>
                </>
              }
              expandable={{
                isExpanded: (w) => expandedWaiterId === w.waiterId,
                onToggle: (w) => setExpandedWaiterId(expandedWaiterId === w.waiterId ? null : w.waiterId),
                childRows: (w) =>
                  w.orders.map((order, oIdx) => ({
                    waiter: (
                      <span className="whitespace-nowrap">
                        <span className="mr-1.5 text-stone-400">{oIdx + 1}.</span>
                        Order #{order.dailyNumber}
                      </span>
                    ),
                    ...(singleBranch ? {} : { branch: order.branchName }),
                    orders: (
                      <span className="whitespace-nowrap">
                        {fmtShortDate(order.orderDate)}{order.tableNumber ? ` · T${order.tableNumber}` : ''}
                      </span>
                    ),
                    amount: <span className="font-semibold text-sheet-negative">{formatCurrency(order.total)}</span>,
                  })),
              }}
              totalsRow={hasData ? {
                waiter: <span className="text-label-sm uppercase tracking-wide">Total</span>,
                orders: staleSummary!.totalOrders,
                amount: <>Ksh {formatCurrency(staleSummary!.totalLiability)}</>,
              } : undefined}
              footnote={hasData ? (
                <>
                  {staleSummary!.totalWaiters} waiter{staleSummary!.totalWaiters > 1 ? 's' : ''} ·
                  {' '}{staleSummary!.totalOrders} unresolved order{staleSummary!.totalOrders > 1 ? 's' : ''} ·
                  {' '}click a row to view individual orders
                </>
              ) : undefined}
            />
          </div>
        );
      })()}

      {/* Modals */}
      <ConfirmDialog
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={() => void handlePublish()}
        title={`Publish payroll for ${formatPayPeriod(activePeriod)}?`}
        description={`This will finalise figures for ${rows.length} staff at ${selectedBranchName}. Staff will be able to view and print their payslips.`}
        confirmLabel="Publish"
        isLoading={isPublishing}
      />
      <ConfirmDialog
        isOpen={showRevertConfirm}
        onClose={() => setShowRevertConfirm(false)}
        onConfirm={() => void handleRevert()}
        title={`Revert ${formatPayPeriod(activePeriod)} to draft?`}
        description="Staff will see figures as draft again and will not be able to print until you re-publish."
        confirmLabel="Revert to Draft"
        isLoading={isPublishing}
      />
      <ConfirmDialog
        isOpen={showCopyConfirm}
        onClose={() => setShowCopyConfirm(false)}
        onConfirm={() => void copyFromPreviousMonth()}
        title="Copy figures from the previous month?"
        description={`This fills blank Gross Pay, PAYE, SHA, NSSF, Housing Levy and Allowance cells at ${selectedBranchName} from the most recent prior month. Values you have already entered are left untouched. Variable items (overtime, advances, incentives) are not copied.`}
        confirmLabel="Copy figures"
        isLoading={isCopying}
      />
      <PayslipDetailModal
        payslip={selectedPayslip}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </PageLayout>
  );
}
