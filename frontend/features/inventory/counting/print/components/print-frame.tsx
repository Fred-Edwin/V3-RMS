'use client';

import * as React from 'react';

/**
 * The bare A4 frame of the two printed Counting pages (Paper steps 43 `24O2-0`/`27N7-0` and 44 `24O7-0`). On screen: a grey
 * desk, one white A4 sheet and a Print button (never run automatically). Printed: only the sheet, on A4 with the margins below, the
 * header repeated on every page, rows that do not split across pages, and the page count in the footer margin box. Paper's artboards
 * are drawn in points (595 × 842), so sizes here are points too. The shell, the button and the desk are `print:hidden`.
 */
export const PRINT_CSS = `
@page { size: A4; margin: 0 40pt 34pt; @bottom-left { content: var(--scw-print-footer) " · Page " counter(page) " of " counter(pages); font: 9pt "Geist Mono", ui-monospace, monospace; color: var(--wds-text-secondary); } @bottom-right { content: var(--scw-print-footer-right); font: 9pt "Geist Mono", ui-monospace, monospace; color: var(--wds-text-secondary); } }
.scw-doc { width: 595pt; margin: 0 auto; background: var(--wds-surface); color: var(--wds-text-ink); font-family: var(--font-geist-sans), Geist, system-ui, sans-serif; }
.scw-doc table { width: 100%; border-collapse: collapse; }
.scw-doc thead { display: table-header-group; }
.scw-doc tr { break-inside: avoid; }
.scw-doc .mono { font-family: var(--font-geist-mono), "Geist Mono", ui-monospace, monospace; }
.scw-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 40pt 0 22pt; border-bottom: 1pt solid var(--wds-border); }
.scw-brand { display: flex; align-items: center; gap: 14pt; }
.scw-brand img { width: 46pt; height: 46pt; border-radius: 50%; object-fit: cover; }
.scw-brand b { display: block; font-size: 20pt; line-height: 24pt; font-weight: 600; letter-spacing: -0.02em; }
.scw-brand span { display: block; font-size: 12pt; line-height: 16pt; color: var(--wds-text-secondary); }
.scw-title { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4pt; }
.scw-title .eyebrow { font-size: 10pt; line-height: 12pt; letter-spacing: 0.14em; color: var(--wds-text-secondary); }
.scw-title .big { font-size: 26pt; line-height: 32pt; font-weight: 600; }
.scw-title .sub { font-size: 12pt; line-height: 16pt; color: var(--wds-text-secondary); }
.scw-label { font-size: 9pt; line-height: 12pt; letter-spacing: 0.06em; text-transform: uppercase; color: var(--wds-text-secondary); }
.scw-box { border: 1pt solid var(--wds-border-strong); }
.scw-foot { display: none; }
@media screen { .scw-doc { box-shadow: 0 1px 2px rgb(23 21 18 / 0.05), 0 8px 24px -6px rgb(23 21 18 / 0.14); padding: 0 40pt 40pt; margin-bottom: 48pt; min-height: 842pt; } .scw-foot { display: flex; justify-content: space-between; border-top: 1pt solid var(--wds-border-strong); padding-top: 8pt; margin-top: 24pt; font-size: 9pt; color: var(--wds-text-secondary); } }
@media print { html, body { background: #fff !important; } .scw-doc { box-shadow: none; padding: 0; } }
`;

export function PrintFrame({
  children,
  footerLeft,
  footerRight,
  onPrint,
  title,
}: {
  children: React.ReactNode;
  footerLeft: string;
  footerRight: string;
  onPrint: () => void;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-wds-neutral-100 print:bg-white" style={{ ['--scw-print-footer' as string]: JSON.stringify(footerLeft), ['--scw-print-footer-right' as string]: JSON.stringify(footerRight) }}>
      <style>{PRINT_CSS}</style>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-wds-border bg-wds-surface px-6 py-3 print:hidden">
        <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{title}</span>
        <button
          type="button"
          onClick={onPrint}
          className="h-8 bg-wds-gradient-primary px-4 font-wds-sans text-wds-body-sm font-medium text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 hover:brightness-110 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]"
        >
          Print
        </button>
      </div>
      <div className="px-4 py-8 print:p-0">
        <article className="scw-doc">
          <table>
            <thead>
              <tr>
                <td>{null}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{children}</td>
              </tr>
            </tbody>
          </table>
          <div className="scw-foot mono">
            <span>{footerLeft}</span>
            <span>{footerRight}</span>
          </div>
        </article>
      </div>
    </div>
  );
}
