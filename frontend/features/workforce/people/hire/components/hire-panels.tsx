import * as React from 'react';

import { Callout } from '../../../_shared';
import { CASUAL_NOTE, CASUAL_PANEL, JOB_PANEL, JOB_PANEL_NOTE, LOGIN_PANEL, NOT_HR_NOTE, PAY_PANEL, STATUTORY_PANEL } from '../lib/hire-copy';

/**
 * The right-hand panels of the hire steps (Paper Chapter 2): a mono caption, then short lines that say what the choice on the left
 * does. They only explain; nothing here is a control. Step 1's "The file so far" is the kit's `FileSoFarPanel`.
 */
const CAPTION = 'font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-text-secondary';

export function PanelFrame({ caption, label, children }: { caption: string; label: string; children: React.ReactNode }) {
  return (
    <aside aria-label={label} className="flex flex-1 flex-col gap-5 border-l border-wds-border px-8 py-9 max-md:border-l-0 max-md:border-t max-md:py-6">
      <div className={CAPTION}>{caption}</div>
      {children}
    </aside>
  );
}

/** Lines separated by a hairline, as Paper draws them (an `<ol>` when numbered by the copy itself). */
function Lines({ lines }: { lines: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col border-t border-wds-border p-0">
      {lines.map((line) => (
        <li key={line} className="border-b border-wds-border py-3 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
          {line}
        </li>
      ))}
    </ul>
  );
}

export function JobPanel({ first, department, head, canSetPay }: { first: string; department: string | null; head: string | null; canSetPay: boolean }) {
  return (
    <PanelFrame caption="WHAT THIS CHOICE DOES" label="What this choice does">
      <Lines lines={JOB_PANEL(first, department, head)} />
      <Callout tone="warning" size="sm">{canSetPay ? JOB_PANEL_NOTE : NOT_HR_NOTE}</Callout>
    </PanelFrame>
  );
}

export function PayPanel({ first, hourly, working }: { first: string; hourly: string | null; working: string }) {
  return (
    <PanelFrame caption={PAY_PANEL.heading(first).toUpperCase()} label="Hourly equivalent">
      <div className="flex flex-col gap-2 border border-wds-border bg-wds-surface p-[18px]">
        <div className="font-wds-mono text-[26px] leading-8 text-wds-text-ink" aria-live="polite">
          {hourly ? `KES ${hourly}` : 'KES –'}
        </div>
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{hourly ? `${working}. ${PAY_PANEL.lateness}` : 'Fill the amount and the hours to see it.'}</p>
      </div>
      <Callout tone="info" size="sm">{PAY_PANEL.rules}</Callout>
      <Callout tone="warning" size="sm">{PAY_PANEL.hidden}</Callout>
    </PanelFrame>
  );
}

export function CasualPanel({ first, head, manager }: { first: string; head: string | null; manager: string }) {
  return (
    <PanelFrame caption="WHAT A DAY LOOKS LIKE FOR A CASUAL" label="What a casual's day looks like">
      <Lines lines={CASUAL_PANEL(first, head, manager)} />
      <Callout tone="warning" size="sm">{CASUAL_NOTE}</Callout>
    </PanelFrame>
  );
}

export function StatutoryPanel({ first }: { first: string }) {
  return (
    <PanelFrame caption={STATUTORY_PANEL.caption} label="Who does what">
      <dl className="m-0 flex flex-col border-t border-wds-border">
        {STATUTORY_PANEL.rows(first).map((r) => (
          <div key={r.label} className="flex justify-between gap-3 border-b border-wds-border py-2.5">
            <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.label}</dt>
            <dd className={`m-0 text-right font-wds-sans text-[13px] leading-4 ${r.tone === 'success' ? 'text-wds-success-fg' : 'text-wds-warning-fg'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <Callout tone="info" size="sm">{STATUTORY_PANEL.audit}</Callout>
      <Callout tone="warning" size="sm">{STATUTORY_PANEL.held}</Callout>
    </PanelFrame>
  );
}

export function LoginPanel({ first, head, department }: { first: string; head: string | null; department: string | null }) {
  return (
    <PanelFrame caption={LOGIN_PANEL.casualCaption} label="About the login">
      <p className="m-0 font-wds-sans text-[13px] leading-[19px] text-wds-text-ink">{LOGIN_PANEL.casual}</p>
      <div className={CAPTION}>{LOGIN_PANEL.whenCaption}</div>
      <Lines lines={LOGIN_PANEL.lines(first, head, department)} />
    </PanelFrame>
  );
}
