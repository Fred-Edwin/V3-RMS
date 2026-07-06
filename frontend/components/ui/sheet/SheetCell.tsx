'use client'

import { cn } from '@/lib/cn'
import type { SheetEngine } from './useSheetEngine'
import type { SheetCellCoord, SheetCellTint } from './types'

/** [zebra (darker), plain (softer)] washes per group tint */
const tintClasses: Record<SheetCellTint, [string, string]> = {
  green: ['bg-sheet-tint-green', 'bg-sheet-tint-green-soft'],
  red: ['bg-sheet-tint-red', 'bg-sheet-tint-red-soft'],
  purple: ['bg-sheet-tint-purple', 'bg-sheet-tint-purple-soft'],
  none: ['bg-sheet-zebra-dense', 'bg-white'],
}

export function sheetCellBackground(
  tint: SheetCellTint,
  zebra: boolean,
  locked: boolean,
  selected: boolean
): string {
  if (selected) return 'bg-sheet-selection'
  if (locked) return 'bg-sheet-locked'
  return tintClasses[tint][zebra ? 0 : 1]
}

export function FillHandle({ onMouseDown }: { onMouseDown: (event: React.MouseEvent) => void }) {
  return (
    <span
      onMouseDown={onMouseDown}
      title="Drag to fill"
      className="absolute -bottom-[3px] -right-[3px] z-[6] h-[7px] w-[7px] cursor-crosshair border border-white bg-sheet-active"
    />
  )
}

interface SheetCellProps<K extends string> {
  cell: SheetCellCoord<K>
  engine: SheetEngine<K>
  value: string
  onChange: (value: string) => void
  /** Grey "published" look */
  locked?: boolean
  /** Inputs disabled (published or read-only consolidated view) */
  disabled?: boolean
  tint?: SheetCellTint
  /** Darker tint variant (even rows in the original design) */
  zebra?: boolean
  align?: 'left' | 'right'
  placeholder?: string
  inputMode?: 'decimal' | 'text'
  className?: string
  inputClassName?: string
}

/**
 * Standard editable sheet cell: group-tinted background, Excel-blue selection
 * and active-cell rings, drag-fill handle, engine-wired input.
 */
export function SheetCell<K extends string>({
  cell,
  engine,
  value,
  onChange,
  locked = false,
  disabled = false,
  tint = 'none',
  zebra = false,
  align = 'right',
  placeholder,
  inputMode = 'decimal',
  className,
  inputClassName,
}: SheetCellProps<K>) {
  const selected = engine.isCellSelected(cell)
  const active = engine.isCellActive(cell)

  return (
    <td
      {...engine.cellMouseProps(cell)}
      className={cn(
        'relative h-10 border border-sheet-grid-dense p-0 align-middle',
        sheetCellBackground(tint, zebra, locked, selected),
        active
          ? 'ring-2 ring-inset ring-sheet-active'
          : selected && 'ring-1 ring-inset ring-sheet-selection-ring',
        className
      )}
    >
      <input
        {...engine.inputProps(cell)}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-full w-full bg-transparent px-1.5 font-sheet text-sheet-cell text-office-ink placeholder:text-stone-300',
          'focus:outline-none disabled:cursor-not-allowed disabled:text-stone-400',
          align === 'right' ? 'text-right tabular-nums' : 'text-left',
          inputClassName
        )}
      />
      {engine.hasFillHandle(cell) && <FillHandle onMouseDown={engine.startFill} />}
    </td>
  )
}
