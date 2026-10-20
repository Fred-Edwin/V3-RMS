import * as React from 'react';

export interface FigureRow {
  label: string;
  value: string;
  /** Digits and formulas read in the mono face (Paper: "1.5 ×", "Basic ÷ 208"). */
  mono?: boolean;
}

export interface FigureCell {
  label: string;
  value: string;
}

/**
 * The flat card Paper draws for Rules applied and Tax and deductions (steps 14 and 15): a header with the name,
 * a version chip and one link; thin label and value rows; a grey strip of figures flush at the foot.
 */
export function FiguresCard({
  title,
  chip,
  aside,
  rows,
  cells,
  note,
}: {
  title: string;
  /** "v4 · from 1 Aug", "monthly bands". */
  chip?: string;
  /** Right side of the header: the "Rules ↗" link, or "employee share". */
  aside?: React.ReactNode;
  rows: FigureRow[];
  cells: FigureCell[];
  /** A grey line under the rows ("Not used this month"). */
  note?: string;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col border border-wds-border bg-wds-surface">
      <header className="flex items-center justify-between gap-2 border-b border-wds-neutral-950 px-3.5 py-[11px]">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="m-0 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{title}</h3>
          {chip ? <span className="bg-wds-neutral-100 px-1.5 py-0.5 font-wds-mono text-[10px] leading-3 text-wds-text-secondary">{chip}</span> : null}
        </div>
        {aside ? <div className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{aside}</div> : null}
      </header>
      <ul className="m-0 flex list-none flex-col px-3.5 pb-1.5 pt-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between gap-4 border-b border-wds-neutral-100 py-1.5 last:border-b-0">
            <span className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.label}</span>
            <span className={`min-w-0 break-words text-right text-[12px] leading-4 text-wds-text-ink ${r.mono ? 'font-wds-mono' : 'font-wds-sans'}`}>{r.value}</span>
          </li>
        ))}
        {note ? <li className="py-1.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{note}</li> : null}
      </ul>
      <dl className="m-0 mt-auto flex border-t border-wds-neutral-950 bg-wds-neutral-50">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-1 flex-col gap-0.5 border-r border-wds-border px-3.5 py-2.5 last:border-r-0">
            <dt className="font-wds-mono text-[9px] uppercase leading-3 tracking-[0.08em] text-wds-text-secondary">{c.label}</dt>
            <dd className="m-0 font-wds-sans text-[18px] font-semibold leading-[22px] text-wds-text-ink">{c.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
