'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, ListRow, ListSkeleton, PageHeader, WorkforceKpiStrip, useWorkforcePermissions } from '../../../../_shared';
import { PeopleFrame } from '../../../_shared/components/people-frame';
import { Notice, useNotice } from '../../_shared/components/org-notice';
import { OrgTabs } from '../../_shared/components/org-tabs';
import { useOrgOverview, usePositions } from '../../_shared/hooks/use-org-data';
import type { PositionView } from '../../_shared/types/org-types';
import { positionKpis, positionRowLine, positionRowTone } from '../lib/position-copy';
import { PositionDialog } from './dialogs/position-dialog';
import { RetirePositionDialog } from './dialogs/retire-position-dialog';
import { PositionDetailPane } from './position-detail';

type Dialog = { kind: 'add' } | { kind: 'edit'; position: PositionView } | { kind: 'retire'; position: PositionView };

/**
 * Organisation, Positions (Paper Chapter 3 steps 06 to 09; O10 to O15): the four numbers, the positions on the left and the chosen
 * one on the right. Writing positions is company-wide (`org.write`); everyone who reads the organisation can read them.
 */
export function PositionsTab() {
  const permissions = useWorkforcePermissions();
  const [query, setQuery] = React.useState('');
  const [showRetired, setShowRetired] = React.useState(false);
  const positions = usePositions(query, showRetired, permissions.ready);
  const overview = useOrgOverview(false, permissions.ready);
  const { notice, announce } = useNotice();
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [detailKey, setDetailKey] = React.useState(0);
  const reload = positions.reload;

  const canWrite = permissions.can('org.write');
  const list = positions.data;
  const current = list?.find((p) => p.id === chosen) ?? list?.[0];
  const siteName = React.useCallback((id: string) => overview.data?.organizations.find((s) => s.id === id)?.name ?? '', [overview.data]);
  const departments = React.useMemo(
    () => (overview.data?.organizations ?? []).flatMap((s) => s.departments.filter((d) => d.isActive).map((d) => ({ id: d.id, name: `${d.name} · ${s.name}`, isActive: true }))),
    [overview.data]
  );
  const addButton = canWrite ? <Button size="default" onClick={() => setDialog({ kind: 'add' })}>Add position</Button> : null;
  const closeAndTell = React.useCallback(
    (message: string) => {
      setDialog(null);
      announce(message);
      reload();
      setDetailKey((k) => k + 1);
    },
    [announce, reload]
  );

  const body = (): React.ReactNode => {
    if (permissions.failed) return <ErrorBlock title="Your access did not load" line="Try again in a moment." onRetry={permissions.retry} />;
    if (positions.status === 'error' && !list) {
      return positions.error.status === 403 ? (
        <ErrorBlock title="Your role does not open Positions" line="Ask HR if you need to see them." />
      ) : (
        <ErrorBlock title="The positions did not load" line="Check your connection and try again." onRetry={positions.reload} />
      );
    }
    if (!list) return <ListSkeleton rows={6} label="Loading the positions" />;
    const idle = list.find((p) => p.isActive && p.holderCount === 0);
    return (
      <>
        {query === '' && !showRetired ? <WorkforceKpiStrip aria-label="Position numbers" cells={positionKpis(list, () => idle && setChosen(idle.id))} /> : null}
        <OrgTabs value="positions" positionCount={list.filter((p) => p.isActive).length} />
        <div className="-mt-5 flex min-h-[430px] w-full border-t border-wds-text-ink bg-wds-neutral-0 max-md:flex-col">
          <div className="flex w-[330px] shrink-0 flex-col border-r border-wds-text-ink max-md:w-full max-md:border-b max-md:border-r-0">
            <div className="flex h-9 items-center justify-between px-4">
              <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Positions</span>
              <span className="font-wds-sans text-[12px] text-wds-text-muted">{list.length}</span>
            </div>
            {list.length === 0 ? (
              <EmptyState kind={query ? 'nothingFound' : 'nothingYet'} title={query ? 'No position matches' : 'No positions yet'} line={query ? 'Try a different word.' : 'Add the first one.'} />
            ) : (
              list.map((p) => (
                <ListRow key={p.id} selected={p.id === current?.id} onSelect={() => setChosen(p.id)} className="flex-col items-stretch gap-0.5 border-b-0 py-3">
                  <span className="flex justify-between gap-2">
                    <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{p.name}</span>
                    <span className={cn('font-wds-mono text-[12px] leading-4', positionRowTone(p) === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{p.holderCount}</span>
                  </span>
                  <span className={cn('font-wds-sans text-[12px] leading-4', positionRowTone(p) === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>
                    {p.isActive ? (p.holderCount === 0 ? 'Nobody holds it' : positionRowLine(p)) : 'Retired'}
                  </span>
                </ListRow>
              ))
            )}
            <button type="button" onClick={() => setShowRetired((v) => !v)} className="m-4 self-start border-0 bg-transparent p-0 font-wds-sans text-[12px] leading-4 text-wds-primary underline-offset-2 hover:underline focus-visible:shadow-wds-ring focus-visible:outline-none">
              {showRetired ? 'Hide retired positions' : 'Show retired positions'}
            </button>
          </div>
          <section aria-label="Position" className="min-w-0 flex-1">
            {current ? (
              <PositionDetailPane
                id={current.id}
                canWrite={canWrite}
                siteName={siteName}
                reloadKey={detailKey}
                onEdit={() => setDialog({ kind: 'edit', position: current })}
                onRetire={() => setDialog({ kind: 'retire', position: current })}
              />
            ) : null}
          </section>
        </div>
      </>
    );
  };

  return (
    <PeopleFrame
      breadcrumb={{ root: 'People', section: 'Organisation', sectionHref: '/app/workforce/organisation', screen: 'Positions' }}
      phoneTitle="Positions"
      label="Positions"
      actions={addButton}
      searchProps={{ value: query, onChange: (e) => setQuery(e.target.value), placeholder: 'Find a position', shortcutHint: '', 'aria-label': 'Find a position', className: 'w-[380px]' }}
    >
      <div className="flex w-full flex-col gap-[18px] px-wds-8 py-7 max-md:px-4">
        <PageHeader title="Organisation" subtitle="A position is what someone does. It is not a department and not a login role. It decides whether the person clocks in." actions={addButton ? <span className="lg:hidden">{addButton}</span> : undefined} />
        <Notice message={notice} />
        {body()}
      </div>
      {dialog?.kind === 'add' || dialog?.kind === 'edit' ? (
        <PositionDialog position={dialog.kind === 'edit' ? dialog.position : null} departments={departments} onClose={() => setDialog(null)} done={closeAndTell} />
      ) : null}
      {dialog?.kind === 'retire' ? <RetirePositionDialog position={dialog.position} restore={!dialog.position.isActive} onClose={() => setDialog(null)} done={closeAndTell} /> : null}
    </PeopleFrame>
  );
}
