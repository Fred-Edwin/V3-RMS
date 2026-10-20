'use client';

import * as React from 'react';

import { DrawerSection, WorkforceDrawer } from '../../_shared';
import { PAYROLL_STAGES, WHO_DOES_WHAT } from './payroll-copy';

/** The overview of the six stages and who does what (spec S0). Static text; the drawer is named "How payroll works". */
export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <WorkforceDrawer open={open} onOpenChange={(o) => !o && onClose()} title="How payroll works" subtitle="Each month moves through six stages, and each stage has one owner.">
      <DrawerSection caption="THE SIX STAGES">
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {PAYROLL_STAGES.map((stage, i) => (
            <li key={stage.name} className="flex flex-col gap-0.5 border-t border-wds-neutral-100 pt-2.5">
              <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.08em] text-wds-text-secondary">{i + 1} · {stage.name}</span>
              <span className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{stage.title}</span>
              <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{stage.body}</span>
            </li>
          ))}
        </ol>
      </DrawerSection>
      <DrawerSection caption="WHO SEES AND DOES WHAT">
        <dl className="m-0 flex flex-col">
          {WHO_DOES_WHAT.map((row) => (
            <div key={row.who} className="flex flex-col gap-0.5 border-t border-wds-neutral-100 py-2.5">
              <dt className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{row.who}</dt>
              <dd className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{row.does}</dd>
            </div>
          ))}
        </dl>
      </DrawerSection>
      <DrawerSection caption="TAKING IT AWAY, AND MISTAKES">
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
          Every export is stamped &ldquo;Draft, not approved&rdquo; until the Accountant approves, and is kept in the audit log. After publishing, HR or the Accountant can correct one payslip with a reason and a PIN until the Accountant marks the month paid. Paid locks the month; a mistake found later is a line in next month&rsquo;s payroll.
        </p>
      </DrawerSection>
    </WorkforceDrawer>
  );
}
