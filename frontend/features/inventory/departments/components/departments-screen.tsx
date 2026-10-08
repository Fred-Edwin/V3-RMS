'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import { ErrorState, EmptyState } from '@/components/app/shell/shell-states';
import { Button } from '@/components/ui2/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { Input } from '@/components/ui2/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { Skeleton } from '@/components/ui2/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { cn } from '@/lib/cn';
import { DecisionDialog, DialogLabel } from '../../_shared/components/decision-dialog';
import { LoadingAnnouncer } from '../../_shared/components/scw-states';
import { useAction, useLoader } from '../../_shared/hooks/use-async';
import type { Person } from '../../_shared/types/wire';
import { errorWords } from '../../requisitions/_shared/lib/requisitions-words';
import { departmentsApi } from '../services/departments-api';
import type { DepartmentRow } from '../types/departments-contract';

const shortName = (p: Person | null): string => {
  if (!p) return 'none';
  const [first = '', ...rest] = p.name.split(' ');
  const last = rest[rest.length - 1];
  return last ? `${first} ${last.charAt(0)}.` : first;
};
const retiredOn = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short' }).format(new Date(iso));

type Dialog = { kind: 'add' } | { kind: 'rename'; row: DepartmentRow } | { kind: 'retire'; row: DepartmentRow };

/**
 * Paper step 20 (the Branch Manager) and G4 (read only, with a branch picker, for the Director and the other hub roles). Rows
 * show what the server's `can` flags allow, and nothing else is drawn. A retired department keeps its past requisitions.
 * Block 1 stops at add, rename, retire and restore; tagging items, a head and staff to an added department waits for a Paper design.
 */
export function DepartmentsScreen({ breadcrumb }: { breadcrumb: TopbarBreadcrumb }) {
  const router = useRouter();
  const params = useSearchParams();
  const branchId = params.get('branchId') ?? undefined;
  const list = useLoader(`departments:${branchId ?? 'own'}`, () => departmentsApi.list({ branchId }), 'Could not load the departments.');
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [name, setName] = React.useState('');
  const data = list.data;
  const reload = list.reload;

  const add = useAction((input: { name: string }) => departmentsApi.add({ branchId: data?.branch.id ?? '', name: input.name }), 'Could not add the department. Try again.');
  const rename = useAction((input: { id: string; name: string }) => departmentsApi.rename(input.id, { name: input.name }), 'Could not rename the department. Try again.');
  const retire = useAction((id: string) => departmentsApi.retire(id), 'Could not retire the department. Try again.');
  const restore = useAction((id: string) => departmentsApi.restore(id), 'Could not restore the department. Try again.');

  const active = dialog?.kind === 'add' ? add : dialog?.kind === 'rename' ? rename : retire;
  const failure = active.failure ? errorWords(active.failure.code, 'manager', active.failure.message, active.failure.message) : null;
  const toast = (title: string, description?: string): void => {
    useWdsToastStore.getState().addToast({ variant: 'success', title, description });
  };

  const open = (next: Dialog | null): void => {
    add.clear();
    rename.clear();
    retire.clear();
    setName(next?.kind === 'rename' ? next.row.name : '');
    setDialog(next);
  };

  const submit = async (): Promise<void> => {
    if (!dialog) return;
    const trimmed = name.trim();
    if (dialog.kind === 'add') {
      const row = await add.run({ name: trimmed });
      if (row) { open(null); toast('Department added', `${row.name} gets a section in every new requisition.`); void reload(); }
    } else if (dialog.kind === 'rename') {
      const row = await rename.run({ id: dialog.row.id, name: trimmed });
      if (row) { open(null); toast('Department renamed', 'Past requisitions show the new name.'); void reload(); }
    } else {
      const row = await retire.run(dialog.row.id);
      if (row) { open(null); toast('Department retired', 'Its past requisitions are kept.'); void reload(); }
    }
  };
  const doRestore = async (row: DepartmentRow): Promise<void> => {
    const result = await restore.run(row.id);
    if (result) { toast('Department restored', `${row.name} gets a section in new requisitions again.`); void reload(); }
    else useWdsToastStore.getState().addToast({ variant: 'error', title: 'Could not restore', description: 'Try again.' });
  };

  const readOnly = data ? !data.canAdd && data.rows.every((r) => !r.can.rename && !r.can.retire && !r.can.restore) : true;
  const hasMenu = (r: DepartmentRow): boolean => r.can.rename || r.can.retire || r.can.restore;
  const valid = name.trim().length > 0 && name.trim().length <= 40;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar hideSearch breadcrumb={breadcrumb} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex items-start justify-between gap-6">
          <div className="flex max-w-[760px] flex-col gap-1">
            <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Departments</h1>
            <p className="font-wds-sans text-[15px] leading-[22px] text-wds-text-secondary">
              {readOnly
                ? 'Each active department gets a section in every requisition. Read only here: the Branch Manager adds, renames or retires departments.'
                : `${data?.branch.name ?? 'This branch'} · each active department gets a section in every requisition. A department with no items counts as done.`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {data?.branches ? (
              <Select value={data.branch.id} onValueChange={(id) => router.replace(`?branchId=${id}`, { scroll: false })}>
                <SelectTrigger aria-label="Branch" className="h-10 w-[210px] text-[14px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {data.branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>Branch: {b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {data?.canAdd ? <Button size="lg" onClick={() => open({ kind: 'add' })}>Add a department</Button> : null}
          </div>
        </div>

        {list.status === 'error' ? (
          <ErrorState title="Couldn't load the departments" description="Check your connection and try again." onRetry={() => void reload()} />
        ) : !data ? (
          <div aria-hidden className="flex flex-col gap-2"><LoadingAnnouncer text="Getting the departments" /><Skeleton className="h-10 w-full" />{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : data.rows.length === 0 ? (
          <EmptyState title="No departments yet" description={data.canAdd ? 'Add the first department and it gets a section in every requisition.' : 'This branch has no departments yet.'} />
        ) : (
          <Table aria-label="Departments">
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="w-[260px]">Head</TableHead>
                <TableHead className="w-[140px] text-right">Items tagged</TableHead>
                <TableHead className="w-[160px] pl-8">Status</TableHead>
                <TableHead className="w-[56px]"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => {
                const retired = row.status === 'RETIRED';
                return (
                  <TableRow key={row.id} className={cn(retired && 'text-wds-text-faint')}>
                    <TableCell className="py-3.5">
                      <div className="flex flex-col">
                        <span className={cn('font-wds-sans text-[16px]', retired ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{row.name}</span>
                        {retired && row.retiredAt ? <span className="font-wds-sans text-[14px] text-wds-text-secondary">Retired {retiredOn(row.retiredAt)}. Its past requisitions are kept.</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-wds-sans text-[15px]">{shortName(row.head)}</TableCell>
                    <TableCell className="text-right font-wds-mono text-[15px]">{retired ? '' : row.itemsTagged}</TableCell>
                    <TableCell className="pl-8">
                      <span className={cn('inline-flex h-[26px] items-center gap-1.5 border px-2.5 font-wds-sans text-[14px]', retired ? 'border-wds-border-strong bg-wds-neutral-100 text-wds-text-secondary' : 'border-wds-success-border bg-wds-success-bg text-wds-success-fg')}>
                        {retired ? null : <span aria-hidden className="size-1.5 rounded-full bg-wds-success-fg" />}
                        {retired ? 'Retired' : 'Active'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {hasMenu(row) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" aria-label={`Actions for ${row.name}`}><MoreHorizontal /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[320px]">
                            {row.can.rename ? (
                              <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={() => open({ kind: 'rename', row })}>
                                <span className="text-[16px]">Rename</span>
                                <span className="text-[14px] text-wds-text-secondary">Past requisitions show the new name</span>
                              </DropdownMenuItem>
                            ) : null}
                            {row.can.retire ? (
                              <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={() => open({ kind: 'retire', row })}>
                                <span className="text-[16px] text-wds-error-fg">Retire</span>
                                <span className="text-[14px] text-wds-text-secondary">Stops new sections. Anything open must be sent first.</span>
                              </DropdownMenuItem>
                            ) : null}
                            {row.can.restore ? (
                              <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onSelect={() => void doRestore(row)}>
                                <span className="text-[16px]">Restore</span>
                                <span className="text-[14px] text-wds-text-secondary">New requisitions get a section for it again</span>
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </main>

      <DecisionDialog
        open={dialog !== null}
        onOpenChange={(next) => !next && open(null)}
        title={dialog?.kind === 'add' ? 'Add a department' : dialog?.kind === 'rename' ? `Rename ${dialog.row.name}` : dialog?.kind === 'retire' ? `Retire ${dialog.row.name}?` : ''}
        description={
          dialog?.kind === 'add'
            ? 'It gets a section in every new requisition. Tagging items and staff to it comes later.'
            : dialog?.kind === 'rename'
              ? 'Past requisitions show the new name.'
              : 'It stops getting a section in new requisitions. Its past requisitions are kept, and you can restore it any time.'
        }
        tone={dialog?.kind === 'retire' ? 'warning' : undefined}
        error={failure}
        busy={active.saving}
        actions={
          <>
            <Button variant="secondary" onClick={() => open(null)} disabled={active.saving}>Cancel</Button>
            <Button variant={dialog?.kind === 'retire' ? 'destructive' : 'primary'} onClick={() => void submit()} disabled={active.saving || (dialog?.kind !== 'retire' && !valid)}>
              {dialog?.kind === 'add' ? 'Add department' : dialog?.kind === 'rename' ? 'Save name' : 'Retire department'}
            </Button>
          </>
        }
      >
        {dialog?.kind === 'retire' ? (
          <p className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">Anything open for {dialog.row.name} must be sent or skipped first.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <DialogLabel htmlFor="department-name">Name</DialogLabel>
            <Input id="department-name" autoFocus value={name} maxLength={40} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && valid) void submit(); }} placeholder="Garden" />
          </div>
        )}
      </DecisionDialog>
    </div>
  );
}
