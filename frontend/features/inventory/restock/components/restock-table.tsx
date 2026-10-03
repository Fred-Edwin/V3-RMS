import * as React from 'react';

import { cn } from '@/lib/cn';
import type { RestockLevelRow, RestockStatus } from '../../types';
import { formatNumber } from '../../_shared/components/stock-format';
import {
  SUGGESTION_VERDICT_LABEL,
  levelNumber,
  parseLevelInput,
  suggestedPerDay,
  suggestionVerdict,
  type SuggestionVerdict,
} from '../lib/restock-logic';

const headCell = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink';

const STATUS_WORD: Record<RestockStatus, string> = { OUT: 'Out', LOW: 'Low', OK: 'OK', NO_LEVEL: 'No level' };
const STATUS_TEXT: Record<RestockStatus, string> = {
  OUT: 'text-wds-error-fg',
  LOW: 'text-wds-warning-fg',
  OK: 'text-wds-success-fg',
  NO_LEVEL: 'text-wds-text-secondary',
};
const STATUS_DOT: Record<RestockStatus, string> = {
  OUT: 'bg-wds-error-fg',
  LOW: 'bg-wds-warning-fg',
  OK: 'bg-wds-success-fg',
  NO_LEVEL: 'bg-wds-neutral-300',
};

/** The level as a plain number in a field: "150.0000" → "150". */
export const levelText = (level: string | null): string => (level === null ? '' : String(Number.parseFloat(level)));

function StatusCell({ status }: { status: RestockStatus }) {
  return (
    <span className="flex w-[110px] shrink-0 items-center gap-[7px] pl-6">
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', STATUS_DOT[status])} />
      <span className={cn('font-wds-sans text-[13px] leading-4', STATUS_TEXT[status])}>{STATUS_WORD[status]}</span>
    </span>
  );
}

const VERDICT_TEXT: Record<SuggestionVerdict, string> = {
  APPLIED: 'text-wds-success-fg',
  MATCHES: 'text-wds-text-faint',
  CLOSE: 'text-wds-text-faint',
  HIGHER: 'text-wds-text-faint',
  LOWER: 'text-wds-text-faint',
};

/**
 * The suggestion cell. The figure is a button: tapping it puts the suggestion in the level field.
 * The second line names the days of cover the suggestion used: the item's own, or 15 (§30.8).
 */
function SuggestionCell({ row, typed, onUse }: { row: RestockLevelRow; typed: number | null; onUse: () => void }) {
  const suggested = levelNumber(row.suggestedLevel);
  if (suggested === null) {
    return (
      <span className="w-[290px] shrink-0 pl-6 font-wds-sans text-[12px] leading-4 text-wds-text-faint">
        {row.suggestionNote === 'NEEDS_HISTORY' ? 'Needs 14 days of use first' : 'No use recorded yet'}
      </span>
    );
  }
  const verdict = suggestionVerdict(levelNumber(row.level), typed, suggested);
  const usable = verdict !== 'APPLIED' && verdict !== 'MATCHES';
  const figure = `${formatNumber(suggested)} ${row.usageUnit}`;
  return (
    <span className="flex w-[290px] shrink-0 flex-col gap-0.5 pl-6">
      <span className={cn('font-wds-mono text-[13px] leading-4', verdict ? VERDICT_TEXT[verdict] : 'text-wds-text-ink')}>
        {usable ? (
          <button
            type="button"
            onClick={onUse}
            title={`Use ${figure} as the level`}
            className="-mx-1 rounded-wds-sm px-1 underline decoration-wds-neutral-300 underline-offset-[3px] transition-colors hover:text-wds-text-ink hover:decoration-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring"
          >
            {figure}
          </button>
        ) : (
          figure
        )}
        {verdict ? ` · ${SUGGESTION_VERDICT_LABEL[verdict]}` : null}
      </span>
      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {formatNumber(suggestedPerDay(suggested, Number.parseFloat(row.daysOfCover)))} {row.usageUnit} a day, {formatNumber(row.daysOfCover)} {Number.parseFloat(row.daysOfCover) === 1 ? 'day' : 'days'} of cover
      </span>
    </span>
  );
}

export interface RestockTableProps {
  rows: RestockLevelRow[];
  /** What each edited field holds, as typed. */
  edits: Record<string, string>;
  onLevelChange: (inventoryItemId: string, text: string) => void;
  /** An item's name opens its change history. */
  onOpenHistory: (row: RestockLevelRow) => void;
  className?: string;
}

/**
 * Restock levels table — Paper step 11. An ink rule under the header, 54px rows. A changed row is tinted
 * and its field carries the saved level ("150 →") and the selected edge, so a change reads at a glance.
 */
export function RestockTable({ rows, edits, onLevelChange, onOpenHistory, className }: RestockTableProps) {
  return (
    <div role="table" aria-label="Restock levels" className={cn('min-w-[1020px] border border-wds-border bg-white', className)}>
      <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
        <span role="columnheader" className={cn(headCell, 'min-w-0 grow basis-0')}>
          ITEM
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[110px] shrink-0 text-right')}>
          ON HAND
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[110px] shrink-0 pl-6')}>
          STATUS
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[190px] shrink-0 text-center')}>
          RESTOCK LEVEL
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[290px] shrink-0 pl-6')}>
          SUGGESTED FROM RECENT USE
        </span>
      </div>
      {rows.map((row) => {
        const id = row.inventoryItemId;
        const saved = levelNumber(row.level);
        const edited = id in edits;
        const text = edited ? edits[id] : levelText(row.level);
        const parsed = parseLevelInput(text);
        const invalid = !parsed.ok;
        const typed = parsed.ok ? parsed.level : saved;
        const changed = edited && parsed.ok && parsed.level !== saved;
        const errorId = `restock-error-${id}`;
        return (
          <div
            key={id}
            role="row"
            className={cn('flex h-[54px] items-center border-b border-wds-neutral-100 px-4 last:border-b-0', changed && 'bg-wds-espresso-50')}
          >
            <span role="cell" className="flex min-w-0 grow basis-0 flex-col items-start gap-0.5">
              <button
                type="button"
                onClick={() => onOpenHistory(row)}
                title="Change history"
                className="max-w-full truncate rounded-wds-sm text-left font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink transition-colors hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:shadow-wds-ring"
              >
                {row.itemName}
              </button>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-faint">
                {row.usageUnit}
                {row.itemType === 'PREPPED' ? ' · Prepped' : ''}
              </span>
            </span>
            <span role="cell" className="w-[110px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">
              {formatNumber(row.onHandQty)}
            </span>
            <span role="cell" className="contents">
              <StatusCell status={row.status} />
            </span>
            <span role="cell" className="flex w-[190px] shrink-0 items-center justify-center gap-2">
              {changed ? (
                <span className="font-wds-mono text-[12px] leading-4 text-wds-text-faint">{saved === null ? 'none' : formatNumber(saved)} →</span>
              ) : null}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={text}
                aria-label={`Restock level for ${row.itemName}, in ${row.usageUnit}`}
                aria-invalid={invalid || undefined}
                title={invalid ? parsed.message : undefined}
                aria-describedby={invalid ? errorId : undefined}
                placeholder="—"
                onChange={(e) => onLevelChange(id, e.target.value)}
                className={cn(
                  'h-8 w-[84px] shrink-0 border bg-white px-2 text-center font-wds-mono text-[13px] leading-4 text-wds-text-ink placeholder:text-wds-text-faint',
                  'transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)]',
                  invalid ? 'border-wds-error-fg focus-visible:border-wds-error-fg focus-visible:shadow-[0_0_0_1px_var(--wds-error-fg)]' : changed ? 'border-[1.5px] border-wds-selected-edge font-semibold' : 'border-wds-border-strong'
                )}
              />
              {invalid ? (
                <span id={errorId} className="sr-only">
                  {parsed.message}
                </span>
              ) : null}
            </span>
            <span role="cell" className="contents">
              <SuggestionCell row={row} typed={typed} onUse={() => onLevelChange(id, levelText(row.suggestedLevel))} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
