import { describe, expect, it } from 'vitest'
import {
  computeFillUpdates,
  computePasteUpdates,
  getSelectionBounds,
  isBottomRightSelectionCell,
  isCellInSelection,
  moveCoord,
  parseClipboardGrid,
  selectionToTsv,
} from './sheet-math'
import type { SheetSelection } from './types'

const COLS = ['gross', 'paye', 'sha', 'note'] as const
type Col = (typeof COLS)[number]

const sel = (
  anchorRow: number,
  anchorCol: Col,
  focusRow: number,
  focusCol: Col
): SheetSelection<Col> => ({
  anchor: { rowIndex: anchorRow, columnKey: anchorCol },
  focus: { rowIndex: focusRow, columnKey: focusCol },
})

describe('getSelectionBounds', () => {
  it('normalizes an inverted (drag up-left) selection', () => {
    expect(getSelectionBounds(sel(5, 'sha', 2, 'gross'), COLS)).toEqual({
      minRow: 2,
      maxRow: 5,
      minCol: 0,
      maxCol: 2,
    })
  })

  it('handles a single-cell selection', () => {
    expect(getSelectionBounds(sel(1, 'paye', 1, 'paye'), COLS)).toEqual({
      minRow: 1,
      maxRow: 1,
      minCol: 1,
      maxCol: 1,
    })
  })
})

describe('isCellInSelection', () => {
  const selection = sel(1, 'paye', 3, 'sha')

  it('includes interior and edge cells', () => {
    expect(isCellInSelection({ rowIndex: 2, columnKey: 'paye' }, selection, COLS)).toBe(true)
    expect(isCellInSelection({ rowIndex: 3, columnKey: 'sha' }, selection, COLS)).toBe(true)
  })

  it('excludes cells outside the block and handles null selection', () => {
    expect(isCellInSelection({ rowIndex: 0, columnKey: 'paye' }, selection, COLS)).toBe(false)
    expect(isCellInSelection({ rowIndex: 2, columnKey: 'gross' }, selection, COLS)).toBe(false)
    expect(isCellInSelection({ rowIndex: 2, columnKey: 'paye' }, null, COLS)).toBe(false)
  })
})

describe('isBottomRightSelectionCell', () => {
  it('is true only for the bottom-right cell (fill-handle position)', () => {
    const selection = sel(1, 'gross', 3, 'paye')
    expect(isBottomRightSelectionCell({ rowIndex: 3, columnKey: 'paye' }, selection, COLS)).toBe(true)
    expect(isBottomRightSelectionCell({ rowIndex: 3, columnKey: 'gross' }, selection, COLS)).toBe(false)
    expect(isBottomRightSelectionCell({ rowIndex: 1, columnKey: 'paye' }, selection, COLS)).toBe(false)
  })
})

describe('parseClipboardGrid', () => {
  it('splits rows on any newline convention and cells on tabs', () => {
    expect(parseClipboardGrid('1\t2\r\n3\t4\r5\t6\n')).toEqual([
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ])
  })

  it('drops only the trailing empty line, keeping interior empty cells', () => {
    expect(parseClipboardGrid('a\t\tb\n')).toEqual([['a', '', 'b']])
  })
})

describe('computePasteUpdates', () => {
  const normalize = (columnKey: Col, raw: string): string | null => {
    const trimmed = raw.trim()
    if (columnKey === 'note') return trimmed
    const cleaned = trimmed.replace(/,/g, '')
    if (cleaned === '') return ''
    return /^\d{1,8}(\.\d{1,2})?$/.test(cleaned) ? cleaned : null
  }

  it('maps a 2x2 block from the start cell and normalizes money values', () => {
    const grid = [
      ['45,000', '3500'],
      ['52000', 'abc'],
    ]
    const updates = computePasteUpdates(grid, { rowIndex: 1, columnKey: 'paye' }, COLS, 10, normalize)
    expect(updates).toEqual([
      { rowIndex: 1, columnKey: 'paye', value: '45000' },
      { rowIndex: 1, columnKey: 'sha', value: '3500' },
      { rowIndex: 2, columnKey: 'paye', value: '52000' },
      // 'abc' rejected by the money normalizer — cell skipped
    ])
  })

  it('clips rows past the grid and columns past the last key', () => {
    const grid = [
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]
    const updates = computePasteUpdates(grid, { rowIndex: 9, columnKey: 'sha' }, COLS, 10, normalize)
    // Only row 9 fits; 'sha' + 'note' columns exist to the right.
    expect(updates).toEqual([
      { rowIndex: 9, columnKey: 'sha', value: '1' },
      { rowIndex: 9, columnKey: 'note', value: '2' },
    ])
  })
})

describe('computeFillUpdates', () => {
  const values: Record<number, Partial<Record<Col, string>>> = {
    1: { gross: '100', paye: '10' },
    2: { gross: '200', paye: '20' },
  }
  const getValue = (rowIndex: number, columnKey: Col) => values[rowIndex]?.[columnKey] ?? ''

  it('repeats the source block cyclically into the dragged rows', () => {
    const source = sel(1, 'gross', 2, 'paye')
    const target = sel(1, 'gross', 5, 'paye')
    expect(computeFillUpdates(source, target, COLS, getValue)).toEqual([
      { rowIndex: 3, columnKey: 'gross', value: '100' },
      { rowIndex: 3, columnKey: 'paye', value: '10' },
      { rowIndex: 4, columnKey: 'gross', value: '200' },
      { rowIndex: 4, columnKey: 'paye', value: '20' },
      { rowIndex: 5, columnKey: 'gross', value: '100' },
      { rowIndex: 5, columnKey: 'paye', value: '10' },
    ])
  })

  it('returns no updates when the drag stayed inside the source block', () => {
    const source = sel(1, 'gross', 2, 'paye')
    expect(computeFillUpdates(source, sel(1, 'gross', 2, 'gross'), COLS, getValue)).toEqual([])
  })
})

describe('selectionToTsv', () => {
  it('serializes the selected block row-major with tab separators', () => {
    const getValue = (rowIndex: number, columnKey: Col) => `${columnKey}${rowIndex}`
    expect(selectionToTsv(sel(0, 'gross', 1, 'paye'), COLS, 10, getValue)).toBe(
      'gross0\tpaye0\ngross1\tpaye1'
    )
  })
})

describe('moveCoord', () => {
  it('moves within the grid', () => {
    expect(moveCoord({ rowIndex: 1, columnKey: 'paye' }, 1, 0, COLS, 5)).toEqual({
      rowIndex: 2,
      columnKey: 'paye',
    })
    expect(moveCoord({ rowIndex: 1, columnKey: 'paye' }, 0, 1, COLS, 5)).toEqual({
      rowIndex: 1,
      columnKey: 'sha',
    })
  })

  it('returns null at every edge', () => {
    expect(moveCoord({ rowIndex: 0, columnKey: 'gross' }, -1, 0, COLS, 5)).toBeNull()
    expect(moveCoord({ rowIndex: 4, columnKey: 'gross' }, 1, 0, COLS, 5)).toBeNull()
    expect(moveCoord({ rowIndex: 0, columnKey: 'gross' }, 0, -1, COLS, 5)).toBeNull()
    expect(moveCoord({ rowIndex: 0, columnKey: 'note' }, 0, 1, COLS, 5)).toBeNull()
  })
})
