import * as React from "react"

import { cn } from "@/lib/cn"

/**
 * WDS Table — header per the current approved style (UI_BUILD_RULES §4; Paper Prep `1UE1-0`/`1UE2-0`): no header fill, 34px,
 * 10px Geist Mono uppercase at 0.06em, one 1px ink rule under it, on a white table with a 1px border and square corners.
 * Originally matched the Catalog table (Paper SFT-0), whose blue-grey header fill is retired. Paper's own artboard is
 * built from flex-row divs, not a semantic <table>; the primitive intentionally
 * uses real <table>/<thead>/<tr>/<th>/<td> markup instead (screen-reader/assistive
 * tech benefit for genuinely tabular data) while matching Paper's exact row
 * heights, borders, and type. Composites consuming this match Paper's column
 * widths and cell content per-column.
 */
/**
 * `workforce` look (Paper Employees R3F-0/R3L-0, Shift templates 18BH-0, Audit log 1O9D-0). Additive: a table that never asks
 * for it is drawn exactly as before. Header 36 px, 11 px mono, secondary grey, one ink rule; rows 56 px (42 px with
 * `size="compact"`), `neutral-200` between rows; a selected row has a 3 px caramel bar and a warm fill.
 */
type TableLook = "default" | "workforce"
const TableLookContext = React.createContext<TableLook>("default")

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { look?: TableLook }
>(({ className, look = "default", ...props }, ref) => (
  <TableLookContext.Provider value={look}>
    <div className="relative w-full overflow-auto border border-wds-border bg-wds-surface">
      <table
        ref={ref}
        className={cn("w-full caption-bottom font-wds-sans text-wds-body-sm", className)}
        {...props}
      />
    </div>
  </TableLookContext.Provider>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-wds-text-ink", className)}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-wds-border bg-wds-surface-sunken font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    /**
     * `two-line` is for rows whose first cell stacks two lines (Branch day History, Paper B10: 67 high). The default is unchanged.
     * `compact` is the Workforce look's 42 px row (Timesheets, Audit log); it only applies inside the `workforce` look.
     */
    size?: "default" | "two-line" | "compact"
  }
>(({ className, size = "default", ...props }, ref) => {
  const workforce = React.useContext(TableLookContext) === "workforce"
  return (
    <tr
      ref={ref}
      className={cn(
        workforce
          ? size === "compact"
            ? "h-[42px]"
            : "h-14"
          : size === "two-line"
            ? "h-[67px]"
            : "h-[46px]",
        workforce
          ? "border-b border-wds-neutral-200 transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-wds-neutral-50 data-[state=selected]:bg-[color-mix(in_oklab,var(--wds-caramel-100)_55%,white)] data-[state=selected]:shadow-[inset_3px_0_0_var(--wds-caramel-600)]"
          : "border-b border-wds-neutral-100 transition-colors hover:bg-wds-surface-sunken data-[state=selected]:bg-wds-surface-sunken",
        className
      )}
      {...props}
    />
  )
})
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const workforce = React.useContext(TableLookContext) === "workforce"
  return (
    <th
      ref={ref}
      className={cn(
        "px-wds-4 text-left align-middle font-wds-mono font-normal uppercase tracking-[0.06em] [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        workforce ? "h-9 text-[11px] leading-[14px] text-wds-text-secondary" : "h-[34px] text-[10px] leading-3 text-wds-text-ink",
        className
      )}
      {...props}
    />
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-wds-4 align-middle text-wds-body-sm text-wds-text [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-wds-4 font-wds-sans text-wds-caption text-wds-text-copy-muted", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  TableLookContext,
  type TableLook,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
