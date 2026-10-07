'use client';

import * as React from 'react';

import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import { PrintFrame } from './print-frame';

/**
 * The blank count sheet (Paper step 43, `24O2-0`, `27N7-0`; `/app/inventory/count-print/blank`): every section in shelf order with
 * item, unit and an empty box, a "counted by / date / time" line, and no stock figure anywhere. A4. Nothing prints by itself.
 */
export function BlankSheetPage() {
  const sheet = useLoader('blank-sheet', () => countingApi.blankSheet(), COUNTING_STATES_COPY.printedPages.error);
  const data = sheet.data;
  if (sheet.status === 'error') return <ScwStatePanel kind="error" text={COUNTING_STATES_COPY.printedPages.error} onRetry={() => void sheet.reload()} className="m-8" />;
  if (!data) return <LoadingAnnouncer text={COUNTING_STATES_COPY.printedPages.loading} />;
  const names = data.sections.map((s) => s.name).join(', ');
  return (
    <PrintFrame title="Blank count sheet" footerLeft="Blank count sheet · Central Store" footerRight="No stock figures on this sheet" onPrint={() => window.print()}>
      <header className="scw-head">
        <div className="scw-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/wendo-logo.jpg" alt="" />
          <div>
            <b>Wendo Coffee Bistro</b>
            <span>Central Store · Nyeri, Kenya</span>
          </div>
        </div>
        <div className="scw-title">
          <span className="eyebrow mono">BLANK COUNT SHEET</span>
          <span className="big mono">{data.dateText}</span>
          <span className="sub">{data.printedAtText}</span>
        </div>
      </header>
      <div style={{ display: 'flex', gap: '24pt', margin: '18pt 0 14pt' }}>
        {[['COUNTED BY', 1], ['DATE', 0], ['TIME', 0]].map(([label, grow]) => (
          <div key={label as string} style={{ flex: grow ? 1 : undefined, width: grow ? undefined : label === 'DATE' ? '130pt' : '110pt' }}>
            <div className="scw-label mono">{label}</div>
            <div style={{ height: '22pt', borderBottom: '1pt solid var(--wds-text-ink)' }} />
          </div>
        ))}
      </div>
      {data.sections.map((section, idx) => (
        <section key={section.id} style={{ breakBefore: idx === 0 ? undefined : 'auto', marginBottom: '18pt' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6pt 0', breakAfter: 'avoid' }}>
            <h2 style={{ fontSize: '16pt', fontWeight: 600, lineHeight: '22pt', margin: 0 }}>{section.name}</h2>
            <span style={{ fontSize: '11pt', color: 'var(--wds-text-secondary)' }}>{section.detail}</span>
          </div>
          <table>
            <thead>
              <tr style={{ height: '24pt', borderTop: '1pt solid var(--wds-text-ink)', borderBottom: '1pt solid var(--wds-border-strong)' }} className="scw-label mono">
                <th style={{ textAlign: 'left', fontWeight: 400 }}>ITEM</th>
                <th style={{ textAlign: 'left', fontWeight: 400, width: '70pt' }}>UNIT</th>
                <th style={{ textAlign: 'center', fontWeight: 400, width: '90pt' }}>COUNT</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((item, i) => (
                <tr key={`${item.name}-${i}`} style={{ height: '28pt', borderBottom: '1pt solid var(--wds-neutral-100)' }}>
                  <td style={{ fontSize: '12pt' }}>{item.name}</td>
                  <td style={{ fontSize: '11pt', color: 'var(--wds-text-secondary)' }}>{item.unit}</td>
                  <td>
                    <div style={{ height: '20pt', border: '1pt solid var(--wds-neutral-500)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p style={{ fontSize: '11pt', lineHeight: '16pt', color: 'var(--wds-text-secondary)' }}>
        One sheet covers all {data.sections.length} sections in shelf order: {names}. Skip an item by leaving its box empty. Write 0 if the shelf is empty.
      </p>
      <div style={{ marginTop: '36pt', fontSize: '11pt', color: 'var(--wds-text-secondary)', borderTop: '1pt solid var(--wds-text-ink)', paddingTop: '6pt', width: '260pt' }}>Counted by (name and signature)</div>
    </PrintFrame>
  );
}
