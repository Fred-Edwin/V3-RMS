'use client';

import * as React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { Callout, ErrorBlock, ListSkeleton, Panel, useRemote } from '../../../_shared';
import { peopleReads, useRoster, type Lookups } from '../../../people';
import { NumbersEditor } from '../../change/number-editor';
import { ChangeLink } from '../../components/change-link';
import { useOnline, useRulesPage } from '../../hooks/use-rules-data';
import { isLocked, type LeaveValues, type RulesPage, type SavedVersion } from '../../types/rules-types';

/** "MINIMUM COVER · NYERI TOWN": the fewest people on at once, per department, for one site. Only ever a warning. */
function CoverTable({ page, lookups, onSaved, onStale }: { page: RulesPage; lookups: Lookups; onSaved: (s: SavedVersion) => void; onStale: () => void }) {
  const online = useOnline();
  const roster = useRoster();
  const [editing, setEditing] = React.useState<{ id: string; name: string } | null>(null);
  const answer = page.rows.minimumCover;
  const cover = (page.values as unknown as LeaveValues).minimumCover;
  const departments = lookups.departments.filter((d) => d.isActive && d.organizationId === page.organizationId);
  const people = (id: string): number | null =>
    roster.data ? roster.data.filter((r) => r.departmentId === id && r.status !== 'EXITED').length : null;

  return (
    <>
      <Table look="workforce" aria-label="Minimum cover">
        <TableHeader>
          <TableRow>
            <TableHead>DEPARTMENT</TableHead>
            <TableHead className="text-right">PEOPLE</TableHead>
            <TableHead className="text-right">LEAST ON</TableHead>
            <TableHead className="w-[72px]"><span className="sr-only">Change</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.map((d) => {
            const set = cover[d.id];
            const thing = `minimum cover for ${d.name}`;
            return (
              <TableRow key={d.id}>
                <TableCell>{d.name}</TableCell>
                <TableCell className="text-right font-wds-mono">{people(d.id) ?? '–'}</TableCell>
                <TableCell className="text-right font-wds-mono">{set === undefined ? <span className="font-wds-sans text-wds-text-secondary">No minimum set</span> : set}</TableCell>
                <TableCell>
                  {answer?.canChange ? (
                    <ChangeLink thing={thing} state={{ kind: 'change' }} onChange={() => setEditing(d)} offline={!online} />
                  ) : (
                    <ChangeLink thing={thing} state={{ kind: 'locked', whoCan: answer?.lockedReason?.whoCan ?? [] }} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {editing ? (
        <NumbersEditor
          page={page}
          onSaved={onSaved}
          onStale={onStale}
          onClose={() => setEditing(null)}
          config={{
            title: `Change minimum cover · ${editing.name}`,
            helper: `${editing.name} has ${people(editing.id) ?? 'some'} people. Below this number the system warns the approver and the person asking; it never blocks. Leave already approved stays as it is.`,
            specs: [{ min: 0, max: people(editing.id) ?? 99, name: `least people on in ${editing.name}` }],
            read: () => [cover[editing.id] ?? null],
            now: () => [cover[editing.id] === undefined ? 'None' : `${cover[editing.id]} of ${people(editing.id) ?? '?'}`],
            build: ([n]) => ({ minimumCover: { ...cover, [editing.id]: n } }),
          }}
        />
      ) : null}
    </>
  );
}

/**
 * The right-hand panel. A viewer of one site (a Branch Manager) reads that site's page, which the screen already holds. A company-wide
 * viewer gets a site select and reads that site's own page, so the cover shown and changed is always one site's.
 */
export function CoverPanel({ page, onSaved, onStale }: { page: RulesPage; onSaved: (s: SavedVersion) => void; onStale: () => void }) {
  const lookups = useRemote<Lookups>(() => peopleReads.lookups(), 'rules-lookups');
  const [chosen, setChosen] = React.useState<string | null>(null);
  const own = page.organizationId !== null;
  const siteId = own ? page.organizationId : (chosen ?? page.organizations[0]?.organizationId ?? null);
  const sitePage = useRulesPage('LEAVE', siteId, !own && siteId !== null);
  const sitePageData = own ? page : sitePage.data && !isLocked(sitePage.data) ? sitePage.data : null;
  const refreshed = (s: SavedVersion): void => {
    sitePage.reload();
    onSaved(s);
  };

  return (
    <Panel title={`MINIMUM COVER${sitePageData?.organizationName ? ` · ${sitePageData.organizationName.toUpperCase()}` : ''}`} padded={false}>
      {!own && page.organizations.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-wds-border px-[18px] py-3" role="group" aria-label="Site">
          {page.organizations.map((o) => (
            <button key={o.organizationId} type="button" aria-pressed={o.organizationId === siteId} onClick={() => setChosen(o.organizationId)} className={o.organizationId === siteId ? 'border border-wds-text-ink bg-wds-text-ink px-3 py-1 font-wds-sans text-[13px] text-wds-primary-fg' : 'border border-wds-border-strong px-3 py-1 font-wds-sans text-[13px] text-wds-text-ink'}>
              {o.organizationName}
            </button>
          ))}
        </div>
      ) : null}
      {lookups.status === 'loading' || (!own && sitePage.status === 'loading') ? (
        <ListSkeleton rows={4} label="Loading minimum cover" />
      ) : lookups.status === 'error' ? (
        <ErrorBlock title="We could not load the departments" line="Leave types are not affected." onRetry={lookups.reload} />
      ) : sitePageData ? (
        <CoverTable page={sitePageData} lookups={lookups.data} onSaved={refreshed} onStale={onStale} />
      ) : (
        <Callout tone="neutral" variant="dashed">Minimum cover is set for one site at a time. No site is available to you.</Callout>
      )}
      <p className="m-0 border-t border-wds-border px-[18px] py-3 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Set by the Branch Manager of this site, the Director or the System Admin. Where you cannot change it, Change shows a padlock and says who can.
      </p>
    </Panel>
  );
}
