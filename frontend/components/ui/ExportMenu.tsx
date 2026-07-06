'use client'

import { Download, FileText } from 'lucide-react'
import { Button } from './Button'
import { Popover } from './Popover'

export type ExportFormat = 'csv' | 'pdf'

interface ExportMenuProps {
  /** Trigger button text, e.g. "Export Branch" */
  label: string
  onExport: (format: ExportFormat) => void
  isLoading?: boolean
  formats?: ExportFormat[]
}

const formatLabels: Record<ExportFormat, string> = {
  csv: 'Download CSV',
  pdf: 'Download PDF',
}

/** Standard CSV/PDF export dropdown used on report pages. */
export function ExportMenu({ label, onExport, isLoading = false, formats = ['csv', 'pdf'] }: ExportMenuProps) {
  return (
    <Popover
      trigger={
        <Button variant="secondary" leftIcon={<Download size={15} />} isLoading={isLoading}>
          {label}
        </Button>
      }
      className="w-44"
    >
      {formats.map((format) => (
        <button
          key={format}
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-stone-700 hover:bg-stone-100"
          onClick={() => onExport(format)}
        >
          <FileText size={14} /> {formatLabels[format]}
        </button>
      ))}
    </Popover>
  )
}
