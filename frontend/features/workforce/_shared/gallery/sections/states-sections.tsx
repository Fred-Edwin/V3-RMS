'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import {
  EmptyState,
  ErrorBlock,
  InboxRow,
  ListSkeleton,
  NOTIFICATION_DELIVERY,
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_KIND_TONE,
  NOTIFICATION_PARTS,
  NOTIFICATION_ROWS,
  OfflineStrip,
  SCREEN_KEYS,
  STATES_COPY,
  SavedOnPhoneMarker,
  statesCopy,
} from '../..';
import { Label, Section } from '../gallery-parts';

/** Gallery section 11: the states kit (loading, empty, error, offline) and the per-screen copy table. */
export function StatesSections() {
  const [retrying, setRetrying] = React.useState(false);
  const [showSkeleton, setShowSkeleton] = React.useState(true);

  return (
    <Section id="states" title="11 · States kit" node="1Q6R-0 / 1Q84-0" note="Loading is bars in the shape of the rows; after 8 seconds a line appears. Empty has two kinds. An error replaces only the part that failed. Words come from the per-screen table below.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Label>Loading · a list (wait 8 s for the extra line)</Label>
          {showSkeleton ? <ListSkeleton /> : <p className="text-[13px] text-wds-text-secondary">Hidden.</p>}
          <button type="button" className="mt-2 text-[12px] underline" onClick={() => { setShowSkeleton(false); window.setTimeout(() => setShowSkeleton(true), 50); }}>Restart the 8 second clock</button>
        </div>
        <div>
          <Label>Empty · nothing yet</Label>
          <EmptyState kind="nothingYet" title="No employees yet" line={statesCopy('people', 'nothingYet')} action={{ label: 'Add employee', onClick: () => undefined }} />
        </div>
        <div>
          <Label>Empty · nothing found</Label>
          <EmptyState kind="nothingFound" title="Nothing found" line={statesCopy('people', 'nothingFound', { term: 'Wanj' })} action={{ label: 'Clear the search', onClick: () => undefined }} />
        </div>
        <div>
          <Label>Error</Label>
          <ErrorBlock
            title="We could not load the rota."
            line="Nothing was changed. Try again, and if it keeps failing tell support the reference."
            reference="4F2A"
            retrying={retrying}
            onRetry={() => { setRetrying(true); window.setTimeout(() => setRetrying(false), 1200); }}
          />
        </div>
        <div>
          <Label>Offline strip</Label>
          <OfflineStrip stillWorks="Clock-ins still work and are sent when the signal returns." />
        </div>
        <div>
          <Label>Saved on this phone</Label>
          <SavedOnPhoneMarker what="Clock-in at 06:04, waiting to send" />
        </div>
      </div>
      <div>
        <Label>Per-screen copy table (typed, one row per screen)</Label>
        <div className="overflow-x-auto border border-wds-border bg-wds-surface">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12px] leading-[17px]">
            <thead>
              <tr className="border-b border-wds-text-ink font-wds-mono text-[10px] tracking-[0.08em] text-wds-text-secondary">
                <th className="px-5 py-3 font-normal">SCREEN</th>
                <th className="px-5 py-3 font-normal">EMPTY, NOTHING YET</th>
                <th className="px-5 py-3 font-normal">EMPTY, NOTHING FOUND</th>
                <th className="px-5 py-3 font-normal">ERROR LINE</th>
              </tr>
            </thead>
            <tbody>
              {SCREEN_KEYS.map((k) => (
                <tr key={k} className="border-b border-wds-neutral-100 align-top last:border-b-0">
                  <td className="px-5 py-3 font-semibold text-wds-text-ink">{STATES_COPY[k].screen}</td>
                  <td className="px-5 py-3 text-wds-text-ink">{STATES_COPY[k].nothingYet}</td>
                  <td className="px-5 py-3 text-wds-text-ink">{STATES_COPY[k].nothingFound}</td>
                  <td className="px-5 py-3 text-wds-text-ink">{STATES_COPY[k].error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

/** Gallery section 12: the notification template as Inbox rows, then the wording table. */
export function NotificationSections() {
  return (
    <Section id="notifications" title="12 · Notifications" node="19PW-0 / 19S3-0 / 19TC-0" note="The five-part template as an Inbox row, one per kind (the colour bar), then the wording table as the typed module. Anything that needs a decision goes to Waiting for you, not here.">
      <div className="grid gap-4 lg:grid-cols-2">
        <InboxRow areaKind="ROTA CHANGE" kind="changed" when="3 min" whenExact="Sat 17 Oct, 14:02" title="Sat 17 changed: day off is now Morning" whoAndWhy="Changed by Faith Njeri. Reason: cover for a gap." action={{ label: 'See my rota', onClick: () => undefined }} unread />
        <InboxRow areaKind="ROTA · PUBLISHED" kind="information" when="1 h" title="Your rota for 12 to 18 October is ready. 5 shifts, 40 h." action={{ label: 'See my rota', onClick: () => undefined, emphasis: 'outlined' }} />
        <InboxRow areaKind="OVERTIME" kind="done" when="Yesterday" title="1 h 30 min overtime approved." whoAndWhy="It will be on your October payslip." />
        <InboxRow areaKind="PAYSLIP · SECURITY" kind="problem" when="now" title="Your September payslip was opened on a phone you have not confirmed." whoAndWhy="Tecno phone, Nairobi, 14:05. If it was you, tap Yes, this is my phone." action={{ label: 'Open Activity on my record', onClick: () => undefined }} />
      </div>
      <div className="grid gap-x-8 gap-y-2 text-[12px] sm:grid-cols-2">
        {NOTIFICATION_PARTS.map((p) => (
          <p key={p.n} className="m-0 text-wds-text-secondary"><strong className="text-wds-text-ink">{p.n} {p.name}.</strong> {p.rule}</p>
        ))}
      </div>
      <div>
        <Label>Wording table · {NOTIFICATION_ROWS.length} events</Label>
        <div className="overflow-x-auto border border-wds-border bg-wds-surface">
          <table className="w-full min-w-[980px] border-collapse text-left text-[13px] leading-[19px]">
            <thead>
              <tr className="border-b border-wds-text-ink font-wds-mono text-[10px] tracking-[0.06em] text-wds-text-secondary">
                <th className="w-[300px] px-4 py-2.5 font-normal">EVENT</th>
                <th className="w-[250px] px-4 py-2.5 font-normal">WHO IS TOLD</th>
                <th className="w-[130px] px-4 py-2.5 font-normal">KIND</th>
                <th className="px-4 py-2.5 font-normal">WORDING</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_ROWS.map((r) => (
                <tr key={r.key} className="border-b border-wds-neutral-100 align-top">
                  <td className="px-4 py-2.5 text-wds-text-ink">{r.event}</td>
                  <td className="px-4 py-2.5 text-wds-text-secondary">{r.whoIsTold}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(NOTIFICATION_KIND_TONE[r.kind] === 'info' && 'text-wds-info-fg', NOTIFICATION_KIND_TONE[r.kind] === 'amber' && 'text-wds-warning-fg', NOTIFICATION_KIND_TONE[r.kind] === 'success' && 'text-wds-success-fg', NOTIFICATION_KIND_TONE[r.kind] === 'error' && 'text-wds-error-fg')}>
                      {NOTIFICATION_KIND_LABEL[r.kind]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-wds-text-ink">{r.wording}</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2.5 text-wds-text-ink">Where and when</td>
                <td className="px-4 py-2.5 text-wds-text-secondary">{NOTIFICATION_DELIVERY.where}</td>
                <td className="px-4 py-2.5 text-wds-text-ink">All</td>
                <td className="px-4 py-2.5 text-wds-text-secondary">{NOTIFICATION_DELIVERY.wording}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
