'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  computeFillUpdates,
  computePasteUpdates,
  isBottomRightSelectionCell,
  isCellInSelection,
  moveCoord,
  parseClipboardGrid,
  sameCell,
  selectionToTsv,
} from './sheet-math'
import type { SheetCellCoord, SheetSelection, SheetUpdate } from './types'

export interface UseSheetEngineOptions<K extends string> {
  /** Editable columns, in left-to-right grid order */
  columnKeys: readonly K[]
  rowCount: number
  /** Disables all editing interactions (published period, read-only view) */
  locked?: boolean
  getValue: (rowIndex: number, columnKey: K) => string
  onBatchUpdate: (updates: SheetUpdate<K>[]) => void
  /** Clean a pasted value for a column; return null to reject the cell */
  normalizePasteValue?: (columnKey: K, raw: string) => string | null
}

export interface SheetEngine<K extends string = string> {
  /** Attach to the scrollable sheet container (scopes copy events) */
  containerRef: React.RefObject<HTMLDivElement>
  activeCell: SheetCellCoord<K> | null
  selection: SheetSelection<K> | null
  isCellActive: (cell: SheetCellCoord<K>) => boolean
  isCellSelected: (cell: SheetCellCoord<K>) => boolean
  /** Spread onto the <td> of every editable cell */
  cellMouseProps: (cell: SheetCellCoord<K>) => {
    onMouseDown: () => void
    onMouseEnter: () => void
  }
  /** Spread onto the <input> of every editable cell */
  inputProps: (cell: SheetCellCoord<K>) => {
    ref: (el: HTMLInputElement | null) => void
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => void
    onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  }
  /** True when this cell should render the drag-fill handle */
  hasFillHandle: (cell: SheetCellCoord<K>) => boolean
  /** onMouseDown for the fill handle */
  startFill: (event: React.MouseEvent) => void
  focusCell: (cell: SheetCellCoord<K>) => void
}

const cellKey = (cell: SheetCellCoord): string => `${cell.rowIndex}:${cell.columnKey}`

/**
 * Excel-style grid engine: drag selection, active cell, clipboard copy/paste
 * (TSV), drag-to-fill, and keyboard navigation (arrows, Enter, Tab, Escape
 * revert). Presentational rendering lives in `Sheet`/`SheetCell`; consumers
 * own row state and persistence via `onBatchUpdate`.
 */
export function useSheetEngine<K extends string>(options: UseSheetEngineOptions<K>): SheetEngine<K> {
  const { columnKeys, rowCount, locked = false, getValue, onBatchUpdate, normalizePasteValue } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const [activeCell, setActiveCell] = useState<SheetCellCoord<K> | null>(null)
  const [selection, setSelection] = useState<SheetSelection<K> | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [fillSelection, setFillSelection] = useState<SheetSelection<K> | null>(null)

  // Latest-value refs so document-level listeners never see stale state.
  const stateRef = useRef({ selection, fillSelection, locked, rowCount, columnKeys, getValue, onBatchUpdate })
  stateRef.current = { selection, fillSelection, locked, rowCount, columnKeys, getValue, onBatchUpdate }

  const inputRegistry = useRef(new Map<string, HTMLInputElement>())
  // Value snapshot taken when a cell gains focus, restored on Escape.
  const focusSnapshot = useRef<{ cell: SheetCellCoord<K>; value: string } | null>(null)

  const isCellActive = useCallback(
    (cell: SheetCellCoord<K>) => sameCell(cell, activeCell),
    [activeCell]
  )

  const isCellSelected = useCallback(
    (cell: SheetCellCoord<K>) => isCellInSelection(cell, selection, columnKeys),
    [selection, columnKeys]
  )

  const hasFillHandle = useCallback(
    (cell: SheetCellCoord<K>) => !locked && isBottomRightSelectionCell(cell, selection, columnKeys),
    [locked, selection, columnKeys]
  )

  const focusCell = useCallback((cell: SheetCellCoord<K>) => {
    setActiveCell(cell)
    setSelection({ anchor: cell, focus: cell })
    const el = inputRegistry.current.get(cellKey(cell))
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  const cellMouseProps = useCallback(
    (cell: SheetCellCoord<K>) => ({
      onMouseDown: () => {
        if (stateRef.current.locked) return
        setActiveCell(cell)
        setSelection({ anchor: cell, focus: cell })
        setIsSelecting(true)
      },
      onMouseEnter: () => {
        if (isSelecting) {
          setSelection((prev) => (prev ? { anchor: prev.anchor, focus: cell } : prev))
          return
        }
        if (stateRef.current.fillSelection) {
          setSelection({ anchor: stateRef.current.fillSelection.anchor, focus: cell })
        }
      },
    }),
    [isSelecting]
  )

  const startFill = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (stateRef.current.selection) setFillSelection(stateRef.current.selection)
  }, [])

  // Mouse released anywhere: apply a pending drag-fill, end drag selection.
  useEffect(() => {
    const finishPointerAction = () => {
      const { fillSelection: fill, selection: sel, locked: isLocked } = stateRef.current
      if (fill && sel && !isLocked) {
        const updates = computeFillUpdates(fill, sel, stateRef.current.columnKeys, stateRef.current.getValue)
        if (updates.length > 0) stateRef.current.onBatchUpdate(updates)
      }
      setIsSelecting(false)
      setFillSelection(null)
    }
    window.addEventListener('mouseup', finishPointerAction)
    return () => window.removeEventListener('mouseup', finishPointerAction)
  }, [])

  // Copy the selected block as TSV when the focus is inside this sheet.
  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      const { selection: sel, rowCount: rows, columnKeys: keys, getValue: read } = stateRef.current
      if (!sel) return
      const container = containerRef.current
      const activeElement = document.activeElement
      if (!container || !(activeElement instanceof HTMLElement) || !container.contains(activeElement)) return

      event.clipboardData?.setData('text/plain', selectionToTsv(sel, keys, rows, read))
      event.preventDefault()
    }
    document.addEventListener('copy', handleCopy)
    return () => document.removeEventListener('copy', handleCopy)
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, cell: SheetCellCoord<K>) => {
      const input = event.currentTarget

      if (event.key === 'Escape') {
        const snapshot = focusSnapshot.current
        if (snapshot && sameCell(snapshot.cell, cell)) {
          stateRef.current.onBatchUpdate([
            { rowIndex: cell.rowIndex, columnKey: cell.columnKey, value: snapshot.value },
          ])
        }
        return
      }

      let deltaRow = 0
      let deltaCol = 0
      if (event.key === 'Enter') deltaRow = event.shiftKey ? -1 : 1
      else if (event.key === 'Tab') deltaCol = event.shiftKey ? -1 : 1
      else if (event.key === 'ArrowDown') deltaRow = 1
      else if (event.key === 'ArrowUp') deltaRow = -1
      else if (event.key === 'ArrowLeft') {
        // Only leave the cell when the caret is already at the start.
        if (input.selectionStart !== 0 || input.selectionEnd !== 0) return
        deltaCol = -1
      } else if (event.key === 'ArrowRight') {
        const len = input.value.length
        if (input.selectionStart !== len || input.selectionEnd !== len) return
        deltaCol = 1
      } else {
        return
      }

      const next = moveCoord(cell, deltaRow, deltaCol, stateRef.current.columnKeys, stateRef.current.rowCount)
      event.preventDefault()
      if (next) focusCell(next)
    },
    [focusCell]
  )

  const inputProps = useCallback(
    (cell: SheetCellCoord<K>) => ({
      ref: (el: HTMLInputElement | null) => {
        const key = cellKey(cell)
        if (el) inputRegistry.current.set(key, el)
        else inputRegistry.current.delete(key)
      },
      onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
        if (stateRef.current.locked) return
        focusSnapshot.current = { cell, value: event.currentTarget.value }
        setActiveCell(cell)
        setSelection({ anchor: cell, focus: cell })
      },
      onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => {
        const { locked: isLocked, rowCount: rows, columnKeys: keys, onBatchUpdate: apply } = stateRef.current
        if (isLocked) return
        const grid = parseClipboardGrid(event.clipboardData.getData('text/plain'))
        if (grid.length === 0) return
        event.preventDefault()
        const updates = computePasteUpdates(
          grid,
          cell,
          keys,
          rows,
          normalizePasteValue ?? ((_key, raw) => raw.trim())
        )
        if (updates.length > 0) apply(updates)
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(event, cell),
    }),
    [handleKeyDown, normalizePasteValue]
  )

  return {
    containerRef,
    activeCell,
    selection,
    isCellActive,
    isCellSelected,
    cellMouseProps,
    inputProps,
    hasFillHandle,
    startFill,
    focusCell,
  }
}
