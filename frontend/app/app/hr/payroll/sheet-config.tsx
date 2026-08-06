'use client';

import { cn } from '@/lib/cn';
import { SheetCell, sheetCellBackground, FillHandle } from '@/components/ui/sheet';
import type { SheetCellTint, SheetColumnGroup, SheetEngine, SheetRowContext } from '@/components/ui/sheet';
import { formatCurrency } from '@/components/payslips/payslip-utils';
import { computeRow, type EditableColumnKey, type PayrollTotals, type RowState, type SheetRow } from './payroll-sheet';

export type StaffDetailField = 'kraPIN' | 'shifNhifNumber' | 'nssfNumber' | 'bankName' | 'accountNumber';

export interface PayrollSheetOptions {
  engine: SheetEngine<EditableColumnKey>;
  /** e.g. "APRIL 2026" — shown in the frozen title band */
  periodLabel: string;
  /** Consolidated view appends the branch to each row's role line */
  isAllBranches: boolean;
  totals: PayrollTotals;
  staffDetailState: Record<string, RowState>;
  onMoneyChange: (userId: string, field: EditableColumnKey, value: string) => void;
  onStaffDetailChange: (userId: string, field: StaffDetailField, value: string) => void;
  onStaffDetailBlur: (userId: string) => void;
}

const money = (value: number): string => formatCurrency(value.toFixed(2));

type Ctx = SheetRowContext<SheetRow>;

/**
 * Column groups for the payroll entry sheet. All styling comes from the
 * Sheet/SheetCell primitives and `sheet.*` tokens; this file only decides
 * which columns exist and how their cells behave.
 */
export function buildPayrollGroups(opts: PayrollSheetOptions): SheetColumnGroup<SheetRow>[] {
  const { engine, totals } = opts;

  const coord = (ctx: Ctx, columnKey: EditableColumnKey) => ({ rowIndex: ctx.rowIndex, columnKey });

  const moneyColumn = (
    key: EditableColumnKey,
    header: React.ReactNode,
    width: number,
    tint: SheetCellTint,
    total: () => number,
    totalClassName: string,
    placeholder = '0'
  ) => ({
    key,
    header,
    width,
    renderCell: (ctx: Ctx) => (
      <SheetCell
        cell={coord(ctx, key)}
        engine={engine}
        value={ctx.row[key]}
        onChange={(value) => opts.onMoneyChange(ctx.row.userId, key, value)}
        locked={ctx.locked}
        disabled={ctx.disabled}
        tint={tint}
        zebra={ctx.zebra}
        placeholder={placeholder}
        className="group-hover:bg-sheet-hover"
      />
    ),
    renderTotal: () => money(total()),
    totalClassName,
  });

  /* ── Identity (frozen) ─────────────────────────────────────────── */

  const nameColumn = {
    key: 'name',
    header: 'NAME',
    width: 200,
    renderCell: (ctx: Ctx) => (
      <td
        className={cn(
          'sticky left-8 z-[4] h-10 overflow-hidden border border-sheet-grid-dense border-r-2 border-r-stone-300 px-2 align-middle',
          ctx.locked ? 'bg-sheet-locked' : ctx.zebra ? 'bg-sheet-zebra-dense' : 'bg-white',
          'group-hover:bg-sheet-hover'
        )}
      >
        <div className="flex items-center gap-1 overflow-hidden">
          <span
            className={cn(
              'truncate font-semibold',
              ctx.locked ? 'text-stone-400' : 'text-office-ink'
            )}
          >
            {ctx.row.name}
          </span>
          {ctx.row.carriedOver && (
            <span
              title="Figures carried over from the previous month — review and save"
              className="shrink-0 rounded-sm border border-blue-200 bg-blue-50 px-1 text-[8.5px] font-bold uppercase tracking-wide leading-tight text-sheet-active"
            >
              Carried
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-stone-400">
          {ctx.row.role}
          {opts.isAllBranches && ctx.row.branchName ? ` · ${ctx.row.branchName}` : ''}
        </div>
      </td>
    ),
    renderTotal: () => (
      <span className="text-label-sm font-semibold uppercase tracking-wide text-stone-600">Totals</span>
    ),
    totalClassName: 'border-r-2 border-r-stone-300',
  };

  /* ── N.C.N.S — stacked amount + note in one visual cell ────────── */

  const ncnsColumn = {
    key: 'ncnsAmount',
    header: (
      <>
        N.C.N.S /<br />Deductions
      </>
    ),
    width: 170,
    renderCell: (ctx: Ctx) => {
      const amountCell = coord(ctx, 'ncnsAmount');
      const noteCell = coord(ctx, 'ncnsNote');
      const amountSelected = engine.isCellSelected(amountCell);
      const noteSelected = engine.isCellSelected(noteCell);

      return (
        <td
          {...engine.cellMouseProps(amountCell)}
          className={cn(
            'relative h-10 border border-sheet-grid-dense p-0 align-middle',
            sheetCellBackground('red', ctx.zebra, ctx.locked, amountSelected),
            engine.isCellActive(amountCell)
              ? 'ring-2 ring-inset ring-sheet-active'
              : amountSelected && 'ring-1 ring-inset ring-sheet-selection-ring',
            'group-hover:bg-sheet-hover'
          )}
        >
          <div className="flex h-10 flex-col">
            <div className="flex flex-1 items-center">
              <input
                {...engine.inputProps(amountCell)}
                disabled={ctx.disabled}
                value={ctx.row.ncnsAmount}
                placeholder="0"
                inputMode="decimal"
                onChange={(e) => opts.onMoneyChange(ctx.row.userId, 'ncnsAmount', e.target.value)}
                className="h-full w-full bg-transparent px-1.5 text-right font-sheet text-sheet-cell tabular-nums text-office-ink placeholder:text-stone-300 focus:outline-none disabled:cursor-not-allowed disabled:text-stone-400"
              />
            </div>
            <div
              {...engine.cellMouseProps(noteCell)}
              className={cn(
                'relative flex h-4 items-center border-t border-dashed border-stone-200',
                noteSelected && 'bg-sheet-selection',
                engine.isCellActive(noteCell) && 'ring-2 ring-inset ring-sheet-active'
              )}
            >
              <input
                {...engine.inputProps(noteCell)}
                disabled={ctx.disabled}
                value={ctx.row.ncnsNote}
                placeholder="note…"
                onChange={(e) => opts.onMoneyChange(ctx.row.userId, 'ncnsNote', e.target.value)}
                className="h-full w-full bg-transparent px-1.5 text-right font-sheet text-sheet-band italic text-stone-400 placeholder:text-stone-300 focus:outline-none disabled:cursor-not-allowed"
              />
              {engine.hasFillHandle(noteCell) && <FillHandle onMouseDown={engine.startFill} />}
            </div>
          </div>
          {engine.hasFillHandle(amountCell) && <FillHandle onMouseDown={engine.startFill} />}
        </td>
      );
    },
    renderTotal: () => money(totals.ncnsAmount),
    totalClassName: 'text-sheet-band-red',
  };

  /* ── Computed (read-only) ──────────────────────────────────────── */

  const computedColumn = (
    key: string,
    header: React.ReactNode,
    compute: (row: SheetRow) => { show: boolean; value: number },
    palette: { bg: string; text: string },
    total: () => number
  ) => ({
    key,
    header,
    width: 100,
    headerClassName: 'bg-sheet-totals',
    renderCell: (ctx: Ctx) => {
      const { show, value } = compute(ctx.row);
      return (
        <td
          className={cn(
            'h-10 border border-sheet-grid-dense pr-1.5 text-right align-middle font-sheet text-sheet-cell font-bold tabular-nums',
            palette.bg,
            palette.text,
            ctx.locked && 'opacity-50',
            'group-hover:bg-sheet-hover'
          )}
        >
          {show ? money(value) : <span className="font-normal text-stone-300">—</span>}
        </td>
      );
    },
    renderTotal: () => money(total()),
    totalClassName: cn(palette.bg, palette.text),
  });

  /* ── Staff payment details (separate save path) ────────────────── */

  const staffDetailColumn = (
    field: StaffDetailField,
    header: React.ReactNode,
    width: number,
    options: { leftDivider?: boolean; showSaveDot?: boolean } = {}
  ) => ({
    key: field,
    header,
    width,
    headerClassName: 'bg-sheet-locked text-stone-500',
    renderCell: (ctx: Ctx) => {
      const value = ctx.row[field] ?? '';
      const detailState = opts.staffDetailState[ctx.row.userId];
      return (
        <td
          className={cn(
            'relative h-10 border border-sheet-grid-dense p-0 align-middle',
            options.leftDivider && 'border-l-2 border-l-stone-200',
            value ? 'bg-office-canvas' : 'bg-warning-bg',
            'group-hover:bg-sheet-hover'
          )}
        >
          <input
            value={value}
            placeholder="Not set"
            onChange={(e) => opts.onStaffDetailChange(ctx.row.userId, field, e.target.value)}
            onBlur={() => opts.onStaffDetailBlur(ctx.row.userId)}
            className="h-full w-full bg-transparent px-1.5 text-center font-sheet text-sheet-header font-normal text-stone-600 placeholder:text-stone-300 focus:outline-none"
          />
          {options.showSaveDot && detailState && detailState !== 'saved' && (
            <span
              title={detailState === 'error' ? 'Save failed' : detailState === 'saving' ? 'Saving…' : 'Unsaved'}
              className={cn(
                'absolute right-1 top-1 h-1 w-1 rounded-full',
                detailState === 'error' ? 'bg-sheet-dot-error' : 'bg-sheet-dot-pending'
              )}
            />
          )}
        </td>
      );
    },
    renderTotal: (rows: SheetRow[]) => (
      <span>{rows.filter((r) => r[field]).length} of {rows.length} set</span>
    ),
    totalClassName: cn(
      'text-center font-normal italic text-sheet-band text-stone-400',
      options.leftDivider && 'border-l-2 border-l-stone-200'
    ),
  });

  /* ── Assemble the groups ───────────────────────────────────────── */

  return [
    {
      label: <>EMPLOYEES PAYROLLS — {opts.periodLabel}</>,
      tone: 'navy',
      columns: [nameColumn],
    },
    {
      label: 'Earnings',
      tone: 'green',
      columns: [
        moneyColumn(
          'grossPay',
          <>GROSS<br />Salary</>,
          92,
          'green',
          () => totals.grossPay,
          'text-sheet-band-green'
        ),
      ],
    },
    {
      label: 'Deductions',
      tone: 'red',
      columns: [
        moneyColumn('paye', 'PAYE', 84, 'red', () => totals.paye, 'text-sheet-band-red'),
        moneyColumn('sha', <>SHA<br />(NHIF)</>, 84, 'red', () => totals.sha, 'text-sheet-band-red'),
        moneyColumn('nssfTier1', <>NSSF<br />(Tier 1)</>, 84, 'red', () => totals.nssfTier1, 'text-sheet-band-red'),
        moneyColumn('nssfTier2', <>NSSF<br />(Tier 2)</>, 84, 'red', () => totals.nssfTier2, 'text-sheet-band-red'),
        moneyColumn('housingLevy', <>Housing<br />Levy</>, 84, 'red', () => totals.housingLevy, 'text-sheet-band-red'),
        ncnsColumn,
      ],
    },
    {
      label: 'Extras',
      tone: 'purple',
      columns: [
        moneyColumn('advance', 'Advance', 84, 'purple', () => totals.advance, 'text-sheet-band-purple', '—'),
        moneyColumn('incentives', 'Incentives', 84, 'purple', () => totals.incentives, 'text-sheet-band-purple', '—'),
        moneyColumn('overtime', 'O.T', 84, 'purple', () => totals.overtime, 'text-sheet-band-purple', '—'),
        moneyColumn('allowances', 'Allowances', 100, 'purple', () => totals.allowances, 'text-sheet-band-purple', '—'),
      ],
    },
    {
      label: 'Computed',
      tone: 'teal',
      dataTour: 'computed',
      columns: [
        computedColumn(
          'totalDeductions',
          <>Total<br />Deductions</>,
          (row) => {
            const { totalDeductions } = computeRow(row);
            return { show: Number(row.grossPay || 0) + totalDeductions !== 0, value: totalDeductions };
          },
          { bg: 'bg-sheet-tint-red-strong', text: 'text-sheet-band-red' },
          () => totals.totalDeductions
        ),
        computedColumn(
          'netSalary',
          <>Net<br />Salary</>,
          (row) => {
            const { netSalary } = computeRow(row);
            return { show: Number(row.grossPay || 0) !== 0, value: netSalary };
          },
          { bg: 'bg-sheet-tint-green-strong', text: 'text-sheet-band-green' },
          () => totals.netSalary
        ),
      ],
    },
    {
      label: 'Staff Details',
      tone: 'gray',
      dataTour: 'staff-details',
      columns: [
        staffDetailColumn('kraPIN', 'KRA PIN', 140, { leftDivider: true }),
        staffDetailColumn('shifNhifNumber', <>SHIF / NHIF<br />Number</>, 140),
        staffDetailColumn('nssfNumber', <>NSSF<br />Number</>, 140),
        staffDetailColumn('bankName', <>Bank<br />Name</>, 150),
        staffDetailColumn('accountNumber', <>Account<br />Number</>, 150, { showSaveDot: true }),
      ],
    },
  ];
}
