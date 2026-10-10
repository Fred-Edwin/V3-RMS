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
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto border border-wds-border bg-wds-surface">
    <table
      ref={ref}
      className={cn("w-full caption-bottom font-wds-sans text-wds-body-sm", className)}
      {...props}
    />
  </div>
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
    /** `two-line` is for rows whose first cell stacks two lines (Branch day History, Paper B10: 67 high). The default is unchanged. */
    size?: "default" | "two-line"
  }
>(({ className, size = "default", ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      size === "two-line" ? "h-[67px]" : "h-[46px]",
      "border-b border-wds-neutral-100 transition-colors hover:bg-wds-surface-sunken data-[state=selected]:bg-wds-surface-sunken",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-[34px] px-wds-4 text-left align-middle font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-ink [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
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
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
