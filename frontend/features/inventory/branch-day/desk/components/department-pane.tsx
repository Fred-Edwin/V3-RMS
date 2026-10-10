'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui2/select';
import { BRANCH_DAY_MESSAGES } from '../../_shared/lib/branch-day-copy';
import type { DepartmentFigures, DepartmentTile, FigureLine } from '../../_shared/types/branch-day-contract';
import { clock12, kes, qty } from '../lib/desk-format';
import { MonoLabel } from './day-parts';

const SQUARE = 'size-1.5 shrink-0';

/** The department rail of Paper B6 and B11 (one set of numbers, C14): 272 wide, a row per department, the selected one on caramel with the edge. */
export function DepartmentRail({ rail, selectedId, hrefFor, showMoney, branchTotal }: { rail: readonly DepartmentTile[]; selectedId: string; hrefFor: (departmentId: string) => string; showMoney: boolean; branchTotal?: string | null }) {
  const nav = React.useRef<HTMLElement>(null);
  const onKeyDown = (event: React.KeyboardEvent): void => {
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!delta || !nav.current) return;
    const links = Array.from(nav.current.querySelectorAll<HTMLAnchorElement>('a[data-rail]'));
    const at = links.findIndex((l) => l === document.activeElement);
    const next = links[at + delta];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };
  return (
    <nav ref={nav} aria-label="Departments" onKeyDown={onKeyDown} className="hidden w-[272px] shrink-0 flex-col border-r border-wds-text-ink lg:flex">
      <ul className="m-0 flex list-none flex-col p-0">
        {rail.map((t) => {
          const counted = t.state === 'COUNTED';
          const selected = t.departmentId === selectedId;
          return (
            <li key={t.departmentId}>
              <Link
                data-rail
                href={hrefFor(t.departmentId)}
                replace
                scroll={false}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'flex flex-col gap-[3px] border-b border-wds-border px-4 py-3.5 outline-none transition-colors duration-150 ease-out focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]',
                  selected ? 'bg-wds-caramel-100 shadow-[inset_3px_0_0_0_var(--wds-selected-edge)]' : 'active:bg-wds-neutral-100 [@media(hover:hover)]:hover:bg-wds-neutral-50',
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{t.name}</span>
                  {showMoney ? <span className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">{counted ? kes(t.usedValueKes ?? null) : '–'}</span> : null}
                </span>
                <span className="flex items-center gap-1.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                  {counted ? <span className={cn(SQUARE, 'bg-wds-success-fg')} aria-hidden="true" /> : <span className={cn(SQUARE, 'box-border border-[1.5px] border-[#8D8982]')} aria-hidden="true" />}
                  {counted ? `Counted ${t.countedAt ? clock12(t.countedAt) : ''}` : 'Not counted'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {showMoney && branchTotal !== undefined ? (
        <div className="mt-auto flex items-baseline justify-between border-t border-wds-text-ink px-4 py-3.5">
          <MonoLabel>Branch used value (KES)</MonoLabel>
          <span className="font-wds-mono text-[14px] font-semibold leading-[18px] text-wds-text-ink">{kes(branchTotal)}</span>
        </div>
      ) : null}
    </nav>
  );
}

/** Below 1024 the rail is a select above the table (gap G27). */
export function DepartmentSelect({ rail, selectedId, onSelect }: { rail: readonly DepartmentTile[]; selectedId: string; onSelect: (departmentId: string) => void }) {
  const current = rail.find((t) => t.departmentId === selectedId);
  return (
    <div className="px-4 pt-4 lg:hidden">
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger aria-label="Department" className="h-9 w-auto gap-2 !rounded-none border-wds-border-strong px-3 text-[14px] leading-[18px]">
          <span>Department: {current?.name}</span>
        </SelectTrigger>
        <SelectContent>
          {rail.map((t) => (
            <SelectItem key={t.departmentId} value={t.departmentId}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const NUM = 'text-right font-wds-mono text-[14px] leading-[18px]';
const HEAD = 'px-1.5 pb-2.5 text-right align-bottom font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary';

/**
 * The figures table of Paper B6 and B11: the nine columns and their widths, 58 high rows, the total row and the footnote. Money columns exist
 * only where the lines carry money (`catalog.see_costs`). A corrected line is marked and shows both closing figures.
 */
export function FiguresTable({ figures, showMoney }: { figures: DepartmentFigures['department']; showMoney: boolean }) {
  const counted = figures.state === 'COUNTED';
  const waste = figures.waste;
  return (
    <div className="flex min-w-0 flex-col">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] table-fixed border-collapse" aria-label={`${figures.name} figures`}>
          <colgroup>
            <col />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[60px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[80px]" />
            {showMoney ? <col className="w-[80px]" /> : null}
            {showMoney ? <col className="w-[106px]" /> : null}
          </colgroup>
          <thead>
            <tr className="border-b border-wds-text-ink">
              <th scope="col" className="pb-2.5 pl-2 pr-1.5 text-left align-bottom font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Item</th>
              <th scope="col" className={HEAD}>Opening stock</th>
              <th scope="col" className={HEAD}>Received</th>
              <th scope="col" className={HEAD}>Waste</th>
              <th scope="col" className={HEAD}>Closing stock</th>
              <th scope="col" className={cn(HEAD, 'text-wds-text-ink')}>Used today</th>
              <th scope="col" className={HEAD}>Yesterday</th>
              {showMoney ? <th scope="col" className={HEAD}>Used value (KES)</th> : null}
              {showMoney ? <th scope="col" className={cn(HEAD, 'pr-2')}>Closing stock value (KES)</th> : null}
            </tr>
          </thead>
          <tbody>
            {figures.lines.map((l) => (
              <FigureRow key={l.itemId} line={l} showMoney={showMoney} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-b border-wds-text-ink">
              <td colSpan={6} className="px-2 py-3 align-middle font-wds-sans text-[13px] leading-5 text-wds-text-secondary">
                {waste.entryCount === 0 ? 'Waste: none today' : `Waste: ${waste.entryCount} ${waste.entryCount === 1 ? 'entry' : 'entries'}${waste.items.length > 0 ? ` (${waste.items.map((w) => (w.reasonText ? `${w.itemName}, ${w.reasonText}` : w.itemName)).join('; ')})` : ''}`}
              </td>
              {showMoney && figures.totals ? (
                <>
                  <td className="px-1.5 py-3 text-right align-middle leading-5"><MonoLabel className="block">Total</MonoLabel></td>
                  <td className="px-1.5 py-3 text-right align-middle font-wds-mono text-[14px] font-semibold leading-5 text-wds-text-ink">{counted ? kes(figures.totals.usedValueKes) : '–'}</td>
                  <td className="py-3 pl-1.5 pr-2 text-right align-middle font-wds-mono text-[14px] font-semibold leading-5 text-wds-text-ink">{counted ? kes(figures.totals.closingValueKes) : '–'}</td>
                </>
              ) : (
                <td />
              )}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="m-0 px-2 pt-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{BRANCH_DAY_MESSAGES.usedTodayRule}</p>
    </div>
  );
}

function FigureRow({ line, showMoney }: { line: FigureLine; showMoney: boolean }) {
  const zeroValue = line.usedValueKes !== undefined && line.usedValueKes !== null && Number(line.usedValueKes) === 0;
  const corrected = line.correction !== null;
  return (
    <tr className={cn('h-[58px] border-b border-wds-border align-middle', corrected && 'bg-wds-warning-bg')}>
      <td className="py-[11px] pl-2 pr-1.5">
        <div className="flex flex-col gap-px">
          <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
            {line.itemName}
            {corrected ? <span aria-label=", corrected"> *</span> : null}
          </span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{line.unit}</span>
        </div>
      </td>
      <td className={cn(NUM, 'px-1.5 text-wds-text-ink')}>{qty(line.openingQty)}</td>
      <td className={cn(NUM, 'px-1.5 text-wds-text-ink')}>{qty(line.receivedQty)}</td>
      <td className={cn(NUM, 'px-1.5 text-wds-text-ink')}>{qty(line.wasteQty)}</td>
      <td className={cn(NUM, 'px-1.5 text-wds-text-ink')}>{qty(line.closingQty)}</td>
      <td className={cn(NUM, 'px-1.5 font-semibold text-wds-text-ink')}>{qty(line.usedQty)}</td>
      <td className={cn(NUM, 'px-1.5 text-wds-text-secondary')}>{qty(line.yesterdayUsedQty)}</td>
      {showMoney ? <td className={cn(NUM, 'px-1.5', zeroValue ? 'text-[#8D8982]' : 'text-wds-text-ink')}>{kes(line.usedValueKes ?? null)}</td> : null}
      {showMoney ? <td className={cn(NUM, 'pl-1.5 pr-2 text-wds-text-ink')}>{kes(line.closingValueKes ?? null)}</td> : null}
    </tr>
  );
}

/** The opening and delivery facts at the right of a department's head (Paper B6). */
export function PaneFacts({ figures }: { figures: DepartmentFigures['department'] }) {
  const opening = figures.opening;
  const delivery = figures.delivery;
  const openingText =
    opening.state === 'NOT_CHECKED'
      ? 'Not checked'
      : opening.differences.length === 0
        ? `Checked ${opening.checkedAt ? clock12(opening.checkedAt) : ''}, no difference`
        : `Checked ${opening.checkedAt ? clock12(opening.checkedAt) : ''}, ${opening.differences.length === 1 ? `${opening.differences[0]?.itemName} ${Math.abs(Number(opening.differences[0]?.difference))} ${Number(opening.differences[0]?.difference) < 0 ? 'less' : 'more'}` : `${opening.differences.length} differences`}`;
  const deliveryText =
    delivery.state === 'CONFIRMED' ? `Confirmed ${delivery.confirmedAt ? clock12(delivery.confirmedAt) : ''}` : delivery.state === 'WAITING' ? `Waiting: ${delivery.dispatches.map((d) => d.reference).join(', ')}` : 'No delivery today';
  return (
    <div className="flex shrink-0 items-start gap-6">
      <div className="flex flex-col gap-0.5">
        <MonoLabel>Opening</MonoLabel>
        <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{openingText}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <MonoLabel>Delivery</MonoLabel>
        <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{deliveryText}</span>
      </div>
    </div>
  );
}
