'use client'

import { useState } from 'react'
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
  className?: string
}

interface TableProps<T extends Record<string, unknown>> {
  columns: TableColumn<T>[]
  data: T[]
  keyField: keyof T
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  emptyState?: React.ReactNode
  className?: string
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string
}

// Using function declaration (not arrow function) to avoid TSX <T> ambiguity
function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  onSort,
  sortKey,
  sortDirection,
  emptyState,
  className,
  onRowClick,
  getRowClassName,
}: TableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState<string | undefined>(sortKey)
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>(sortDirection ?? 'asc')

  const activeSortKey = sortKey ?? internalSortKey
  const activeSortDir = sortDirection ?? internalSortDir

  function handleSort(key: string) {
    const newDir = activeSortKey === key && activeSortDir === 'asc' ? 'desc' : 'asc'
    setInternalSortKey(key)
    setInternalSortDir(newDir)
    onSort?.(key, newDir)
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = activeSortKey === col.key
              return (
                <th
                  key={String(col.key)}
                  className={cn(
                    'text-left text-label-sm font-semibold uppercase tracking-wider text-stone-500 h-11 px-4 border-b-2 border-stone-200',
                    col.sortable && 'cursor-pointer select-none hover:text-stone-700',
                    isSorted && 'text-amber',
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      isSorted ? (
                        activeSortDir === 'asc' ? (
                          <ChevronUp size={14} className="text-amber" />
                        ) : (
                          <ChevronDown size={14} className="text-amber" />
                        )
                      ) : (
                        <ChevronsUpDown size={14} className="text-stone-300" />
                      )
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && emptyState ? (
            <tr>
              <td colSpan={columns.length}>
                {emptyState}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                className={cn(
                  'h-[52px] border-b border-stone-100 hover:bg-stone-100 transition-colors duration-fast',
                  onRowClick && 'cursor-pointer',
                  getRowClassName?.(row),
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn('px-4 text-body-sm text-stone-900', col.className)}
                  >
                    {col.render
                      ? col.render(row[col.key as keyof T], row)
                      : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export { Table }
