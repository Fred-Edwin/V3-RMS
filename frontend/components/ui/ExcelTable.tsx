'use client'

import { Fragment } from 'react'
import { cn } from '@/lib/cn'
import { SkeletonTable } from './SkeletonTable'

export type ExcelHeaderTone = 'navy' | 'green' | 'red' | 'purple' | 'teal' | 'gray'

export interface ExcelColumn<T> {
  key: string
  label: React.ReactNode
  align?: 'left' | 'center' | 'right'
  width?: number
  /** Right-aligns and applies tabular numerals */
  numeric?: boolean
  tone?: 'default' | 'negative' | 'muted'
  render?: (row: T, index: number) => React.ReactNode
}

export interface ExcelTableExpandable<T> {
  isExpanded: (row: T) => boolean
  onToggle: (row: T) => void
  /** One record per child row, keyed by column key. Missing keys render empty cells. */
  childRows: (row: T) => Array<Partial<Record<string, React.ReactNode>>>
}

export interface ExcelTableProps<T> {
  columns: ExcelColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Auto-numbered “#” first column */
  numbered?: boolean
  headerTone?: ExcelHeaderTone
  /** Totals band keyed by column key */
  totalsRow?: Partial<Record<string, React.ReactNode>>
  expandable?: ExcelTableExpandable<T>
  stickyHeader?: boolean
  isLoading?: boolean
  skeletonRows?: number
  emptyState?: React.ReactNode
  footnote?: React.ReactNode
  className?: string
}

const headerToneClasses: Record<ExcelHeaderTone, string> = {
  navy: 'bg-sheet-band-navy',
  green: 'bg-sheet-band-green',
  red: 'bg-sheet-band-red',
  purple: 'bg-sheet-band-purple',
  teal: 'bg-sheet-band-teal',
  gray: 'bg-sheet-band-gray',
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const

const cellToneClasses = {
  default: 'text-office-ink',
  negative: 'text-sheet-negative',
  muted: 'text-stone-600',
} as const

function columnAlign<T>(col: ExcelColumn<T>): 'left' | 'center' | 'right' {
  return col.align ?? (col.numeric ? 'right' : 'left')
}

/**
 * Read-only Excel-style data table — the standard treatment for corporate
 * data surfaces (reports, registers, reconciliation). Gridlines, colored
 * header band, zebra rows, optional expandable child rows and totals band.
 * For editable grids use `Sheet` instead.
 */
export function ExcelTable<T>({
  columns,
  rows,
  rowKey,
  numbered = false,
  headerTone = 'navy',
  totalsRow,
  expandable,
  stickyHeader = false,
  isLoading = false,
  skeletonRows = 6,
  emptyState,
  footnote,
  className,
}: ExcelTableProps<T>) {
  const gridCell = 'border border-sheet-grid'

  if (isLoading) {
    return (
      <div className={cn('rounded-md border border-stone-200 bg-white p-5', className)}>
        <SkeletonTable rows={skeletonRows} columns={columns.length + (numbered ? 1 : 0)} />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-md border border-stone-200 bg-white p-12 text-center', className)}>
        {emptyState ?? <p className="text-body-sm text-stone-500">No data for this view</p>}
      </div>
    )
  }

  const totalColumns = columns.length + (numbered ? 1 : 0) + (expandable ? 1 : 0)

  return (
    <div className={className}>
      <div className="overflow-x-auto rounded-md border border-sheet-grid">
        <table className="w-full border-collapse font-sheet text-sheet-base">
          <thead>
            <tr className={cn(headerToneClasses[headerTone], 'text-white')}>
              {numbered && (
                <th
                  scope="col"
                  className={cn(gridCell, 'w-10 px-2 py-1.5 text-center font-bold', stickyHeader && 'sticky top-0 z-10', stickyHeader && headerToneClasses[headerTone])}
                >
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    gridCell,
                    'px-2.5 py-1.5 font-bold',
                    alignClasses[columnAlign(col)],
                    stickyHeader && 'sticky top-0 z-10',
                    stickyHeader && headerToneClasses[headerTone]
                  )}
                >
                  {col.label}
                </th>
              ))}
              {expandable && (
                <th
                  scope="col"
                  aria-label="Expand"
                  className={cn(gridCell, 'w-7 px-1.5 py-1.5', stickyHeader && 'sticky top-0 z-10', stickyHeader && headerToneClasses[headerTone])}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isExpanded = expandable?.isExpanded(row) ?? false
              const children = isExpanded ? expandable?.childRows(row) ?? [] : []

              return (
                <Fragment key={rowKey(row)}>
                  <tr
                    onClick={expandable ? () => expandable.onToggle(row) : undefined}
                    className={cn(
                      'transition-colors duration-fast',
                      isExpanded ? 'bg-sheet-expanded' : idx % 2 === 1 ? 'bg-sheet-zebra' : 'bg-white',
                      expandable && 'cursor-pointer hover:bg-sheet-hover'
                    )}
                  >
                    {numbered && (
                      <td className={cn(gridCell, 'px-2 py-1.5 text-center font-semibold text-stone-500')}>
                        {idx + 1}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          gridCell,
                          'px-2.5 py-1.5',
                          alignClasses[columnAlign(col)],
                          col.numeric && 'tabular-nums whitespace-nowrap',
                          cellToneClasses[col.tone ?? 'default']
                        )}
                      >
                        {col.render
                          ? col.render(row, idx)
                          : String((row as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                    {expandable && (
                      <td className={cn(gridCell, 'px-1 py-1.5 text-center')}>
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                          onClick={(e) => {
                            e.stopPropagation()
                            expandable.onToggle(row)
                          }}
                          className="select-none text-stone-400 focus-visible:outline-none focus-visible:shadow-focus"
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      </td>
                    )}
                  </tr>

                  {children.map((child, childIdx) => (
                    <tr key={`${rowKey(row)}-child-${childIdx}`} className="bg-sheet-subrow">
                      {numbered && <td className={gridCell} />}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            gridCell,
                            'px-2.5 py-1',
                            alignClasses[columnAlign(col)],
                            col.numeric && 'tabular-nums whitespace-nowrap',
                            'text-stone-600'
                          )}
                        >
                          {child[col.key] ?? null}
                        </td>
                      ))}
                      {expandable && <td className={gridCell} />}
                    </tr>
                  ))}
                </Fragment>
              )
            })}

            {totalsRow && (
              <tr className="bg-sheet-totals font-bold">
                {numbered && <td className={gridCell} />}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      gridCell,
                      'px-2.5 py-1.5 text-office-ink',
                      alignClasses[columnAlign(col)],
                      col.numeric && 'tabular-nums whitespace-nowrap',
                      col.tone === 'negative' && 'text-sheet-negative'
                    )}
                  >
                    {totalsRow[col.key] ?? null}
                  </td>
                ))}
                {expandable && <td className={gridCell} />}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {footnote && <p className="mt-2 text-label-sm font-normal text-stone-400">{footnote}</p>}

      {/* Guards against column-count mistakes in dev */}
      {process.env.NODE_ENV !== 'production' && totalColumns === 0 && (
        <p className="text-danger">ExcelTable: no columns configured</p>
      )}
    </div>
  )
}
