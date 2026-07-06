'use client'

import { Fragment, useEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from '../IconButton'
import { SkeletonTable } from '../SkeletonTable'
import type { SheetEngine } from './useSheetEngine'
import type { SheetBandTone } from './types'

/* ── Column / group model ─────────────────────────────────────────── */

export interface SheetRowContext<Row> {
  row: Row
  rowIndex: number
  /** Darker tint variant (even rows in the original design) */
  zebra: boolean
  /** Grey "published" look */
  locked: boolean
  /** Inputs disabled */
  disabled: boolean
}

export interface SheetColumn<Row> {
  key: string
  header: React.ReactNode
  width: number
  /**
   * Renders the full `<td>` for this column (must set its own key-free JSX;
   * Sheet supplies the React key). Standard editable cells render a
   * `SheetCell`; computed/custom cells render their own `<td>`. Frozen
   * columns apply their own `sticky left-* z-[4]` classes.
   */
  renderCell: (ctx: SheetRowContext<Row>) => React.ReactNode
  /** Cell content for the totals row (omit on every column to hide it) */
  renderTotal?: (rows: Row[]) => React.ReactNode
  totalClassName?: string
  /** Extra classes on the column header cell (e.g. computed-column wash) */
  headerClassName?: string
}

export interface SheetColumnGroup<Row> {
  /**
   * Band label. The first group's band doubles as the sheet title and is
   * frozen with its columns; subsequent groups render centered band cells.
   */
  label: React.ReactNode
  tone: SheetBandTone
  columns: SheetColumn<Row>[]
  /** data-tour anchor on the band cell */
  dataTour?: string
}

export interface SheetRowIndicator {
  tone: 'pending' | 'error' | 'info'
  title?: string
}

export interface SheetProps<Row> {
  groups: SheetColumnGroup<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  engine: Pick<SheetEngine<string>, 'containerRef'>
  /** Grey "published" look on every row */
  locked?: boolean
  /** Inputs disabled (published or read-only view) */
  disabled?: boolean
  /**
   * Leading data columns kept sticky while scrolling horizontally. Defaults
   * to the first group's column count (the identity columns).
   */
  frozenColumns?: number
  /** Save-state dot in the row-number rail */
  rowIndicator?: (row: Row) => SheetRowIndicator | null
  /** Right-aligned strip below the grid (e.g. refresh button) */
  toolbar?: React.ReactNode
  /** Fullscreen focus mode toggle (default true). Escape exits when not editing a cell. */
  expandable?: boolean
  /** Slim action bar shown above the grid only while expanded (page controls) */
  fullscreenBar?: React.ReactNode
  /** Excel-green status bar */
  statusBar?: { left: React.ReactNode; right?: React.ReactNode }
  isLoading?: boolean
  skeletonColumns?: number
  emptyState?: React.ReactNode
  dataTour?: string
  className?: string
}

/* ── Tone maps (full class names — no interpolation) ──────────────── */

const bandBgClasses: Record<SheetBandTone, string> = {
  navy: 'bg-sheet-band-navy',
  green: 'bg-sheet-band-green',
  red: 'bg-sheet-band-red',
  purple: 'bg-sheet-band-purple',
  teal: 'bg-sheet-band-teal',
  gray: 'bg-sheet-band-gray',
}

const accentTopClasses: Record<SheetBandTone, string> = {
  navy: 'border-t-sheet-band-navy',
  green: 'border-t-sheet-band-green',
  red: 'border-t-sheet-band-red',
  purple: 'border-t-sheet-band-purple',
  teal: 'border-t-sheet-band-teal',
  gray: 'border-t-sheet-band-gray',
}

const indicatorDotClasses: Record<SheetRowIndicator['tone'], string> = {
  pending: 'bg-sheet-dot-pending',
  error: 'bg-sheet-dot-error',
  info: 'bg-sheet-dot-info',
}

const ROW_NUMBER_WIDTH = 32
const BAND_HEIGHT = 22

/**
 * Editable Excel-style grid chrome: colored group bands, two-tier sticky
 * header, frozen identity columns, row-number rail with save-state dots,
 * totals row, toolbar strip and Excel-green status bar. Cell interactivity
 * comes from `useSheetEngine` + `SheetCell`, wired in by the consumer's
 * column config (see the payroll sheet config for the reference usage).
 */
export function Sheet<Row>({
  groups,
  rows,
  rowKey,
  engine,
  locked = false,
  disabled = false,
  frozenColumns,
  rowIndicator,
  toolbar,
  expandable = true,
  fullscreenBar,
  statusBar,
  isLoading = false,
  skeletonColumns = 10,
  emptyState,
  dataTour,
  className,
}: SheetProps<Row>) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Fullscreen focus mode: lock page scroll and exit on Escape — unless the
  // Escape happened inside a cell input, where it means "revert this edit".
  useEffect(() => {
    if (!isExpanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (event.target instanceof HTMLInputElement) return
      setIsExpanded(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isExpanded])

  const columns = groups.flatMap((g) => g.columns)
  const frozenCount = frozenColumns ?? groups[0]?.columns.length ?? 0
  const tableWidth = ROW_NUMBER_WIDTH + columns.reduce((acc, c) => acc + c.width, 0)
  const hasTotals = rows.length > 0 && columns.some((c) => c.renderTotal)

  // Sticky left offsets for the frozen column *headers* (body cells apply
  // their own sticky classes inside renderCell, where they own the <td>).
  const frozenLeftOffsets: number[] = []
  let offset = ROW_NUMBER_WIDTH
  for (let i = 0; i < frozenCount; i++) {
    frozenLeftOffsets.push(offset)
    offset += columns[i]?.width ?? 0
  }

  return (
    <div
      data-tour={dataTour}
      className={cn(
        'flex flex-col overflow-hidden bg-white',
        isExpanded
          ? 'fixed inset-0 z-50'
          : 'min-h-0 flex-1 rounded-t-xl border border-stone-200 shadow-sm',
        className
      )}
    >
      {/* Slim action bar — fullscreen only, so page controls stay reachable */}
      {isExpanded && fullscreenBar && (
        <div className="shrink-0 border-b border-sheet-grid-dense bg-sheet-toolbar px-3 py-1.5">
          {fullscreenBar}
        </div>
      )}

      <div ref={engine.containerRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6">
            <SkeletonTable rows={6} columns={skeletonColumns} />
          </div>
        ) : rows.length === 0 && emptyState ? (
          <div className="p-12 text-center">{emptyState}</div>
        ) : (
          <table
            className="w-full border-collapse font-sheet text-sheet-cell"
            style={{ minWidth: tableWidth, tableLayout: 'fixed' }}
          >
            <colgroup>
              <col style={{ width: ROW_NUMBER_WIDTH, minWidth: ROW_NUMBER_WIDTH }} />
              {columns.map((col) => (
                <col key={col.key} style={{ width: col.width, minWidth: col.width }} />
              ))}
            </colgroup>

            <thead>
              {/* Band row: frozen title band, then one colored cell per group */}
              <tr>
                {groups.map((group, groupIndex) => {
                  const bandCell = (
                    <td
                      key={groupIndex}
                      data-tour={group.dataTour}
                      colSpan={group.columns.length + (groupIndex === 0 ? 1 : 0)}
                      className={cn(
                        'h-[22px] border border-white/30 align-middle text-sheet-band font-bold uppercase text-white',
                        bandBgClasses[group.tone],
                        groupIndex === 0
                          ? 'sticky left-0 top-0 z-20 px-2 text-left'
                          : 'sticky top-0 z-[9] text-center'
                      )}
                    >
                      {group.label}
                    </td>
                  )
                  return bandCell
                })}
              </tr>

              {/* Column header row */}
              <tr>
                <th
                  aria-label="Row number"
                  className="sticky left-0 z-20 border border-sheet-grid-dense bg-sheet-header"
                  style={{ top: BAND_HEIGHT }}
                />
                {columns.map((col, colIndex) => {
                  const group = groups.find((g) => g.columns.includes(col))
                  const isFrozen = colIndex < frozenCount
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        'sticky h-10 border border-sheet-grid-dense border-t-[3px] bg-sheet-header px-1 py-0.5 align-middle text-sheet-header font-bold text-stone-600',
                        accentTopClasses[group?.tone ?? 'gray'],
                        isFrozen ? 'z-[19] pl-2 text-left' : 'z-[9] text-center',
                        col.headerClassName
                      )}
                      style={{
                        top: BAND_HEIGHT,
                        ...(isFrozen ? { left: frozenLeftOffsets[colIndex] } : undefined),
                      }}
                    >
                      {col.header}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => {
                const zebra = rowIndex % 2 === 1
                const indicator = rowIndicator?.(row) ?? null
                const ctx: SheetRowContext<Row> = { row, rowIndex, zebra, locked, disabled }

                return (
                  <tr key={rowKey(row)} className={locked ? undefined : 'group'}>
                    {/* Row-number rail + save-state dot */}
                    <td
                      className={cn(
                        'sticky left-0 z-[5] h-10 overflow-hidden border border-sheet-grid-dense p-0 text-center align-middle',
                        zebra ? 'bg-sheet-rownum-even' : 'bg-sheet-rownum'
                      )}
                    >
                      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
                        <span className="text-sheet-band leading-none text-stone-500">{rowIndex + 1}</span>
                        {indicator && (
                          <span
                            title={indicator.title}
                            className={cn(
                              'inline-block h-1 w-1 shrink-0 rounded-full',
                              indicatorDotClasses[indicator.tone]
                            )}
                          />
                        )}
                      </div>
                    </td>
                    {columns.map((col) => (
                      <Fragment key={col.key}>{col.renderCell(ctx)}</Fragment>
                    ))}
                  </tr>
                )
              })}

              {/* Totals row */}
              {hasTotals && (
                <tr className="border-t-2 border-t-stone-400">
                  <td className="sticky left-0 z-[5] h-9 border border-sheet-grid-dense bg-sheet-header text-center align-middle font-bold">
                    Σ
                  </td>
                  {columns.map((col, colIndex) => (
                    <td
                      key={col.key}
                      className={cn(
                        'h-9 border border-sheet-grid-dense bg-sheet-header pr-1.5 text-right align-middle font-bold tabular-nums',
                        colIndex < frozenCount && 'sticky z-[4] pl-2 text-left',
                        col.totalClassName
                      )}
                      style={colIndex < frozenCount ? { left: frozenLeftOffsets[colIndex] } : undefined}
                    >
                      {col.renderTotal?.(rows) ?? null}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Toolbar strip */}
      {(toolbar || expandable) && (
        <div className="flex h-7 shrink-0 items-center justify-end gap-1 border-t border-sheet-grid-dense bg-sheet-toolbar px-1">
          {toolbar}
          {expandable && (
            <IconButton
              icon={isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              label={isExpanded ? 'Exit fullscreen (Esc)' : 'Expand sheet to fullscreen'}
              title={isExpanded ? 'Exit fullscreen (Esc)' : 'Expand sheet to fullscreen'}
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="size-[22px] rounded-md"
            />
          )}
        </div>
      )}

      {/* Excel-green status bar */}
      {statusBar && (
        <div className="flex h-[22px] shrink-0 items-center justify-between bg-sheet-statusbar px-3 font-sheet text-sheet-band text-white/90">
          <span>{statusBar.left}</span>
          {statusBar.right && <div className="flex gap-5">{statusBar.right}</div>}
        </div>
      )}
    </div>
  )
}
