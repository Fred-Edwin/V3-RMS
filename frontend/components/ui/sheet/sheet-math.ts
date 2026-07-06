import type { SheetCellCoord, SheetSelection, SheetUpdate } from './types'

/**
 * Pure selection/clipboard/fill math for the Sheet engine. Kept free of React
 * and DOM so it can be unit-tested in the node vitest environment.
 */

export interface SelectionBounds {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export function getSelectionBounds<K extends string>(
  selection: SheetSelection<K>,
  columnKeys: readonly K[]
): SelectionBounds {
  const anchorColumn = columnKeys.indexOf(selection.anchor.columnKey)
  const focusColumn = columnKeys.indexOf(selection.focus.columnKey)

  return {
    minRow: Math.min(selection.anchor.rowIndex, selection.focus.rowIndex),
    maxRow: Math.max(selection.anchor.rowIndex, selection.focus.rowIndex),
    minCol: Math.min(anchorColumn, focusColumn),
    maxCol: Math.max(anchorColumn, focusColumn),
  }
}

export function sameCell<K extends string>(
  a: SheetCellCoord<K> | null,
  b: SheetCellCoord<K> | null
): boolean {
  return !!a && !!b && a.rowIndex === b.rowIndex && a.columnKey === b.columnKey
}

export function isCellInSelection<K extends string>(
  cell: SheetCellCoord<K>,
  selection: SheetSelection<K> | null,
  columnKeys: readonly K[]
): boolean {
  if (!selection) return false
  const bounds = getSelectionBounds(selection, columnKeys)
  const col = columnKeys.indexOf(cell.columnKey)
  return (
    cell.rowIndex >= bounds.minRow &&
    cell.rowIndex <= bounds.maxRow &&
    col >= bounds.minCol &&
    col <= bounds.maxCol
  )
}

export function isBottomRightSelectionCell<K extends string>(
  cell: SheetCellCoord<K>,
  selection: SheetSelection<K> | null,
  columnKeys: readonly K[]
): boolean {
  if (!selection) return false
  const bounds = getSelectionBounds(selection, columnKeys)
  return cell.rowIndex === bounds.maxRow && columnKeys.indexOf(cell.columnKey) === bounds.maxCol
}

/** Parse clipboard text into a grid of cells (rows split on \n, cells on \t). */
export function parseClipboardGrid(text: string): string[][] {
  const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (rows[rows.length - 1] === '') rows.pop()
  return rows.map((row) => row.split('\t'))
}

/**
 * Build the batch updates for a paste starting at `startCell`. Cells whose
 * normalized value is null (rejected) and cells outside the grid are skipped.
 */
export function computePasteUpdates<K extends string>(
  grid: string[][],
  startCell: SheetCellCoord<K>,
  columnKeys: readonly K[],
  rowCount: number,
  normalize: (columnKey: K, raw: string) => string | null
): SheetUpdate<K>[] {
  const startColumnIndex = columnKeys.indexOf(startCell.columnKey)
  const updates: SheetUpdate<K>[] = []

  grid.forEach((pastedRow, rowOffset) => {
    const rowIndex = startCell.rowIndex + rowOffset
    if (rowIndex >= rowCount) return

    pastedRow.forEach((rawValue, colOffset) => {
      const columnKey = columnKeys[startColumnIndex + colOffset]
      if (!columnKey) return
      const value = normalize(columnKey, rawValue)
      if (value === null) return
      updates.push({ rowIndex, columnKey, value })
    })
  })

  return updates
}

/**
 * Build the batch updates for a drag-fill: the source selection's values are
 * repeated (cycling) into the rows dragged past the source. Returns [] when
 * the drag did not extend beyond the source block.
 */
export function computeFillUpdates<K extends string>(
  source: SheetSelection<K>,
  target: SheetSelection<K>,
  columnKeys: readonly K[],
  getValue: (rowIndex: number, columnKey: K) => string
): SheetUpdate<K>[] {
  const sourceBounds = getSelectionBounds(source, columnKeys)
  const targetBounds = getSelectionBounds(target, columnKeys)
  const draggedPastSource =
    targetBounds.maxRow > sourceBounds.maxRow || targetBounds.maxCol > sourceBounds.maxCol
  if (!draggedPastSource) return []

  const updates: SheetUpdate<K>[] = []
  const sourceRowCount = sourceBounds.maxRow - sourceBounds.minRow + 1

  for (let rowIndex = sourceBounds.maxRow + 1; rowIndex <= targetBounds.maxRow; rowIndex++) {
    const sourceRow = sourceBounds.minRow + ((rowIndex - sourceBounds.maxRow - 1) % sourceRowCount)
    for (let colIndex = sourceBounds.minCol; colIndex <= sourceBounds.maxCol; colIndex++) {
      const columnKey = columnKeys[colIndex]
      if (!columnKey) continue
      updates.push({ rowIndex, columnKey, value: getValue(sourceRow, columnKey) })
    }
  }

  return updates
}

/** Serialize the selected block as TSV for the clipboard. */
export function selectionToTsv<K extends string>(
  selection: SheetSelection<K>,
  columnKeys: readonly K[],
  rowCount: number,
  getValue: (rowIndex: number, columnKey: K) => string
): string {
  const bounds = getSelectionBounds(selection, columnKeys)
  const lines: string[] = []
  for (let rowIndex = bounds.minRow; rowIndex <= Math.min(bounds.maxRow, rowCount - 1); rowIndex++) {
    lines.push(
      columnKeys
        .slice(bounds.minCol, bounds.maxCol + 1)
        .map((columnKey) => getValue(rowIndex, columnKey))
        .join('\t')
    )
  }
  return lines.join('\n')
}

/** Clamped keyboard move; returns null when the move falls off the grid edge. */
export function moveCoord<K extends string>(
  cell: SheetCellCoord<K>,
  deltaRow: number,
  deltaCol: number,
  columnKeys: readonly K[],
  rowCount: number
): SheetCellCoord<K> | null {
  const rowIndex = cell.rowIndex + deltaRow
  const colIndex = columnKeys.indexOf(cell.columnKey) + deltaCol
  if (rowIndex < 0 || rowIndex >= rowCount) return null
  if (colIndex < 0 || colIndex >= columnKeys.length) return null
  const columnKey = columnKeys[colIndex]
  if (!columnKey) return null
  return { rowIndex, columnKey }
}
