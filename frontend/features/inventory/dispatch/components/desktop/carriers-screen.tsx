'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';

import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { Input } from '@/components/ui2/input';
import { Skeleton } from '@/components/ui2/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { DecisionDialog, DialogLabel } from '../../../_shared/components/decision-dialog';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { useAction, useLoader } from '../../../_shared/hooks/use-async';
import { CARRIER_KINDS, CARRIER_NAME_MAX, type Carrier, type CarrierKind } from '../../_shared/types/dispatch-contract';
import { CARRIER_KIND_TEXT, EMPTY, errorText } from '../../lib/dispatch-words';
import { dispatchDesktopApi } from '../../services/dispatch-desktop-api';
import { ChoiceChips } from './choice-chips';

type Dialog = { kind: 'add' } | { kind: 'rename'; row: Carrier } | { kind: 'retire'; row: Carrier };

/**
 * Paper D18 and the D22 dialogs: who takes a delivery to a branch. A carrier is a name or a vehicle, never a user. The kind is chosen
 * once and cannot change, so a rename touches the name only. Retiring keeps the carrier on every delivery it carried. The Store
 * Manager and System Admin manage the list; the Director, Accountant and Branch Manager read it (no Add button, no row menu).
 */
export function CarriersScreen() {
  const list = useLoader('carriers', () => dispatchDesktopApi.carriers({ status: 'all' }), 'Could not load the carriers.');
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<CarrierKind | ''>('');
  const data = list.data;
  const reload = list.reload;
  const canManage = data?.can.manage ?? false;

  const add = useAction((input: { name: string; kind: CarrierKind }) => dispatchDesktopApi.addCarrier(input), 'Could not add the carrier. Try again.');
  const update = useAction((input: { id: string; name?: string; active?: boolean }) => dispatchDesktopApi.updateCarrier(input.id, { name: input.name, active: input.active }), 'Could not save the carrier. Try again.');
  const active = dialog?.kind === 'add' ? add : update;
  const failure = active.failure ? errorText(active.failure.code, active.failure.message) : null;
  const nameTaken = active.failure?.code === 'CARRIER_NAME_TAKEN';
  const toast = (title: string, description?: string): void => {
    useWdsToastStore.getState().addToast({ variant: 'success', title, description });
  };

  const returnTo = React.useRef<HTMLElement | null>(null);
  const addButton = React.useRef<HTMLButtonElement>(null);
  const open = (next: Dialog | null): void => {
    if (next) returnTo.current = next.kind === 'add' ? addButton.current : document.querySelector<HTMLElement>(`[aria-label="Actions for ${next.row.name}"]`);
    add.clear();
    update.clear();
    setName(next?.kind === 'rename' ? next.row.name : '');
    setKind('');
    setDialog(next);
  };

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= CARRIER_NAME_MAX && (dialog?.kind !== 'add' || kind !== '');

  const submit = async (): Promise<void> => {
    if (!dialog) return;
    if (dialog.kind === 'add') {
      if (kind === '') return;
      const row = await add.run({ name: trimmed, kind });
      if (row) {
        open(null);
        toast('Carrier added', `${row.name} now shows when the store chooses who carries a delivery.`);
        void reload();
      }
    } else if (dialog.kind === 'rename') {
      const row = await update.run({ id: dialog.row.id, name: trimmed });
      if (row) {
        open(null);
        toast('Carrier renamed', 'Past deliveries keep the old name in their history.');
        void reload();
      }
    } else {
      const row = await update.run({ id: dialog.row.id, active: false });
      if (row) {
        open(null);
        toast('Carrier retired', 'It stays on the deliveries it carried.');
        void reload();
      }
    }
  };
  const doRestore = async (row: Carrier): Promise<void> => {
    const result = await update.run({ id: row.id, active: true });
    if (result) {
      toast('Carrier restored', `${row.name} shows in the picker again.`);
      void reload();
    } else useWdsToastStore.getState().addToast({ variant: 'error', title: 'Could not restore', description: 'Try again.' });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar hideSearch breadcrumb={{ root: 'Procurement', section: 'Settings', screen: 'Carriers' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 py-7">
        <div className="flex items-start justify-between gap-6">
          <div className="flex max-w-[640px] flex-col gap-1.5">
            <h1 className="font-wds-sans text-wds-mobile-title tracking-[-0.01em] text-wds-text-ink">Carriers</h1>
            <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Who takes a delivery to a branch. Chosen when the Store Attendant signs. A carrier is a name or a vehicle, not a user.{data && !canManage ? ' Read only here: the Store Manager adds, renames and retires carriers.' : ''}</p>
          </div>
          {canManage ? (
            <Button ref={addButton} size="lg" className="h-10 px-[18px] text-[14px] leading-[18px]" onClick={() => open({ kind: 'add' })}>
              Add a carrier
            </Button>
          ) : null}
        </div>

        {list.status === 'error' ? (
          <ErrorState title="Couldn't load the carriers" description="Check your connection and try again." onRetry={() => void reload()} />
        ) : !data ? (
          <div aria-hidden className="flex flex-col gap-2">
            <LoadingAnnouncer text="Getting the carriers" />
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : data.carriers.length === 0 ? (
          <EmptyState title={canManage ? EMPTY.carriers.title : EMPTY['carriers-readonly'].title} description={canManage ? EMPTY.carriers.line : EMPTY['carriers-readonly'].line} />
        ) : (
          <>
            <Table aria-label="Carriers">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-wds-text-secondary">Carrier</TableHead>
                  <TableHead className="w-[220px] text-wds-text-secondary">Kind</TableHead>
                  <TableHead className="w-[140px] text-right text-wds-text-secondary">Deliveries this month</TableHead>
                  <TableHead className="w-[120px] text-wds-text-secondary">Status</TableHead>
                  {canManage ? (
                    <TableHead className="w-[40px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.carriers.map((row) => {
                  const retired = !row.active;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className={cn('py-[13px] font-wds-sans text-[14px] font-medium leading-[18px]', retired ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{row.name}</TableCell>
                      <TableCell className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{CARRIER_KIND_TEXT[row.kind]}</TableCell>
                      <TableCell className={cn('text-right font-wds-mono text-[14px] leading-[18px]', retired ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{row.deliveriesThisMonth}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1.5 border px-2 py-[3px] font-wds-sans text-[12px] leading-[14px]', retired ? 'border-wds-border-strong bg-wds-neutral-50 text-wds-text-secondary' : 'border-wds-success-border bg-wds-success-bg text-wds-success-fg')}>
                          <span aria-hidden className={cn('size-1.5 rounded-full', retired ? 'border border-wds-text-secondary' : 'bg-wds-success-fg')} />
                          {retired ? 'Retired' : 'Active'}
                        </span>
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="secondary" size="icon" className="h-7 w-10" aria-label={`Actions for ${row.name}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[300px]">
                              {!retired ? (
                                <>
                                  <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={() => open({ kind: 'rename', row })}>
                                    <span className="text-[16px]">Rename</span>
                                    <span className="text-[14px] text-wds-text-secondary">Past deliveries keep the old name</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={() => open({ kind: 'retire', row })}>
                                    <span className="text-[16px] text-wds-error-fg">Retire</span>
                                    <span className="text-[14px] text-wds-text-secondary">Leaves the picker; history is kept</span>
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={() => void doRestore(row)}>
                                  <span className="text-[16px]">Restore</span>
                                  <span className="text-[14px] text-wds-text-secondary">Shows in the picker again</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="max-w-[760px] font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">A retired carrier stays on the deliveries it already carried and no longer appears in the picker. Nothing is deleted. Every dispatch records who carried it, so a loss can be traced.</p>
          </>
        )}
      </main>

      <DecisionDialog
        open={dialog !== null}
        onOpenChange={(next) => !next && open(null)}
        title={dialog?.kind === 'add' ? 'Add a carrier' : dialog?.kind === 'rename' ? `Rename ${dialog.row.name}` : dialog?.kind === 'retire' ? `Retire ${dialog.row.name}?` : ''}
        description={dialog?.kind === 'add' ? 'Settings · Carriers. The kind is chosen once and cannot be changed.' : dialog?.kind === 'rename' ? 'Settings · Carriers. Past deliveries keep the old name in their history.' : 'Settings · Carriers'}
        tone={dialog?.kind === 'retire' ? 'warning' : undefined}
        error={failure && !nameTaken ? failure : null}
        busy={active.saving}
        returnFocus={() => returnTo.current}
        actions={
          <>
            <Button variant="secondary" onClick={() => open(null)} disabled={active.saving}>
              {dialog?.kind === 'retire' ? 'Keep it' : 'Cancel'}
            </Button>
            <Button variant={dialog?.kind === 'retire' ? 'destructive' : 'primary'} onClick={() => void submit()} disabled={active.saving || (dialog?.kind !== 'retire' && !valid)}>
              {dialog?.kind === 'add' ? 'Add carrier' : dialog?.kind === 'rename' ? 'Save name' : 'Retire carrier'}
            </Button>
          </>
        }
      >
        {dialog?.kind === 'retire' ? (
          <>
            <p className="font-wds-sans text-[15px] leading-6 text-wds-text-ink">
              It will no longer appear when the store chooses who carries a delivery. It stays on the {dialog.row.deliveriesThisMonth} {dialog.row.deliveriesThisMonth === 1 ? 'delivery' : 'deliveries'} it carried this month and on every older one.
            </p>
            <p className="font-wds-sans text-[13px] text-wds-text-secondary">You can restore it later from its row menu.</p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <DialogLabel htmlFor="carrier-name">Name</DialogLabel>
              <Input
                id="carrier-name"
                autoFocus
                value={name}
                maxLength={CARRIER_NAME_MAX}
                aria-invalid={nameTaken || undefined}
                aria-describedby={nameTaken ? 'carrier-name-error' : undefined}
                className={nameTaken ? 'border-wds-error-fg' : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  add.clear();
                  update.clear();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && valid) void submit();
                }}
                placeholder="Wendo van KCB 214K"
              />
              {nameTaken ? (
                <p id="carrier-name-error" role="alert" className="font-wds-sans text-[13px] text-wds-error-fg">
                  {errorText('CARRIER_NAME_TAKEN', null)}
                </p>
              ) : null}
            </div>
            {dialog?.kind === 'add' ? (
              <div className="flex flex-col gap-2">
                <DialogLabel hint="required">Kind</DialogLabel>
                <ChoiceChips label="Kind of carrier" value={kind} options={CARRIER_KINDS.map((k) => ({ value: k, label: CARRIER_KIND_TEXT[k] }))} onChange={setKind} disabled={add.saving} />
              </div>
            ) : dialog?.kind === 'rename' ? (
              <div className="flex flex-col gap-1">
                <DialogLabel>Kind</DialogLabel>
                <p className="font-wds-sans text-[15px] text-wds-text-ink">{CARRIER_KIND_TEXT[dialog.row.kind]}</p>
                <p className="font-wds-sans text-[13px] text-wds-text-secondary">The kind cannot be changed. Past deliveries keep the old name in their history.</p>
              </div>
            ) : null}
          </>
        )}
      </DecisionDialog>
    </div>
  );
}
