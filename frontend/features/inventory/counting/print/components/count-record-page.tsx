'use client';

import * as React from 'react';

import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { signedMoney, signedKes, plainQty } from '../../_shared/lib/count-format';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import { PrintFrame } from './print-frame';

const neg = (v: string): boolean => Number(v) < 0;

/**
 * The count record (Paper step 44, `24O7-0`; `/app/inventory/count-print/[id]`): sections, who counted, the time, counted /
 * differences / net value, the differences with what was decided, a note about skipped items, and both signatures in the
 * signature font with "signed with PIN" and the times. For the Manager's copy, so it shows expected stock. A4; nothing prints by itself.
 */
export function CountRecordPage({ countId }: { countId: string }) {
  const rec = useLoader(`record:${countId}`, () => countingApi.recordPrint(countId), COUNTING_STATES_COPY.printedPages.error);
  const d = rec.data;
  if (rec.status === 'error') return <ScwStatePanel kind="error" text={COUNTING_STATES_COPY.printedPages.error} onRetry={() => void rec.reload()} className="m-8" />;
  if (!d) return <LoadingAnnouncer text={COUNTING_STATES_COPY.printedPages.loading} />;
  const head = ['ITEM', 'EXP.', 'COUNT', 'DIFF.', 'KES', 'DECISION'];
  return (
    <PrintFrame title={`Count record ${d.reference}`} footerLeft={`${d.reference} · Central Store`} footerRight={d.generatedText} onPrint={() => window.print()}>
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
          <span className="eyebrow mono">COUNT RECORD</span>
          <span className="big mono">{d.reference}</span>
          <span className="sub">{d.generatedText.replace('Generated ', '').replace(/, \d\d:\d\d$/, '')}</span>
        </div>
      </header>
      <div style={{ display: 'flex', gap: '24pt', margin: '18pt 0 14pt' }}>
        {[['SECTIONS', d.sectionsText], ['COUNTED BY', d.counterName], ['TIME', d.timeText.replace(' to ', ' to ')]].map(([l, v]) => (
          <div key={l} style={{ flex: 1 }}>
            <div className="scw-label mono">{l}</div>
            <div style={{ fontSize: '12pt', lineHeight: '18pt', marginTop: '4pt' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12pt', marginBottom: '20pt' }}>
        {[['COUNTED', `${d.counted} of ${d.total}`, false], ['DIFFERENCES', String(d.differences), false], ['NET VALUE', signedKes(d.netValueKes), neg(d.netValueKes)]].map(([l, v, red]) => (
          <div key={l as string} className="scw-box" style={{ flex: 1, padding: '8pt 12pt' }}>
            <div className="scw-label mono" style={{ fontSize: '8pt' }}>{l}</div>
            <div className="mono" style={{ fontSize: '16pt', lineHeight: '24pt', color: red ? 'var(--wds-error-fg)' : undefined }}>{v}</div>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: '14pt', fontWeight: 600, margin: '0 0 8pt' }}>Differences and what was decided</h2>
      <table>
        <thead>
          <tr style={{ height: '26pt', borderTop: '1pt solid var(--wds-text-ink)', borderBottom: '1pt solid var(--wds-border-strong)' }} className="scw-label mono">
            {head.map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 || i === 5 ? 'left' : 'right', fontWeight: 400, fontSize: '9pt', paddingLeft: i === 5 ? '12pt' : undefined }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.itemName} style={{ height: '30pt', borderBottom: '1pt solid var(--wds-neutral-100)' }}>
              <td style={{ fontSize: '12pt' }}>{r.itemName}</td>
              <td className="mono" style={{ textAlign: 'right', fontSize: '11pt', color: 'var(--wds-text-secondary)' }}>{plainQty(r.expected)}</td>
              <td className="mono" style={{ textAlign: 'right', fontSize: '11pt' }}>{plainQty(r.counted)}</td>
              <td className="mono" style={{ textAlign: 'right', fontSize: '11pt', color: neg(r.difference) ? 'var(--wds-error-fg)' : undefined }}>{plainQty(r.difference).replace('-', '−')}</td>
              <td className="mono" style={{ textAlign: 'right', fontSize: '11pt', color: neg(r.valueKes) ? 'var(--wds-error-fg)' : undefined }}>{signedMoney(r.valueKes)}</td>
              <td style={{ fontSize: '11pt', paddingLeft: '12pt' }}>{r.decisionText}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '11pt', lineHeight: '16pt', color: 'var(--wds-text-secondary)', margin: '14pt 0 0' }}>{d.footnote}</p>
      <div style={{ display: 'flex', gap: '24pt', marginTop: '56pt', breakInside: 'avoid' }}>
        {d.signatures.map((s) => (
          <div key={s.role} style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-signature), "Alex Brush", cursive', fontSize: '30pt', lineHeight: '36pt', paddingBottom: '2pt', borderBottom: '1pt solid var(--wds-text-ink)' }}>{s.name}</div>
            <div style={{ fontSize: '10pt', lineHeight: '14pt', color: 'var(--wds-text-secondary)', marginTop: '4pt' }}>
              {s.role === 'COUNTED_BY' ? 'Counted by' : 'Approved by'} · {s.roleLabel === 'Store Attendant' ? '' : `${s.roleLabel} · `}signed with PIN · {s.signedAtText}
            </div>
          </div>
        ))}
      </div>
    </PrintFrame>
  );
}
