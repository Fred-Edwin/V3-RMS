'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  PageLayout,
  SkeletonTable,
} from '@/components/ui';
import { PayslipDetailModal } from '@/components/payslips/PayslipDetailModal';
import { PayslipTable } from '@/components/payslips/PayslipTable';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { commsService } from '@/services/commsService';
import { payslipService } from '@/services/payslipService';
import { staffService, type StaffDto } from '@/services/staffService';
import { waiterLiabilityService } from '@/services/waiterLiabilityService';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';
import type { Payslip } from '@/types/payslip';
import type { WaiterLiabilitySummaryReport } from '@/types/waiterLiability';
import { formatCurrency, formatPayPeriod } from '@/components/payslips/payslip-utils';
import {
  buildBankFileCsv,
  buildPayrollRegisterCsv,
  csvFilenameSlug,
  downloadCsv,
  type PayrollExportRow,
} from '@/lib/payroll-csv';
import { cn } from '@/lib/cn';

type RowState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface SheetRow {
  userId: string;
  name: string;
  role: string;
  branchName: string;
  grossPay: string;
  paye: string;
  sha: string;
  nssfTier1: string;
  nssfTier2: string;
  housingLevy: string;
  ncnsAmount: string;
  ncnsNote: string;
  advance: string;
  incentives: string;
  overtime: string;
  allowances: string;
  kraPIN: string | null;
  bankAccount: string | null;
  bankName: string | null;
  accountNumber: string | null;
  payslipId: string | null;
  state: RowState;
  errorMsg: string;
}

const EDITABLE_COLUMNS = [
  'grossPay',
  'paye',
  'sha',
  'nssfTier1',
  'nssfTier2',
  'housingLevy',
  'ncnsAmount',
  'ncnsNote',
  'advance',
  'incentives',
  'overtime',
  'allowances',
] as const;

type EditableColumnKey = (typeof EDITABLE_COLUMNS)[number];

interface SheetCellCoord {
  rowIndex: number;
  columnKey: EditableColumnKey;
}

interface SheetSelection {
  anchor: SheetCellCoord;
  focus: SheetCellCoord;
}

const MONEY_COLUMNS = new Set<EditableColumnKey>(
  EDITABLE_COLUMNS.filter((column) => column !== 'ncnsNote'),
);

const EXCLUDED_ROLES = new Set<AppRole>(['KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'SYSTEM_ADMIN']);

const columnIndex = (columnKey: EditableColumnKey): number => EDITABLE_COLUMNS.indexOf(columnKey);

const sameCell = (a: SheetCellCoord | null, b: SheetCellCoord | null): boolean =>
  !!a && !!b && a.rowIndex === b.rowIndex && a.columnKey === b.columnKey;

const getSelectionBounds = (selection: SheetSelection) => {
  const anchorColumn = columnIndex(selection.anchor.columnKey);
  const focusColumn = columnIndex(selection.focus.columnKey);

  return {
    minRow: Math.min(selection.anchor.rowIndex, selection.focus.rowIndex),
    maxRow: Math.max(selection.anchor.rowIndex, selection.focus.rowIndex),
    minCol: Math.min(anchorColumn, focusColumn),
    maxCol: Math.max(anchorColumn, focusColumn),
  };
};

const isCellInSelection = (cell: SheetCellCoord, selection: SheetSelection | null): boolean => {
  if (!selection) return false;
  const bounds = getSelectionBounds(selection);
  const col = columnIndex(cell.columnKey);
  return cell.rowIndex >= bounds.minRow && cell.rowIndex <= bounds.maxRow && col >= bounds.minCol && col <= bounds.maxCol;
};

const isBottomRightSelectionCell = (cell: SheetCellCoord, selection: SheetSelection | null): boolean => {
  if (!selection) return false;
  const bounds = getSelectionBounds(selection);
  return cell.rowIndex === bounds.maxRow && columnIndex(cell.columnKey) === bounds.maxCol;
};

const normalizeClipboardValue = (columnKey: EditableColumnKey, value: string): string | null => {
  const trimmed = value.trim();
  if (!MONEY_COLUMNS.has(columnKey)) return trimmed;

  const normalized = trimmed.replace(/,/g, '');
  if (normalized === '') return '';
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null;
  return normalized;
};

const parseClipboardGrid = (text: string): string[][] => {
  const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (rows[rows.length - 1] === '') rows.pop();
  return rows.map((row) => row.split('\t'));
};

const computeRow = (row: SheetRow) => {
  const totalDeductions =
    Number(row.paye || 0) +
    Number(row.sha || 0) +
    Number(row.nssfTier1 || 0) +
    Number(row.nssfTier2 || 0) +
    Number(row.housingLevy || 0) +
    Number(row.ncnsAmount || 0) +
    Number(row.advance || 0);
  const totalEarnings =
    Number(row.grossPay || 0) +
    Number(row.incentives || 0) +
    Number(row.overtime || 0) +
    Number(row.allowances || 0);
  const netSalary = totalEarnings - totalDeductions;
  return { totalDeductions, netSalary };
};

const SHEET_ROLE_ORDER: Record<string, number> = {
  DIRECTOR: 0,
  HR_MANAGER: 1,
  MANAGER: 2,
  ACCOUNTANT: 3,
  CHEF: 4,
  BARISTA: 5,
  WAITER: 6,
};

const roleLabel = (role: string) =>
  role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const formatSheetAccount = (accountNumber: string | null | undefined, bankName: string | null | undefined): string | null => {
  if (!accountNumber) return null;
  return bankName ? `${bankName} ${accountNumber}` : accountNumber;
};

const staffToRow = (staff: StaffDto, branchName: string): SheetRow => ({
  userId: staff.id,
  name: staff.name,
  role: roleLabel(staff.role),
  branchName,
  grossPay: '',
  paye: '',
  sha: '',
  nssfTier1: '',
  nssfTier2: '',
  housingLevy: '',
  ncnsAmount: '',
  ncnsNote: '',
  advance: '',
  incentives: '',
  overtime: '',
  allowances: '',
  kraPIN: null,
  bankAccount: null,
  bankName: null,
  accountNumber: null,
  payslipId: null,
  state: 'idle',
  errorMsg: '',
});

const payslipToRow = (payslip: Payslip): Partial<SheetRow> => {
  const ep = payslip.user.employeeProfile;
  const otherDed = payslip.otherDeductions?.[0];
  return {
    grossPay: payslip.grossPay,
    paye: payslip.paye,
    sha: payslip.sha,
    nssfTier1: payslip.nssfTier1,
    nssfTier2: payslip.nssfTier2,
    housingLevy: payslip.housingLevy,
    ncnsAmount: otherDed?.amount ?? '',
    ncnsNote: otherDed?.label ?? '',
    advance: payslip.advance ?? '',
    incentives: payslip.incentives ?? '',
    overtime: payslip.overtime ?? '',
    allowances: payslip.allowances ?? '',
    kraPIN: ep?.kraPIN ?? null,
    bankAccount: formatSheetAccount(ep?.accountNumber, ep?.bankName),
    bankName: ep?.bankName ?? null,
    accountNumber: ep?.accountNumber ?? null,
    payslipId: payslip.id,
    state: 'saved',
  };
};

const getPreviousAndCurrentMonths = (): string[] => {
  const now = new Date();
  return [1, 0].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
};

const lastDayOfMonth = (payPeriod: string): string => {
  const [y, m] = payPeriod.split('-').map(Number);
  const last = new Date(y, m, 0);
  return last.toISOString().slice(0, 10);
};

type TabId = 'entry' | 'records' | 'stale';

/* ── Auto-save status indicator ─────────────────────────────────── */
function AutoSaveStatus({ dirty, saving, error }: { dirty: number; saving: number; error: number }) {
  if (error > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-[11.5px] font-medium text-red-600">
        <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
        Auto-save failed — check connection
      </div>
    );
  }
  if (saving > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[11.5px] font-medium text-blue-600">
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
        Saving…
      </div>
    );
  }
  if (dirty > 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-[11.5px] font-medium text-amber-600">
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
        {dirty} row{dirty > 1 ? 's' : ''} pending save…
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[11.5px] font-medium text-emerald-600">
      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
      All changes saved · Staff see updates on refresh
    </div>
  );
}

export default function HrPayslipsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const actorOrgId = useAuthStore((state) => state.organizationId);
  const actorRole = useAuthStore((state) => state.role);
  const { toast } = useToast();

  const periods = useMemo(() => getPreviousAndCurrentMonths(), []);
  const [activeTab, setActiveTab] = useState<TabId>('entry');
  const [activePeriod, setActivePeriod] = useState(periods[1] ?? periods[0]);
  const [selectedBranchId, setSelectedBranchId] = useState(actorOrgId ?? '');
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Missing-bank-details readiness + notify flow.
  const [showNotifyConfirm, setShowNotifyConfirm] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);

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

  const [activeCell, setActiveCell] = useState<SheetCellCoord | null>(null);
  const [selection, setSelection] = useState<SheetSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [fillSelection, setFillSelection] = useState<SheetSelection | null>(null);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const rowsRef = useRef<SheetRow[]>([]);
  const selectionRef = useRef<SheetSelection | null>(null);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

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
  const buildBranchRows = useCallback((
    branchName: string,
    staffResult: StaffDto[],
    payslips: Payslip[],
  ): SheetRow[] => {
    const eligible = staffResult
      .filter((s) => !EXCLUDED_ROLES.has(s.role))
      .sort((a, b) => {
        const ra = SHEET_ROLE_ORDER[a.role] ?? 99;
        const rb = SHEET_ROLE_ORDER[b.role] ?? 99;
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
    const payslipMap = new Map(payslips.map((p) => [p.userId, p]));

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
      }
      return base;
    });
  }, []);

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

      const sheetRows = buildBranchRows(branchName, staffResult, payslipResult.items);
      const allPublished = payslipResult.items.length > 0 && payslipResult.items.every((p) => p.isLocked);
      setIsPublished(allPublished);
      setRows(sheetRows);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load payroll sheet', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoadingSheet(false);
    }
  }, [accessToken, activePeriod, selectedBranchId, branches, buildBranchRows, toast]);

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
      const otherDeductions = row.ncnsAmount
        ? [{ label: row.ncnsNote || 'Deduction', amount: Number(row.ncnsAmount).toFixed(2) }]
        : [];

      const result = await payslipService.bulkUpsert(
        {
          payPeriod: activePeriod,
          organizationId: orgId,
          rows: [{
            userId: row.userId,
            payDate: lastDayOfMonth(activePeriod),
            grossPay: row.grossPay || '0',
            paye: row.paye || '0',
            sha: row.sha || '0',
            nssfTier1: row.nssfTier1 || '0',
            nssfTier2: row.nssfTier2 || '0',
            housingLevy: row.housingLevy || '0',
            helb: null,
            advance: row.advance || null,
            incentives: row.incentives || null,
            overtime: row.overtime || null,
            allowances: row.allowances || null,
            otherDeductions: otherDeductions.length > 0 ? otherDeductions : undefined,
          }],
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

  const updateRowsBatch = useCallback((updates: Array<{ rowIndex: number; field: EditableColumnKey; value: string }>) => {
    const affectedUserIds = new Set<string>();

    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      updates.forEach((update) => {
        const row = next[update.rowIndex];
        if (!row) return;
        row[update.field] = update.value;
        row.state = 'dirty';
        row.errorMsg = '';
        affectedUserIds.add(row.userId);
      });
      return next;
    });

    affectedUserIds.forEach(scheduleAutoSave);
  }, [scheduleAutoSave]);

  const updateRow = (userId: string, field: keyof SheetRow, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.userId === userId ? { ...row, [field]: value, state: 'dirty' as RowState, errorMsg: '' } : row,
      ),
    );
    scheduleAutoSave(userId);
  };

  const handleCellMouseDown = (cell: SheetCellCoord) => {
    if (editLocked) return;
    setActiveCell(cell);
    setSelection({ anchor: cell, focus: cell });
    setIsSelecting(true);
  };

  const handleCellMouseEnter = (cell: SheetCellCoord) => {
    if (isSelecting && selection) {
      setSelection({ anchor: selection.anchor, focus: cell });
      return;
    }

    if (fillSelection) {
      setSelection({ anchor: fillSelection.anchor, focus: cell });
    }
  };

  const finishPointerAction = useCallback(() => {
    if (fillSelection && selection && !editLocked) {
      const sourceBounds = getSelectionBounds(fillSelection);
      const targetBounds = getSelectionBounds(selection);
      const draggedPastSource = targetBounds.maxRow > sourceBounds.maxRow || targetBounds.maxCol > sourceBounds.maxCol;

      if (draggedPastSource) {
        const updates: Array<{ rowIndex: number; field: EditableColumnKey; value: string }> = [];
        const sourceRows = rowsRef.current.slice(sourceBounds.minRow, sourceBounds.maxRow + 1);
        for (let rowIndex = sourceBounds.maxRow + 1; rowIndex <= targetBounds.maxRow; rowIndex++) {
          const sourceRow = sourceRows[(rowIndex - sourceBounds.maxRow - 1) % sourceRows.length];
          if (!sourceRow) continue;
          for (let colIndex = sourceBounds.minCol; colIndex <= sourceBounds.maxCol; colIndex++) {
            const field = EDITABLE_COLUMNS[colIndex];
            if (!field) continue;
            updates.push({ rowIndex, field, value: sourceRow[field] });
          }
        }
        if (updates.length > 0) updateRowsBatch(updates);
      }
    }

    setIsSelecting(false);
    setFillSelection(null);
  }, [fillSelection, editLocked, selection, updateRowsBatch]);

  useEffect(() => {
    window.addEventListener('mouseup', finishPointerAction);
    return () => window.removeEventListener('mouseup', finishPointerAction);
  }, [finishPointerAction]);

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>, startCell: SheetCellCoord) => {
    if (editLocked) return;

    const grid = parseClipboardGrid(event.clipboardData.getData('text/plain'));
    if (grid.length === 0) return;
    event.preventDefault();

    const startColumnIndex = columnIndex(startCell.columnKey);
    const updates: Array<{ rowIndex: number; field: EditableColumnKey; value: string }> = [];

    grid.forEach((pastedRow, rowOffset) => {
      const rowIndex = startCell.rowIndex + rowOffset;
      if (rowIndex >= rowsRef.current.length) return;

      pastedRow.forEach((rawValue, colOffset) => {
        const field = EDITABLE_COLUMNS[startColumnIndex + colOffset];
        if (!field) return;
        const value = normalizeClipboardValue(field, rawValue);
        if (value === null) return;
        updates.push({ rowIndex, field, value });
      });
    });

    if (updates.length > 0) updateRowsBatch(updates);
  };

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      const currentSelection = selectionRef.current;
      if (!currentSelection) return;
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement) || !activeElement.closest('[data-payroll-sheet="true"]')) return;

      const bounds = getSelectionBounds(currentSelection);
      const text = rowsRef.current
        .slice(bounds.minRow, bounds.maxRow + 1)
        .map((row) =>
          EDITABLE_COLUMNS.slice(bounds.minCol, bounds.maxCol + 1)
            .map((field) => row[field])
            .join('\t'),
        )
        .join('\n');

      event.clipboardData?.setData('text/plain', text);
      event.preventDefault();
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);

  const handlePublish = async () => {
    if (!accessToken) return;
    const orgId = selectedBranchId || actorOrgId;
    if (!orgId) return;
    setIsPublishing(true);
    try {
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

  const totals = useMemo(() => {
    const sum = (field: keyof SheetRow) =>
      rows.reduce((acc, r) => acc + Number((r[field] as string) || 0), 0);
    return {
      grossPay: sum('grossPay'),
      paye: sum('paye'),
      sha: sum('sha'),
      nssfTier1: sum('nssfTier1'),
      nssfTier2: sum('nssfTier2'),
      housingLevy: sum('housingLevy'),
      ncnsAmount: sum('ncnsAmount'),
      advance: sum('advance'),
      incentives: sum('incentives'),
      overtime: sum('overtime'),
      allowances: sum('allowances'),
      totalDeductions: rows.reduce((acc, r) => acc + computeRow(r).totalDeductions, 0),
      netSalary: rows.reduce((acc, r) => acc + computeRow(r).netSalary, 0),
    };
  }, [rows]);

  const statusCounts = useMemo(() => ({
    saved: rows.filter((r) => r.state === 'saved').length,
    dirty: rows.filter((r) => r.state === 'dirty').length,
    saving: rows.filter((r) => r.state === 'saving').length,
    error: rows.filter((r) => r.state === 'error').length,
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

  const handleExportRegister = useCallback(() => {
    if (rows.length === 0) return;
    const generated = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Nairobi' }).format(new Date());
    const csv = buildPayrollRegisterCsv(toExportRows(), formatPayPeriod(activePeriod), generated);
    downloadCsv(`Wendo-Payroll-Register-${exportSlug()}.csv`, csv);
    toast({ variant: 'success', title: 'Payroll register exported', message: `${rows.length} staff across ${isAllBranches ? 'all branches' : selectedBranchName}.` });
  }, [rows.length, toExportRows, exportSlug, activePeriod, isAllBranches, selectedBranchName, toast]);

  /* ── Missing bank-account readiness ──────────────────────────────── */
  // Staff with no bank account are silently excluded from the bank file. Surface
  // them so HR/Director can chase the details before the next payroll run.
  const missingBankDetails = useMemo(
    () => rows.filter((r) => !(r.accountNumber && r.accountNumber.trim())),
    [rows],
  );

  // Only Directors and HR Managers may issue formal notices (matches the comms module).
  const canNotify = actorRole === 'DIRECTOR' || actorRole === 'HR_MANAGER';

  const handleNotifyMissing = useCallback(async () => {
    if (!accessToken || missingBankDetails.length === 0) return;
    setIsNotifying(true);
    try {
      // One personalised formal notice per affected employee — the issueNotice API
      // targets a single user per call, so we fan out.
      const results = await Promise.allSettled(
        missingBankDetails.map((r) =>
          commsService.issueNotice(accessToken, {
            targetUserId: r.userId,
            subject: 'Action needed: add your bank & payment details',
            bodyHtml:
              `<p>Hi ${r.name},</p>` +
              `<p>Payroll cannot pay you until your bank details are on file. ` +
              `Please open <strong>Profile → Payment Details</strong> and add your ` +
              `bank name, account number, and KRA PIN.</p>` +
              `<p>Do this before the next payroll run so your salary is included in the bank payment file.</p>`,
          }),
        ),
      );

      const sent = results.filter((x) => x.status === 'fulfilled').length;
      const failed = results.length - sent;
      if (failed === 0) {
        toast({ variant: 'success', title: 'Staff notified', message: `Sent a payment-details notice to ${sent} staff member${sent === 1 ? '' : 's'}.` });
      } else {
        toast({ variant: 'error', title: `Notified ${sent}, ${failed} failed`, message: 'Some notices could not be sent. Please retry.' });
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to notify staff', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsNotifying(false);
      setShowNotifyConfirm(false);
    }
  }, [accessToken, missingBankDetails, toast]);

  /* ── Shared cell class helpers ─── */
  const inp = (extra = '') =>
    `w-full bg-transparent px-1.5 py-1 text-right text-[12px] text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#1e72c4] disabled:cursor-not-allowed disabled:text-stone-400 ${extra}`;

  const editableCellStyle = (cell: SheetCellCoord, bg: string): React.CSSProperties => {
    const selected = isCellInSelection(cell, selection);
    const active = sameCell(cell, activeCell);

    return {
      ...cellStyle(selected ? '#dbeafe' : bg),
      position: 'relative',
      boxShadow: active
        ? 'inset 0 0 0 2px #2563eb'
        : selected
          ? 'inset 0 0 0 1px #60a5fa'
          : undefined,
    };
  };

  const cellEvents = (cell: SheetCellCoord) => ({
    onMouseDown: () => handleCellMouseDown(cell),
    onMouseEnter: () => handleCellMouseEnter(cell),
  });

  const inputEvents = (cell: SheetCellCoord) => ({
    onFocus: () => {
      if (editLocked) return;
      setActiveCell(cell);
      setSelection({ anchor: cell, focus: cell });
    },
    onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => handlePaste(event, cell),
  });

  const fillHandle = (cell: SheetCellCoord) => {
    if (editLocked || !isBottomRightSelectionCell(cell, selection)) return null;

    return (
      <span
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (selection) setFillSelection(selection);
        }}
        title="Drag to fill"
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          width: 7,
          height: 7,
          border: '1px solid white',
          background: '#2563eb',
          cursor: 'crosshair',
          zIndex: 6,
        }}
      />
    );
  };

  return (
    <PageLayout className="animate-fade-up !max-w-none !py-0 !px-0 !mx-0 flex flex-col [height:calc(100vh-56px)]">
      {/* Page header */}
      <div className="px-6 pt-5 pb-3">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a0a00', letterSpacing: '-0.3px', lineHeight: 1.2 }}>Payroll</h1>
        <p style={{ marginTop: 4, fontSize: 13, color: '#a8a29e' }}>Enter and manage staff payroll per pay period. Staff see figures as drafts in real time.</p>
      </div>

      {/* Main tabs (underline style) */}
      <div className="flex border-b border-stone-200 px-6 flex-shrink-0">
        {([['entry', 'Payroll Entry'], ['records', 'Payslip Records'], ['stale', 'Stale-Order Deductions']] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              activeTab === id
                ? 'border-[#6b4226] text-[#1a0a00] font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── PAYROLL ENTRY TAB ──────────────────────────── */}
      {activeTab === 'entry' && (
        <div className="flex flex-col flex-1 px-6 pt-4 pb-6 gap-3 overflow-hidden">

          {/* Controls row */}
          <div className="flex flex-wrap items-end gap-3 mb-2">
            {/* Pay Period */}
            <div className="flex flex-col gap-1">
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a29e' }}>Pay Period</span>
              <input
                type="month"
                value={activePeriod}
                onChange={(e) => e.target.value && setActivePeriod(e.target.value)}
                style={{ height: 32, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 12, color: '#1a0a00', background: 'white', outline: 'none', minWidth: 150 }}
              />
            </div>
            {/* Branch */}
            <div className="flex flex-col gap-1">
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a29e' }}>Branch</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{ height: 32, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 12, color: '#1a0a00', background: 'white', outline: 'none', minWidth: 140, cursor: 'pointer' }}
              >
                {branchOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ width: 1, height: 32, background: '#e7e5e4', flexShrink: 0 }} />

            <AutoSaveStatus
              dirty={statusCounts.dirty}
              saving={statusCounts.saving}
              error={statusCounts.error}
            />

            <div className="ml-auto flex items-center gap-2">
              {/* CSV exports — available in any branch scope, incl. all-branches */}
              <button
                onClick={handleExportBankFile}
                disabled={rows.length === 0}
                title="Strict CSV for the bank, grouped by branch (net pay per employee)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 34, borderRadius: 8, border: '1px solid #1f6e43', background: 'white', color: '#1f6e43', fontSize: 12, fontWeight: 600, cursor: rows.length === 0 ? 'not-allowed' : 'pointer', opacity: rows.length === 0 ? 0.5 : 1 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Bank File
              </button>
              <button
                onClick={handleExportRegister}
                disabled={rows.length === 0}
                title="Full payroll register with all columns, branch subtotals & grand total"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 34, borderRadius: 8, border: '1px solid #d6d3d1', background: 'white', color: '#57534e', fontSize: 12, fontWeight: 600, cursor: rows.length === 0 ? 'not-allowed' : 'pointer', opacity: rows.length === 0 ? 0.5 : 1 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Full Register
              </button>

              {/* Publish/Revert are per-branch only — hidden in the consolidated all-branches view */}
              {isAllBranches ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, paddingLeft: 6, fontSize: 11.5, color: '#a8a29e', fontStyle: 'italic' }}>
                  View &amp; export only · pick a branch to edit or publish
                </span>
              ) : isPublished ? (
                <button
                  onClick={() => setShowRevertConfirm(true)}
                  disabled={isPublishing}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 34, borderRadius: 8, border: '1px solid #ef4444', background: 'white', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  ↩ Revert to Draft
                </button>
              ) : (
                <button
                  onClick={() => setShowPublishConfirm(true)}
                  disabled={isPublishing || rows.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 34, borderRadius: 8, background: '#1a0a00', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', opacity: (isPublishing || rows.length === 0) ? 0.5 : 1 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Publish Payroll
                </button>
              )}
            </div>
          </div>

          {/* Published banner */}
          {isPublished && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-800 flex-shrink-0">
              ✓ &nbsp;<strong>{formatPayPeriod(activePeriod)} is published.</strong>&nbsp; Staff can see and print their payslips. Click &ldquo;Revert to Draft&rdquo; to make corrections.
            </div>
          )}

          {/* Missing bank-details readiness banner */}
          {!isLoadingSheet && missingBankDetails.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-2">
                  <span className="text-[14px]">⚠️</span>
                  <span>
                    <strong>{missingBankDetails.length} of {rows.length} staff are missing bank details</strong>
                    {' '}— they will be excluded from the bank payment file.
                  </span>
                </span>
                {canNotify && (
                  <button
                    onClick={() => setShowNotifyConfirm(true)}
                    disabled={isNotifying}
                    className="ml-auto rounded-md bg-amber-600 px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isNotifying ? 'Sending…' : `Notify ${missingBankDetails.length} staff`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sheet container */}
          <div
            className="flex flex-col flex-1 rounded-t-[20px] border border-stone-200 bg-white shadow-sm overflow-hidden min-h-0"
          >
            {/* Scrollable sheet area */}
            <div className="overflow-auto flex-1" data-payroll-sheet="true">
              {isLoadingSheet ? (
                <div className="p-6"><SkeletonTable rows={6} columns={12} /></div>
              ) : (
                <table
                  style={{ borderCollapse: 'collapse', fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif", fontSize: '12px', width: 1880, minWidth: 1880, tableLayout: 'fixed' }}
                >
                  <colgroup>
                    <col style={{ width: 32, minWidth: 32 }} />
                    <col style={{ width: 200, minWidth: 200 }} />
                    <col style={{ width: 92, minWidth: 92 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 170, minWidth: 170 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 84, minWidth: 84 }} />
                    <col style={{ width: 100, minWidth: 100 }} />
                    <col style={{ width: 100, minWidth: 100 }} />
                    <col style={{ width: 100, minWidth: 100 }} />
                    <col style={{ width: 140, minWidth: 140 }} />
                    <col style={{ width: 260, minWidth: 260 }} />
                  </colgroup>

                  <thead>
                    {/* Section label row */}
                    <tr>
                      <td
                        style={{ background: '#2e5984', border: '1px solid rgba(255,255,255,0.3)', height: 22, position: 'sticky', top: 0, left: 0, zIndex: 20, width: 32 }}
                      />
                      <td
                        style={{ background: '#2e5984', border: '1px solid rgba(255,255,255,0.3)', height: 22, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'white', padding: '0 8px', position: 'sticky', top: 0, left: 32, zIndex: 19, verticalAlign: 'middle' }}
                      >
                        EMPLOYEES PAYROLLS — {formatPayPeriod(activePeriod).toUpperCase()}
                      </td>
                      <td
                        colSpan={1}
                        style={{ background: '#1f6e43', border: '1px solid rgba(255,255,255,0.3)', height: 22, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'white', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 9 }}
                      >
                        EARNINGS
                      </td>
                      <td
                        colSpan={6}
                        style={{ background: '#a31515', border: '1px solid rgba(255,255,255,0.3)', height: 22, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'white', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 9 }}
                      >
                        DEDUCTIONS
                      </td>
                      <td
                        colSpan={4}
                        style={{ background: '#5b2d8e', border: '1px solid rgba(255,255,255,0.3)', height: 22, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'white', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 9 }}
                      >
                        EXTRAS
                      </td>
                      <td
                        colSpan={2}
                        style={{ background: '#1a5276', border: '1px solid rgba(255,255,255,0.3)', height: 22, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'white', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 9 }}
                      >
                        COMPUTED
                      </td>
                      <td
                        colSpan={2}
                        style={{ background: '#78716c', border: '1px solid rgba(255,255,255,0.25)', height: 22, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.85)', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 9 }}
                      >
                        STAFF DETAILS (read-only)
                      </td>
                    </tr>

                    {/* Column header row */}
                    <tr>
                      {/* Corner */}
                      <th
                        style={{ background: '#f0f0f0', border: '1px solid #d0d0d0', position: 'sticky', top: 22, left: 0, zIndex: 20, width: 32 }}
                      />
                      {/* Name */}
                      <th
                        style={{ background: '#f0f0f0', border: '1px solid #d0d0d0', borderRight: '2px solid #d6d3d1', height: 40, fontSize: 10.5, fontWeight: 700, textAlign: 'left', paddingLeft: 8, color: '#555', position: 'sticky', top: 22, left: 32, zIndex: 19, verticalAlign: 'middle', lineHeight: 1.3 }}
                      >
                        NAME
                      </th>
                      {/* Gross */}
                      <th style={colHdrStyle('#1f6e43')}>GROSS<br />Salary</th>
                      {/* Deductions */}
                      <th style={colHdrStyle('#a31515')}>PAYE</th>
                      <th style={colHdrStyle('#a31515')}>SHA<br />(NHIF)</th>
                      <th style={colHdrStyle('#a31515')}>NSSF<br />(Tier 1)</th>
                      <th style={colHdrStyle('#a31515')}>NSSF<br />(Tier 2)</th>
                      <th style={colHdrStyle('#a31515')}>Housing<br />Levy</th>
                      <th style={colHdrStyle('#a31515')}>N.C.N.S /<br />Deductions</th>
                      {/* Extras */}
                      <th style={colHdrStyle('#5b2d8e')}>Advance</th>
                      <th style={colHdrStyle('#5b2d8e')}>Incentives</th>
                      <th style={colHdrStyle('#5b2d8e')}>O.T</th>
                      <th style={colHdrStyle('#5b2d8e')}>Allowances</th>
                      {/* Computed */}
                      <th style={{ ...colHdrStyle('#1a5276'), background: '#dce6f1' }}>Total<br />Deductions</th>
                      <th style={{ ...colHdrStyle('#1a5276'), background: '#dce6f1' }}>Net<br />Salary</th>
                      {/* Ref */}
                      <th style={{ background: '#f5f5f4', border: '1px solid #d0d0d0', borderTop: '3px solid #78716c', borderLeft: '2px solid #d6d3d1', height: 40, fontSize: 10.5, fontWeight: 700, textAlign: 'center', color: '#78716c', position: 'sticky', top: 22, zIndex: 9, verticalAlign: 'middle', lineHeight: 1.3, padding: '2px 4px' }}>KRA PIN</th>
                      <th style={{ background: '#f5f5f4', border: '1px solid #d0d0d0', borderTop: '3px solid #78716c', height: 40, fontSize: 10.5, fontWeight: 700, textAlign: 'center', color: '#78716c', position: 'sticky', top: 22, zIndex: 9, verticalAlign: 'middle', lineHeight: 1.3, padding: '2px 4px' }}>Bank Account</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, idx) => {
                      const { totalDeductions, netSalary } = computeRow(row);
                      // `locked` controls the greyed "published" look; inputs are
                      // additionally disabled in the read-only all-branches view.
                      const locked = isPublished;
                      const inputsDisabled = editLocked;
                      const isEven = idx % 2 === 1;
                      const rowBg = locked ? '#f5f5f5' : isEven ? '#f9f9f9' : '#ffffff';
                      const c = (columnKey: EditableColumnKey): SheetCellCoord => ({ rowIndex: idx, columnKey });

                      return (
                        <tr
                          key={row.userId}
                          style={{ background: rowBg }}
                          className={locked ? '' : 'group hover:[&>td]:!bg-[#eef3fa]'}
                        >
                          {/* Row number cell — just the number + a tiny dot for save state */}
                          <td style={rownumCellStyle(isEven ? '#ebebeb' : '#f0f0f0')}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 2 }}>
                              <span style={{ fontSize: 10, color: '#888', lineHeight: 1 }}>{idx + 1}</span>
                              {(row.state === 'dirty' || row.state === 'saving') && (
                                <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                              )}
                              {row.state === 'error' && (
                                <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} title={row.errorMsg} />
                              )}
                            </div>
                          </td>

                          {/* Name (sticky) — clean: name on top, role below, no badges */}
                          <td style={{ border: '1px solid #d0d0d0', borderRight: '2px solid #d6d3d1', padding: '0 8px', verticalAlign: 'middle', overflow: 'hidden', fontSize: 12, position: 'sticky', left: 32, background: locked ? '#f5f5f5' : isEven ? '#f9f9f9' : '#ffffff', zIndex: 4, height: 40 }}>
                            <div style={{ fontWeight: 600, color: locked ? '#999' : '#1a0a00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                            <div style={{ fontSize: 9, color: '#b0a9a4', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.role}{isAllBranches && row.branchName ? ` · ${row.branchName}` : ''}
                            </div>
                          </td>

                          {/* GROSS */}
                          <td style={editableCellStyle(c('grossPay'), locked ? '#f0f0f0' : isEven ? '#eaf4e6' : '#f0f7ee')} {...cellEvents(c('grossPay'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.grossPay} placeholder="0" {...inputEvents(c('grossPay'))}
                              onChange={(e) => updateRow(row.userId, 'grossPay', e.target.value)} />
                            {fillHandle(c('grossPay'))}
                          </td>

                          {/* PAYE */}
                          <td style={editableCellStyle(c('paye'), locked ? '#f0f0f0' : isEven ? '#fae8e6' : '#fdf0ee')} {...cellEvents(c('paye'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.paye} placeholder="0" {...inputEvents(c('paye'))}
                              onChange={(e) => updateRow(row.userId, 'paye', e.target.value)} />
                            {fillHandle(c('paye'))}
                          </td>
                          {/* SHA */}
                          <td style={editableCellStyle(c('sha'), locked ? '#f0f0f0' : isEven ? '#fae8e6' : '#fdf0ee')} {...cellEvents(c('sha'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.sha} placeholder="0" {...inputEvents(c('sha'))}
                              onChange={(e) => updateRow(row.userId, 'sha', e.target.value)} />
                            {fillHandle(c('sha'))}
                          </td>
                          {/* NSSF T1 */}
                          <td style={editableCellStyle(c('nssfTier1'), locked ? '#f0f0f0' : isEven ? '#fae8e6' : '#fdf0ee')} {...cellEvents(c('nssfTier1'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.nssfTier1} placeholder="0" {...inputEvents(c('nssfTier1'))}
                              onChange={(e) => updateRow(row.userId, 'nssfTier1', e.target.value)} />
                            {fillHandle(c('nssfTier1'))}
                          </td>
                          {/* NSSF T2 */}
                          <td style={editableCellStyle(c('nssfTier2'), locked ? '#f0f0f0' : isEven ? '#fae8e6' : '#fdf0ee')} {...cellEvents(c('nssfTier2'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.nssfTier2} placeholder="0" {...inputEvents(c('nssfTier2'))}
                              onChange={(e) => updateRow(row.userId, 'nssfTier2', e.target.value)} />
                            {fillHandle(c('nssfTier2'))}
                          </td>
                          {/* Housing Levy */}
                          <td style={editableCellStyle(c('housingLevy'), locked ? '#f0f0f0' : isEven ? '#fae8e6' : '#fdf0ee')} {...cellEvents(c('housingLevy'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.housingLevy} placeholder="0" {...inputEvents(c('housingLevy'))}
                              onChange={(e) => updateRow(row.userId, 'housingLevy', e.target.value)} />
                            {fillHandle(c('housingLevy'))}
                          </td>

                          {/* N.C.N.S — stacked amount + note */}
                          <td style={{ ...editableCellStyle(c('ncnsAmount'), locked ? '#f0f0f0' : isEven ? '#fae8e6' : '#fdf0ee'), padding: 0 }} {...cellEvents(c('ncnsAmount'))}>
                            <div style={{ display: 'flex', flexDirection: 'column', height: 40 }}>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.ncnsAmount} placeholder="0" {...inputEvents(c('ncnsAmount'))}
                                  onChange={(e) => updateRow(row.userId, 'ncnsAmount', e.target.value)} />
                              </div>
                              <div
                                style={{
                                  height: 16,
                                  borderTop: '1px dashed #e0e0e0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  position: 'relative',
                                  background: isCellInSelection(c('ncnsNote'), selection) ? '#dbeafe' : undefined,
                                  boxShadow: sameCell(c('ncnsNote'), activeCell) ? 'inset 0 0 0 2px #2563eb' : undefined,
                                }}
                                {...cellEvents(c('ncnsNote'))}
                              >
                                <input disabled={inputsDisabled} style={{ ...inputStyle, fontSize: 10, color: '#a8a29e', fontStyle: 'italic' }} className={inp()} value={row.ncnsNote} placeholder="note…" {...inputEvents(c('ncnsNote'))}
                                  onChange={(e) => updateRow(row.userId, 'ncnsNote', e.target.value)} />
                                {fillHandle(c('ncnsNote'))}
                              </div>
                            </div>
                            {fillHandle(c('ncnsAmount'))}
                          </td>

                          {/* Advance */}
                          <td style={editableCellStyle(c('advance'), locked ? '#f0f0f0' : isEven ? '#ede6f5' : '#f3eefa')} {...cellEvents(c('advance'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.advance} placeholder="—" {...inputEvents(c('advance'))}
                              onChange={(e) => updateRow(row.userId, 'advance', e.target.value)} />
                            {fillHandle(c('advance'))}
                          </td>
                          {/* Incentives */}
                          <td style={editableCellStyle(c('incentives'), locked ? '#f0f0f0' : isEven ? '#ede6f5' : '#f3eefa')} {...cellEvents(c('incentives'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.incentives} placeholder="—" {...inputEvents(c('incentives'))}
                              onChange={(e) => updateRow(row.userId, 'incentives', e.target.value)} />
                            {fillHandle(c('incentives'))}
                          </td>
                          {/* OT */}
                          <td style={editableCellStyle(c('overtime'), locked ? '#f0f0f0' : isEven ? '#ede6f5' : '#f3eefa')} {...cellEvents(c('overtime'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.overtime} placeholder="—" {...inputEvents(c('overtime'))}
                              onChange={(e) => updateRow(row.userId, 'overtime', e.target.value)} />
                            {fillHandle(c('overtime'))}
                          </td>
                          {/* Allowances */}
                          <td style={editableCellStyle(c('allowances'), locked ? '#f0f0f0' : isEven ? '#ede6f5' : '#f3eefa')} {...cellEvents(c('allowances'))}>
                            <input disabled={inputsDisabled} style={inputStyle} className={inp()} value={row.allowances} placeholder="—" {...inputEvents(c('allowances'))}
                              onChange={(e) => updateRow(row.userId, 'allowances', e.target.value)} />
                            {fillHandle(c('allowances'))}
                          </td>

                          {/* Total Deductions (computed) */}
                          <td style={{ border: '1px solid #d0d0d0', textAlign: 'right', paddingRight: 7, fontWeight: 700, fontSize: 12, verticalAlign: 'middle', height: 40, background: locked ? 'rgba(253,232,232,0.5)' : '#fde8e8', color: '#a31515', opacity: locked ? 0.5 : 1 }}>
                            {Number(row.grossPay || 0) + totalDeductions === 0 ? <span style={{ color: '#ccc' }}>—</span> : formatCurrency(totalDeductions.toFixed(2))}
                          </td>
                          {/* Net Salary (computed) */}
                          <td style={{ border: '1px solid #d0d0d0', textAlign: 'right', paddingRight: 7, fontWeight: 700, fontSize: 12, verticalAlign: 'middle', height: 40, background: locked ? 'rgba(230,243,232,0.5)' : '#e6f3e8', color: '#1f6e43', opacity: locked ? 0.5 : 1 }}>
                            {Number(row.grossPay || 0) === 0 ? <span style={{ color: '#ccc' }}>—</span> : formatCurrency(netSalary.toFixed(2))}
                          </td>

                          {/* KRA PIN (ref) */}
                          <td style={{ border: '1px solid #d0d0d0', borderLeft: '2px solid #e7e5e4', background: row.kraPIN ? '#fafafa' : '#fffbeb', textAlign: 'center', padding: '0 6px', fontSize: 11, color: row.kraPIN ? '#57534e' : '#d97706', verticalAlign: 'middle', fontStyle: row.kraPIN ? 'normal' : 'italic' }}>
                            {row.kraPIN ?? '— Not set'}
                          </td>
                          {/* Bank Account (ref) */}
                          <td style={{ border: '1px solid #d0d0d0', background: row.bankAccount ? '#fafafa' : '#fffbeb', textAlign: 'center', padding: '0 6px', fontSize: 11, color: row.bankAccount ? '#57534e' : '#d97706', verticalAlign: 'middle', fontStyle: row.bankAccount ? 'normal' : 'italic' }}>
                            {row.bankAccount ?? '— Not set'}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals row */}
                    {rows.length > 0 && (
                      <tr style={{ borderTop: '2px solid #a8a29e', background: '#f0f0f0' }}>
                        <td style={{ border: '1px solid #d0d0d0', textAlign: 'center', fontWeight: 700, fontSize: 12, height: 36, verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 5, background: '#f0f0f0' }}>Σ</td>
                        <td style={{ border: '1px solid #d0d0d0', borderRight: '2px solid #d6d3d1', padding: '0 8px', textAlign: 'left', fontWeight: 600, color: '#57534e', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', height: 36, verticalAlign: 'middle', position: 'sticky', left: 32, zIndex: 4, background: '#f0f0f0' }}>Totals</td>
                        <td style={totalCellStyle('earn')}>{formatCurrency(totals.grossPay.toFixed(2))}</td>
                        <td style={totalCellStyle('ded')}>{formatCurrency(totals.paye.toFixed(2))}</td>
                        <td style={totalCellStyle('ded')}>{formatCurrency(totals.sha.toFixed(2))}</td>
                        <td style={totalCellStyle('ded')}>{formatCurrency(totals.nssfTier1.toFixed(2))}</td>
                        <td style={totalCellStyle('ded')}>{formatCurrency(totals.nssfTier2.toFixed(2))}</td>
                        <td style={totalCellStyle('ded')}>{formatCurrency(totals.housingLevy.toFixed(2))}</td>
                        <td style={totalCellStyle('ded')}>{formatCurrency(totals.ncnsAmount.toFixed(2))}</td>
                        <td style={totalCellStyle('extra')}>{formatCurrency(totals.advance.toFixed(2))}</td>
                        <td style={totalCellStyle('extra')}>{formatCurrency(totals.incentives.toFixed(2))}</td>
                        <td style={totalCellStyle('extra')}>{formatCurrency(totals.overtime.toFixed(2))}</td>
                        <td style={totalCellStyle('extra')}>{formatCurrency(totals.allowances.toFixed(2))}</td>
                        <td style={{ ...totalCellStyle('ded'), background: '#fde8e8', color: '#a31515' }}>{formatCurrency(totals.totalDeductions.toFixed(2))}</td>
                        <td style={{ ...totalCellStyle('earn'), background: '#e6f3e8', color: '#1f6e43' }}>{formatCurrency(totals.netSalary.toFixed(2))}</td>
                        <td style={{ border: '1px solid #d0d0d0', borderLeft: '2px solid #e7e5e4', textAlign: 'center', fontWeight: 400, fontStyle: 'italic', fontSize: 10, color: '#a8a29e', height: 36, verticalAlign: 'middle' }}>
                          {rows.filter(r => r.kraPIN).length} of {rows.length} set
                        </td>
                        <td style={{ border: '1px solid #d0d0d0', textAlign: 'center', fontWeight: 400, fontStyle: 'italic', fontSize: 10, color: '#a8a29e', height: 36, verticalAlign: 'middle' }}>
                          {rows.filter(r => r.bankAccount).length} of {rows.length} set
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sheet period tabs (bottom of sheet, inside container) */}
            <div style={{ height: 28, background: '#e0e0e0', borderTop: '1px solid #d0d0d0', display: 'flex', alignItems: 'flex-end', padding: '0 4px', flexShrink: 0 }}>
              {periods.map((period) => (
                <button
                  key={period}
                  onClick={() => setActivePeriod(period)}
                  style={{
                    padding: '3px 16px',
                    fontSize: 11,
                    background: activePeriod === period ? '#ffffff' : '#d0d0d0',
                    border: '1px solid #bbb',
                    borderBottom: 'none',
                    borderRadius: '3px 3px 0 0',
                    cursor: 'pointer',
                    color: activePeriod === period ? '#217346' : '#57534e',
                    fontWeight: activePeriod === period ? 700 : 400,
                    marginRight: 2,
                    fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                    flexShrink: 0,
                  }}
                >
                  {formatPayPeriod(period)}
                </button>
              ))}
              <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={12} />} onClick={() => void loadSheet()} style={{ marginLeft: 'auto', fontSize: 11, height: 22 }}>
                Refresh
              </Button>
            </div>

            {/* Status bar (Excel-style green bar) */}
            <div style={{ height: 22, background: '#217346', color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 11, flexShrink: 0, fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif" }}>
              <span>
                {isAllBranches ? `All branches · ${branches.length} branches` : isPublished ? 'Published' : 'Draft'} · {rows.length} staff
                {!isAllBranches && statusCounts.saved > 0 && !isPublished && ` · ${statusCounts.saved} saved`}
                {!isAllBranches && statusCounts.dirty > 0 && ` · ${statusCounts.dirty} pending`}
                {!isAllBranches && statusCounts.error > 0 && ` · ${statusCounts.error} error`}
              </span>
              <div style={{ display: 'flex', gap: 20 }}>
                <span><span style={{ opacity: 0.65, marginRight: 4 }}>Gross:</span><strong>Ksh {formatCurrency(totals.grossPay.toFixed(2))}</strong></span>
                <span><span style={{ opacity: 0.65, marginRight: 4 }}>Deductions:</span><strong>Ksh {formatCurrency(totals.totalDeductions.toFixed(2))}</strong></span>
                <span><span style={{ opacity: 0.65, marginRight: 4 }}>Net:</span><strong>Ksh {formatCurrency(totals.netSalary.toFixed(2))}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORDS TAB ───────────────────────────────── */}
      {activeTab === 'records' && (
        <div className="px-6 pt-4 pb-6 space-y-4">
          {/* Filter bar */}
          <div style={{ background: 'white', border: '1px solid #e7e5e4', borderRadius: 16, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
              {/* Pay Period */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a29e' }}>Pay Period</span>
                <input
                  type="month"
                  value={recordPeriod}
                  onChange={(e) => setRecordPeriod(e.target.value)}
                  style={{ height: 32, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 12, color: '#1a0a00', background: 'white', outline: 'none', minWidth: 150 }}
                />
              </div>
              {/* Branch */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a29e' }}>Branch</span>
                <select
                  value={recordBranchId}
                  onChange={(e) => setRecordBranchId(e.target.value)}
                  style={{ height: 32, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 12, color: '#1a0a00', background: 'white', outline: 'none', minWidth: 140, cursor: 'pointer' }}
                >
                  {branchOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {/* Staff Member */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a29e' }}>Staff Member</span>
                <select
                  value={recordStaffId}
                  onChange={(e) => setRecordStaffId(e.target.value)}
                  style={{ height: 32, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 12, color: '#1a0a00', background: 'white', outline: 'none', minWidth: 160, cursor: 'pointer' }}
                >
                  <option value="">All staff</option>
                  {Array.from(new Map(records.map((r) => [r.userId, r.user.name])).entries()).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              {/* Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a29e' }}>Status</span>
                <select
                  value={recordStatus}
                  onChange={(e) => setRecordStatus(e.target.value)}
                  style={{ height: 32, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 12, color: '#1a0a00', background: 'white', outline: 'none', minWidth: 120, cursor: 'pointer' }}
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid #e7e5e4', borderRadius: 16, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
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
        const dataColCount = singleBranch ? 4 : 5; // #, Waiter, [Branch], Orders, Potential Deduction
        const fmtShortDate = (iso: string) =>
          new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });

        // Shared Excel-style cell borders
        const cellBorder = '1px solid #d8d4d0';

        return (
          <div className="px-6 pt-4 pb-6 space-y-3">
            {/* Header row: title + action note + branch filter (compact) */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-3xl">
                <h3 className="text-[14px] font-bold text-[#1a0a00]">Potential Stale-Order Deductions</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-stone-500">
                  Unpaid orders waiters never closed, totalled per waiter. Resolved orders drop off
                  automatically. Key each amount into the <strong>N.C.N.S / Deductions</strong> column on Payroll Entry.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a8a29e' }}>Branch</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  style={{ height: 32, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 12, color: '#1a0a00', background: 'white', outline: 'none', minWidth: 150, cursor: 'pointer' }}
                >
                  {branchOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Excel-style gridlined table */}
            {isLoadingStale ? (
              <div className="rounded-md border border-stone-200 bg-white p-5"><SkeletonTable rows={6} columns={dataColCount} /></div>
            ) : !hasData ? (
              <div className="rounded-md border border-stone-200 bg-white p-12 text-center">
                <p className="text-[13px] font-semibold text-stone-700">No unresolved stale orders</p>
                <p className="mt-1 text-[12px] text-stone-400">Every order in the selected branch has been closed or accounted for.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-[#d8d4d0]">
                <table
                  className="w-full"
                  style={{ borderCollapse: 'collapse', fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif", fontSize: 12.5 }}
                >
                  <thead>
                    <tr style={{ background: '#2e5984', color: 'white' }}>
                      <th style={{ border: cellBorder, padding: '6px 8px', textAlign: 'center', fontWeight: 700, width: 40 }}>#</th>
                      <th style={{ border: cellBorder, padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Waiter</th>
                      {!singleBranch && (
                        <th style={{ border: cellBorder, padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Branch</th>
                      )}
                      <th style={{ border: cellBorder, padding: '6px 10px', textAlign: 'center', fontWeight: 700, width: 90 }}>Orders</th>
                      <th style={{ border: cellBorder, padding: '6px 10px', textAlign: 'right', fontWeight: 700, width: 170 }}>Potential Deduction (Ksh)</th>
                      <th style={{ border: cellBorder, padding: '6px 6px', width: 28 }} aria-label="Expand" />
                    </tr>
                  </thead>
                  <tbody>
                    {waiters.map((waiter, idx) => {
                      const isExpanded = expandedWaiterId === waiter.waiterId;
                      const rowBg = isExpanded ? '#eaf1f8' : idx % 2 === 1 ? '#f6f5f4' : '#ffffff';
                      return (
                        <Fragment key={waiter.waiterId}>
                          <tr
                            onClick={() => setExpandedWaiterId(isExpanded ? null : waiter.waiterId)}
                            style={{ background: rowBg, cursor: 'pointer' }}
                            className="hover:!bg-[#eef3fa]"
                          >
                            <td style={{ border: cellBorder, padding: '5px 8px', textAlign: 'center', color: '#78716c', fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ border: cellBorder, padding: '5px 10px', fontWeight: 600, color: '#1a0a00' }}>{waiter.waiterName}</td>
                            {!singleBranch && <td style={{ border: cellBorder, padding: '5px 10px', color: '#57534e' }}>{waiter.branchName}</td>}
                            <td style={{ border: cellBorder, padding: '5px 10px', textAlign: 'center', color: '#1a0a00' }} className="tabular-nums">{waiter.orderCount}</td>
                            <td style={{ border: cellBorder, padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#a31515' }} className="tabular-nums whitespace-nowrap">{formatCurrency(waiter.totalLiability)}</td>
                            <td style={{ border: cellBorder, padding: '5px 4px', textAlign: 'center', color: '#a8a29e', userSelect: 'none' }}>{isExpanded ? '▾' : '▸'}</td>
                          </tr>

                          {isExpanded && waiter.orders.map((order, oIdx) => (
                            <tr key={order.id} style={{ background: '#fbfaf9' }}>
                              <td style={{ border: cellBorder }} />
                              <td style={{ border: cellBorder, padding: '4px 10px', color: '#57534e' }} className="whitespace-nowrap">
                                <span style={{ color: '#a8a29e', marginRight: 6 }}>{oIdx + 1}.</span>
                                Order #{order.dailyNumber}
                              </td>
                              {!singleBranch && <td style={{ border: cellBorder, padding: '4px 10px', color: '#78716c' }}>{order.branchName}</td>}
                              <td style={{ border: cellBorder, padding: '4px 10px', textAlign: 'center', color: '#78716c' }} className="whitespace-nowrap">
                                {fmtShortDate(order.orderDate)}{order.tableNumber ? ` · T${order.tableNumber}` : ''}
                              </td>
                              <td style={{ border: cellBorder, padding: '4px 10px', textAlign: 'right', color: '#a31515', fontWeight: 600 }} className="tabular-nums whitespace-nowrap">{formatCurrency(order.total)}</td>
                              <td style={{ border: cellBorder }} />
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}

                    {/* Totals row */}
                    <tr style={{ background: '#dce6f1', fontWeight: 700 }}>
                      <td style={{ border: cellBorder, padding: '6px 8px' }} />
                      <td style={{ border: cellBorder, padding: '6px 10px', color: '#1a0a00', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>Total</td>
                      {!singleBranch && <td style={{ border: cellBorder }} />}
                      <td style={{ border: cellBorder, padding: '6px 10px', textAlign: 'center', color: '#1a0a00' }} className="tabular-nums">{staleSummary!.totalOrders}</td>
                      <td style={{ border: cellBorder, padding: '6px 10px', textAlign: 'right', color: '#a31515' }} className="tabular-nums whitespace-nowrap">Ksh {formatCurrency(staleSummary!.totalLiability)}</td>
                      <td style={{ border: cellBorder }} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {hasData && (
              <p className="text-[11px] text-stone-400">
                {staleSummary!.totalWaiters} waiter{staleSummary!.totalWaiters > 1 ? 's' : ''} ·
                {' '}{staleSummary!.totalOrders} unresolved order{staleSummary!.totalOrders > 1 ? 's' : ''} ·
                {' '}click a row to view individual orders
              </p>
            )}
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
        isOpen={showNotifyConfirm}
        onClose={() => setShowNotifyConfirm(false)}
        onConfirm={() => void handleNotifyMissing()}
        title={`Notify ${missingBankDetails.length} staff about missing details?`}
        description={`Each affected staff member will receive a formal notice asking them to add their bank account and KRA PIN under Profile → Payment Details.`}
        confirmLabel={`Send ${missingBankDetails.length} notice${missingBankDetails.length === 1 ? '' : 's'}`}
        isLoading={isNotifying}
      />
      <PayslipDetailModal
        payslip={selectedPayslip}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </PageLayout>
  );
}

/* ── Style helper functions (keep out of render) ─── */
function colHdrStyle(accentColor: string): React.CSSProperties {
  return {
    background: '#f0f0f0',
    border: '1px solid #d0d0d0',
    borderTop: `3px solid ${accentColor}`,
    height: 40,
    fontSize: 10.5,
    fontWeight: 700,
    textAlign: 'center',
    verticalAlign: 'middle',
    color: '#555',
    padding: '2px 4px',
    lineHeight: 1.3,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    position: 'sticky',
    top: 22,
    zIndex: 9,
  };
}

function rownumCellStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: '1px solid #d0d0d0',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: 11,
    color: '#555',
    position: 'sticky',
    left: 0,
    zIndex: 5,
    padding: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    height: 40,
  };
}

function cellStyle(bg: string): React.CSSProperties {
  return {
    border: '1px solid #d0d0d0',
    padding: 0,
    verticalAlign: 'middle',
    height: 40,
    background: bg,
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
  fontSize: 12,
  color: '#1a0a00',
  textAlign: 'right',
  padding: '0 6px',
};

function totalCellStyle(type: 'earn' | 'ded' | 'extra'): React.CSSProperties {
  const colors = {
    earn: '#1f6e43',
    ded: '#a31515',
    extra: '#5b2d8e',
  };
  return {
    border: '1px solid #d0d0d0',
    textAlign: 'right',
    paddingRight: 7,
    fontWeight: 700,
    fontSize: 12,
    verticalAlign: 'middle',
    height: 36,
    color: colors[type],
    background: '#f0f0f0',
  };
}
