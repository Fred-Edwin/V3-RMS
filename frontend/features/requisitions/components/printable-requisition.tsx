import * as React from 'react';

/**
 * Printable Requisition — standalone print layout for the approved/
 * needs-approval detail (mirrors `printable-purchase-list.tsx`'s pattern:
 * a distinct print-only document, not a styled version of the app screen).
 * The master-detail's sidebar, list column and sticky header all need
 * suppression on print, which is more `print:hidden` than a purpose-built
 * page is worth — see requisitions-approval-screen.tsx's Print button.
 */
export interface PrintableRequisitionLine {
  itemName: string;
  categoryName: string | null;
  requestedQty: string | null;
  approvedQty: string | null;
  usageUnit: string;
}

export interface PrintableRequisitionSection {
  departmentTag: string;
  submittedByName: string | null;
  lines: PrintableRequisitionLine[];
}

export interface PrintableRequisitionProps {
  orgName: string;
  requisitionType: string;
  dateLabel: string;
  sections: PrintableRequisitionSection[];
  signedByName: string | null;
  signedAtLabel: string | null;
}

export function PrintableRequisition({
  orgName,
  requisitionType,
  dateLabel,
  sections,
  signedByName,
  signedAtLabel,
}: PrintableRequisitionProps) {
  return (
    <div className="mx-auto flex w-[816px] flex-col bg-white py-12 px-14 font-wds-sans text-wds-text-ink print:w-full print:px-0 print:py-0">
      <div className="flex items-start justify-between border-b-2 border-wds-text-ink pb-5">
        <div className="flex flex-col gap-0.5">
          <span className="font-wds-sans text-[20px] leading-6 font-semibold text-wds-text-ink">{orgName}</span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{requisitionType} requisition</span>
        </div>
        <span className="font-wds-mono text-[10px] leading-3 text-wds-text-copy-muted">{dateLabel}</span>
      </div>

      {sections
        .filter((section) => section.lines.length > 0)
        .map((section) => (
        <div key={section.departmentTag} className="mt-7 flex flex-col">
          <div className="flex items-baseline justify-between border-b-[1.5px] border-wds-text-ink pb-1.5">
            <span className="font-wds-sans text-[15px] font-semibold text-wds-text-ink">{section.departmentTag}</span>
            <span className="font-wds-mono text-[10px] text-wds-text-copy-muted">{section.submittedByName ?? '—'}</span>
          </div>
          <div className="flex h-7 shrink-0 items-center gap-5 border-b border-wds-border">
            <span className="grow font-wds-mono text-wds-table-label uppercase text-wds-text-ink">Item</span>
            <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
              Requested
            </span>
            <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-table-label uppercase text-wds-text-ink">
              Approved
            </span>
          </div>
          {section.lines.map((line, i) => (
            <div key={`${section.departmentTag}-${i}`} className="flex h-9 shrink-0 items-center gap-5 border-b border-wds-border">
              <span className="grow font-wds-sans text-wds-body-sm text-wds-text-ink">{line.itemName}</span>
              <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">
                {line.requestedQty ?? '—'}
              </span>
              <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-body-sm font-semibold text-wds-text-ink">
                {line.approvedQty ?? '—'} {line.usageUnit}
              </span>
            </div>
          ))}
        </div>
      ))}

      <div className="mt-10 flex items-end justify-between border-t border-wds-border pt-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[26px] leading-[100%] font-wds-signature text-wds-text-ink">{signedByName ?? ''}</span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            {signedByName ? `${signedByName} · Branch Manager · signed ${signedAtLabel}` : 'Not yet signed'}
          </span>
        </div>
      </div>
    </div>
  );
}
