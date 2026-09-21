'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { RequisitionSectionLine } from '../types';

/**
 * Category-grouped requisition line grid — the fill screen's (`10PT-0`
 * family) main body, mobile only. Built from the real Paper node read live
 * this session (`get_jsx` on `10PT-0`/`10J9-0`/`10RO-0`/`10TV-0`), not
 * inferred:
 *
 * - Category header rows: neutral-50 bg, bottom hairline, mono uppercase
 *   label ("CHICKEN", "BEEF", …).
 * - Item row: name + "par N unit" caption (the "on hand X ·" prefix and the
 *   par-minus-on-hand pre-fill are dropped per this milestone's approved
 *   deviation — session-a-plan.md §0/§1.2's caption note), stepper control
 *   (−/qty/+, `wds-border-strong` default), trailing delete icon.
 * - Edited-line treatment (observed on `10PT-0`'s "Beef Patty" row): the
 *   stepper container gets a 1.5px `wds-primary` border and the qty text
 *   goes bold/ink-colored; an "↗ changed from N" caption renders under the
 *   item name in warning tone. Unedited: default border, regular-weight qty
 *   text, no extra caption.
 * - Two-level grouping (parent category -> category) renders only when a
 *   line actually carries a `parentCategoryName` — collapses to the
 *   single-level rendering otherwise (every screen this session saw,
 *   including the real Kitchen example, is flat).
 *
 * Read-only mode (submitted/returned-locked states) disables the stepper
 * and delete icon and mutes their tone, matching `10RO-0`'s faint/disabled
 * treatment.
 */
export interface CategoryGroupedLineGridProps {
  lines: RequisitionSectionLine[];
  /** Original requestedQty by line id, to compute the "changed from N" caption. Lines not in this map are treated as unedited. */
  originalQtyByLineId?: Record<string, string | null>;
  onQtyChange: (lineId: string, value: string | null) => void;
  onDeleteLine: (lineId: string) => void;
  /** Whether a given line can actually be removed — only a not-yet-saved draft line can (Session A has no server-side delete for a persisted line). Defaults to true (always deletable) when omitted. */
  canDeleteLine?: (lineId: string) => boolean;
  readOnly?: boolean;
  className?: string;
}

function parCaption(line: RequisitionSectionLine): string {
  if (line.parAtRequest === null) return `par — ${line.usageUnit}`;
  return `par ${line.parAtRequest} ${line.usageUnit}`;
}

function stepValue(current: string | null, delta: number): string {
  const n = current === null || current === '' ? 0 : Number.parseFloat(current);
  const next = Math.max(0, n + delta);
  return String(next);
}

function LineRow({
  line,
  changedFrom,
  onQtyChange,
  onDeleteLine,
  canDelete,
  readOnly,
}: {
  line: RequisitionSectionLine;
  changedFrom: string | null;
  onQtyChange: (lineId: string, value: string | null) => void;
  onDeleteLine: (lineId: string) => void;
  canDelete: boolean;
  readOnly: boolean;
}) {
  const isEdited = changedFrom !== null;
  const displayQty = line.requestedQty ?? '0';

  return (
    <div className="flex items-center gap-2.5 border-b border-b-wds-neutral-100 p-3.5 last:border-b-0">
      <div className="flex min-w-0 grow basis-0 flex-col gap-0.75">
        <div
          className={cn(
            'font-wds-sans text-wds-body font-medium',
            readOnly ? 'text-wds-text-muted' : 'text-wds-text-ink',
          )}
        >
          {line.itemName}
        </div>
        <div className="font-wds-mono text-wds-label text-wds-neutral-500">{parCaption(line)}</div>
        {isEdited ? (
          <div className="font-wds-mono text-wds-label text-wds-warning-fg">↗ changed from {changedFrom}</div>
        ) : null}
      </div>
      <div
        className={cn(
          'flex h-9 shrink-0 items-center overflow-hidden rounded-wds-sm border border-solid bg-wds-surface',
          isEdited && !readOnly ? 'border-wds-primary border-[1.5px]' : 'border-wds-border-strong',
          readOnly && 'bg-wds-neutral-50',
        )}
      >
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onQtyChange(line.id, stepValue(line.requestedQty, -1))}
          aria-label={`Decrease ${line.itemName}`}
          className="flex h-full w-[34px] shrink-0 items-center justify-center border-r border-wds-border disabled:cursor-not-allowed"
        >
          <span className={cn('text-[16px] leading-5', readOnly ? 'text-wds-text-faint' : 'text-black')}>–</span>
        </button>
        <input
          type="text"
          inputMode="decimal"
          disabled={readOnly}
          value={displayQty}
          aria-label={`${line.itemName} quantity`}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '' || /^\d*\.?\d*$/.test(raw)) onQtyChange(line.id, raw);
          }}
          onBlur={(e) => {
            const n = Number.parseFloat(e.target.value);
            onQtyChange(line.id, Number.isFinite(n) ? String(Math.max(0, n)) : '0');
          }}
          className={cn(
            'h-full w-11 shrink-0 bg-transparent text-center font-wds-mono text-wds-body outline-none disabled:cursor-not-allowed',
            readOnly ? 'text-wds-text-faint' : isEdited ? 'font-semibold text-wds-espresso-800' : 'text-wds-text-ink',
          )}
        />
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onQtyChange(line.id, stepValue(line.requestedQty, 1))}
          aria-label={`Increase ${line.itemName}`}
          className="flex h-full w-[34px] shrink-0 items-center justify-center border-l border-wds-border disabled:cursor-not-allowed"
        >
          <span className={cn('text-[16px] leading-5', readOnly ? 'text-wds-text-faint' : 'text-wds-primary')}>+</span>
        </button>
      </div>
      {!readOnly ? (
        <button
          type="button"
          onClick={() => onDeleteLine(line.id)}
          disabled={!canDelete}
          aria-label={
            canDelete ? `Remove ${line.itemName}` : `${line.itemName} is already saved — set its quantity to 0 to request none`
          }
          title={canDelete ? undefined : 'Already saved — set quantity to 0 instead of removing'}
          className="flex h-9 w-8 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
              stroke="#000000"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

interface LineGroup {
  parentLabel: string | null;
  categoryLabel: string;
  lines: RequisitionSectionLine[];
}

function groupLines(lines: RequisitionSectionLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const line of lines) {
    const categoryLabel = (line.categoryName ?? 'UNCATEGORIZED').toUpperCase();
    const parentLabel = line.parentCategoryName ? line.parentCategoryName.toUpperCase() : null;
    const key = `${parentLabel ?? ''}::${categoryLabel}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex !== undefined) {
      groups[existingIndex]!.lines.push(line);
    } else {
      indexByKey.set(key, groups.length);
      groups.push({ parentLabel, categoryLabel, lines: [line] });
    }
  }
  return groups;
}

export function CategoryGroupedLineGrid({
  lines,
  originalQtyByLineId,
  onQtyChange,
  onDeleteLine,
  canDeleteLine,
  readOnly = false,
  className,
}: CategoryGroupedLineGridProps) {
  const groups = React.useMemo(() => groupLines(lines), [lines]);
  const hasNesting = groups.some((g) => g.parentLabel !== null);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {groups.map((group) => (
        <div
          key={`${group.parentLabel ?? ''}-${group.categoryLabel}`}
          className="flex flex-col overflow-hidden rounded-wds-sm border border-wds-border bg-wds-surface"
        >
          <div className="border-b border-wds-border bg-wds-neutral-50 px-3.5 py-2.5">
            {hasNesting && group.parentLabel ? (
              <div className="font-wds-mono text-wds-label text-wds-neutral-400">{group.parentLabel}</div>
            ) : null}
            <div className="font-wds-mono text-wds-label font-semibold tracking-[0.06em] text-wds-neutral-600">
              {group.categoryLabel}
            </div>
          </div>
          {group.lines.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              changedFrom={
                originalQtyByLineId && line.id in originalQtyByLineId && originalQtyByLineId[line.id] !== line.requestedQty
                  ? (originalQtyByLineId[line.id] ?? '0')
                  : null
              }
              onQtyChange={onQtyChange}
              onDeleteLine={onDeleteLine}
              canDelete={canDeleteLine ? canDeleteLine(line.id) : true}
              readOnly={readOnly}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
