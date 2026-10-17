import * as React from 'react';

/** Gallery chrome shared by the section files: a titled block labelled with its Paper node, and a small mono caption. */

export function Section({ id, title, node, note, children }: { id: string; title: string; node: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-wds-text-ink pb-2">
        <h2 className="m-0 font-wds-sans text-[17px] font-semibold text-wds-text-ink">{title}</h2>
        <span className="font-wds-mono text-[11px] text-wds-text-secondary">PAPER {node}</span>
      </header>
      {note ? <p className="mb-4 mt-0 max-w-3xl font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">{note}</p> : null}
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-wds-mono text-[10px] uppercase tracking-[0.08em] text-wds-text-secondary">{children}</div>;
}
