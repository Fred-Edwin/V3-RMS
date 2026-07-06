export type SheetRowState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface SheetCellCoord<K extends string = string> {
  rowIndex: number
  columnKey: K
}

export interface SheetSelection<K extends string = string> {
  anchor: SheetCellCoord<K>
  focus: SheetCellCoord<K>
}

export interface SheetUpdate<K extends string = string> {
  rowIndex: number
  columnKey: K
  value: string
}

/** Colored group header bands (white text on all) */
export type SheetBandTone = 'navy' | 'green' | 'red' | 'purple' | 'teal' | 'gray'

/** Soft cell washes applied to editable cells by column group */
export type SheetCellTint = 'green' | 'red' | 'purple' | 'none'
