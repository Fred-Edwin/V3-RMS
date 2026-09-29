'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Input } from '@/components/ui2/input';
import { StatusDot } from '@/components/ui2/status-dot';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWdsToast } from '@/hooks/useWdsToast';
import { usePinStatus } from '@/hooks/usePinStatus';
import { useAuthStore } from '@/store/authStore';
import { formatApiErrorMessage } from '@/types/api';
import { useTeam } from '../../hooks/use-team';
import {
  resetAttendantPassword,
  resetAttendantPin,
  setAttendantActive,
} from '../../services/team-api-service';
import type { TeamMember } from '../../types/team';
import { StockEmptyCard, StockErrorCard, SkeletonRows, TableRowSkeleton } from '../stock/stock-states';
import { AddAttendantDrawer } from './add-attendant-drawer';

/**
 * Settings › Team — Paper "Pre-Demo · Team & PIN" artboards 1–3 + the States
 * kit copy table (8). The Store Manager's own attendants, each with PIN
 * status and Reset password / Reset PIN / Deactivate (Reactivate) actions,
 * every one behind a confirm dialog and ending in a toast. The manager's own
 * row is read-only here — their PIN lives under My PIN.
 */
type PendingAction =
  | { kind: 'password'; member: TeamMember }
  | { kind: 'pin'; member: TeamMember }
  | { kind: 'deactivate'; member: TeamMember }
  | { kind: 'reactivate'; member: TeamMember };

const ROW_ACTION =
  'whitespace-nowrap font-wds-sans text-wds-body-sm text-wds-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:rounded-wds-sm focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-50';

export function TeamPanel({ onOpenMyPin }: { onOpenMyPin: () => void }) {
  const { toast } = useWdsToast();
  const { matches: isDesktop } = useMediaQuery('(min-width: 1024px)');
  const [actionsFor, setActionsFor] = React.useState<TeamMember | null>(null);
  const { members, status, error, reload } = useTeam();
  const [addOpen, setAddOpen] = React.useState(false);
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [password, setPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const addTriggerRef = React.useRef<HTMLButtonElement>(null);

  const close = () => {
    if (busy) return;
    setPending(null);
    setPassword('');
    setPasswordError(null);
  };

  const open = (action: PendingAction) => {
    setPassword('');
    setPasswordError(null);
    setActionsFor(null);
    setPending(action);
  };

  const confirm = async () => {
    if (!pending) return;
    const { member } = pending;
    if (pending.kind === 'password' && password.length < 8) {
      setPasswordError('Use at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (pending.kind === 'password') {
        await resetAttendantPassword(member.id, password);
        toast({ variant: 'success', title: `Password reset for ${member.name}` });
      } else if (pending.kind === 'pin') {
        await resetAttendantPin(member.id);
        toast({ variant: 'success', title: `PIN cleared — ${firstName(member)} sets a new one when they next sign` });
      } else if (pending.kind === 'deactivate') {
        await setAttendantActive(member.id, false);
        toast({ variant: 'success', title: `${member.name} deactivated` });
      } else {
        await setAttendantActive(member.id, true);
        toast({ variant: 'success', title: `${member.name} reactivated` });
      }
      setPending(null);
      setPassword('');
      await reload({ silent: true });
    } catch (err) {
      toast({ variant: 'error', title: "That didn't go through", description: formatApiErrorMessage(err, 'Try again.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted" aria-live="polite">
          {status === 'ready'
            ? `${members.length + 1} ${members.length + 1 === 1 ? 'person' : 'people'} at the Central Store`
            : 'Central Store team'}
        </span>
        <Button ref={addTriggerRef} onClick={() => setAddOpen(true)}>
          Add attendant
        </Button>
      </div>

      {status === 'error' ? (
        <StockErrorCard
          title="Couldn't load your team"
          description={error ?? 'Check your connection and try again.'}
          onRetry={() => void reload()}
        />
      ) : !isDesktop ? (
        <MobileTeamList members={members} loading={status === 'loading'} busy={busy} onOpenMyPin={onOpenMyPin} onActions={setActionsFor} onAction={open} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Name</TableHead>
              <TableHead className="w-[16%]">Role</TableHead>
              <TableHead className="w-[14%]">PIN</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <OwnRow onOpenMyPin={onOpenMyPin} />
            {status === 'loading' ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <SkeletonRows count={3} label="Loading your team">
                    {(i) => <TableRowSkeleton key={i} widths={[110, 70, 60, 150]} nameWidth={200} />}
                  </SkeletonRows>
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <MemberRow key={member.id} member={member} busy={busy} onAction={open} />
              ))
            )}
          </TableBody>
        </Table>
      )}

      {status === 'ready' && members.length === 0 ? (
        <StockEmptyCard
          title="No attendants yet"
          description="Add your first Store Attendant so they can count, receive and dispatch."
          actionLabel="Add attendant"
          onAction={() => setAddOpen(true)}
        />
      ) : null}

      <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
        Attendants set their own PIN the first time they sign something. Reset PIN clears it so they set a new one — you
        never see or choose it.
      </p>

      <AddAttendantDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        mobile={!isDesktop}
        onAdded={(member) => {
          setAddOpen(false);
          toast({ variant: 'success', title: `${member.name} added` });
          void reload({ silent: true });
        }}
      />

      <Sheet open={actionsFor !== null} onOpenChange={(next) => (next ? undefined : setActionsFor(null))}>
        <SheetContent side="bottom" className="rounded-t-wds-md pb-5">
          <SheetHeader className="px-4">
            <SheetTitle>{actionsFor?.name}</SheetTitle>
            <SheetDescription>Store Attendant · {actionsFor?.email}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col">
            {actionsFor
              ? (
                  [
                    { kind: 'password', label: 'Reset password', hint: 'Set a new temporary password; they are signed out everywhere', danger: false },
                    { kind: 'pin', label: 'Reset PIN', hint: 'They set a new one the next time they sign', danger: false },
                    { kind: 'deactivate', label: 'Deactivate', hint: "They can't log in; their signed records stay", danger: true },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => open({ kind: item.kind, member: actionsFor })}
                    className="flex min-h-11 touch-manipulation flex-col items-start gap-px border-b border-wds-neutral-100 px-4 py-3 text-left outline-none transition-colors last:border-b-0 focus-visible:shadow-wds-ring active:bg-wds-neutral-100"
                  >
                    <span className={`font-wds-sans text-wds-body ${item.danger ? 'font-medium text-wds-error-fg' : 'text-wds-text-ink'}`}>{item.label}</span>
                    <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{item.hint}</span>
                  </button>
                ))
              : null}
          </div>
          <div className="px-4 pt-2">
            <Button variant="secondary" className="h-11 w-full" onClick={() => setActionsFor(null)}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={pending?.kind === 'password'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={`Reset password for ${pending?.member.name ?? ''}?`}
        description={
          <span className="flex flex-col gap-3">
            <span>
              Set a new temporary password. Their current password stops working immediately and they are signed out
              everywhere.
            </span>
            <span className="flex flex-col gap-1.5">
              <label htmlFor="reset-password-input" className="font-wds-sans text-wds-caption font-medium text-wds-text-ink">
                New temporary password
              </label>
              <Input
                id="reset-password-input"
                type="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                disabled={busy}
                aria-invalid={passwordError ? true : undefined}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                className="h-9 font-wds-mono"
              />
              {passwordError ? (
                <span role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
                  {passwordError}
                </span>
              ) : null}
            </span>
          </span>
        }
        confirmLabel={busy ? 'Resetting…' : 'Reset password'}
        destructive={false}
        confirming={busy}
        onConfirm={() => void confirm()}
      />
      <ConfirmDialog
        open={pending?.kind === 'pin'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={`Reset PIN for ${pending?.member.name ?? ''}?`}
        description="This clears their signing PIN. They'll be asked to set a new one the next time they sign something. You won't see or choose it."
        confirmLabel={busy ? 'Resetting…' : 'Reset PIN'}
        destructive={false}
        confirming={busy}
        onConfirm={() => void confirm()}
      />
      <ConfirmDialog
        open={pending?.kind === 'deactivate'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={`Deactivate ${pending?.member.name ?? ''}?`}
        description="They won't be able to log in. Everything they have already signed stays on record. You can reactivate them later."
        confirmLabel={busy ? 'Deactivating…' : 'Deactivate'}
        confirming={busy}
        onConfirm={() => void confirm()}
      />
      <ConfirmDialog
        open={pending?.kind === 'reactivate'}
        onOpenChange={(next) => (next ? undefined : close())}
        title={`Reactivate ${pending?.member.name ?? ''}?`}
        description="They'll be able to log in again with their current password."
        confirmLabel={busy ? 'Reactivating…' : 'Reactivate'}
        destructive={false}
        confirming={busy}
        onConfirm={() => void confirm()}
      />
    </div>
  );
}

function firstName(member: TeamMember): string {
  return member.name.trim().split(/\s+/)[0] ?? member.name;
}

function NameCell({ name, email, you, muted }: { name: string; email: string; you?: boolean; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className={muted ? 'text-wds-text-copy-muted' : 'text-wds-text-ink'}>
        {name}
        {you ? <span className="text-wds-text-faint"> · you</span> : null}
      </span>
      <span className={muted ? 'text-wds-caption text-wds-text-faint' : 'text-wds-caption text-wds-text-copy-muted'}>{email}</span>
    </div>
  );
}

/** The signed-in Store Manager's own row — built from the auth user + `pin-status`, since `GET /staff` returns attendants only. */
function OwnRow({ onOpenMyPin }: { onOpenMyPin: () => void }) {
  const user = useAuthStore((s) => s.user);
  const pinStatus = usePinStatus(true);
  if (!user) return null;
  return (
    <TableRow className="h-[52px]">
      <TableCell>
        <NameCell name={user.name} email={user.email} you />
      </TableCell>
      <TableCell>Store Manager</TableCell>
      <TableCell>
        {pinStatus.hasPin === null ? (
          <span className="text-wds-text-faint">—</span>
        ) : (
          <StatusDot tone={pinStatus.hasPin ? 'success' : 'warning'}>{pinStatus.hasPin ? 'Set' : 'Not set'}</StatusDot>
        )}
      </TableCell>
      <TableCell>
        <StatusDot tone="success">Active</StatusDot>
      </TableCell>
      <TableCell className="text-right">
        <button type="button" onClick={onOpenMyPin} className={ROW_ACTION}>
          Manage under My PIN
        </button>
      </TableCell>
    </TableRow>
  );
}

function MemberRow({ member, busy, onAction }: { member: TeamMember; busy: boolean; onAction: (a: PendingAction) => void }) {
  const inactive = !member.isActive;
  return (
    <TableRow className="h-[52px]">
      <TableCell>
        <NameCell name={member.name} email={member.email} muted={inactive} />
      </TableCell>
      <TableCell className={inactive ? 'text-wds-text-copy-muted' : undefined}>Store Attendant</TableCell>
      <TableCell>
        {inactive ? (
          <span className="text-wds-text-faint">—</span>
        ) : (
          <StatusDot tone={member.hasPin ? 'success' : 'warning'}>{member.hasPin ? 'Set' : 'Not set'}</StatusDot>
        )}
      </TableCell>
      <TableCell>
        <StatusDot tone={inactive ? 'neutral' : 'success'}>{inactive ? 'Inactive' : 'Active'}</StatusDot>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-4">
          {inactive ? (
            <button type="button" disabled={busy} className={ROW_ACTION} onClick={() => onAction({ kind: 'reactivate', member })}>
              Reactivate
            </button>
          ) : (
            <>
              <button type="button" disabled={busy} className={ROW_ACTION} onClick={() => onAction({ kind: 'password', member })}>
                Reset password
              </button>
              <button type="button" disabled={busy} className={ROW_ACTION} onClick={() => onAction({ kind: 'pin', member })}>
                Reset PIN
              </button>
              <button type="button" disabled={busy} className={ROW_ACTION} onClick={() => onAction({ kind: 'deactivate', member })}>
                Deactivate
              </button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function MobileTeamList({
  members,
  loading,
  busy,
  onOpenMyPin,
  onActions,
  onAction,
}: {
  members: TeamMember[];
  loading: boolean;
  busy: boolean;
  onOpenMyPin: () => void;
  onActions: (member: TeamMember) => void;
  onAction: (a: PendingAction) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const pinStatus = usePinStatus(true);
  return (
    <ul className="flex flex-col border-t border-wds-text-ink" aria-label="Central Store team">
      {user ? (
        <MobileRow
          name={user.name}
          email={user.email}
          you
          role="Store Manager"
          pin={pinStatus.hasPin === null ? null : pinStatus.hasPin ? 'set' : 'unset'}
          active
          action={
            <button type="button" onClick={onOpenMyPin} className={cn(MOBILE_ACTION, 'text-wds-text-faint')}>
              See My PIN
            </button>
          }
        />
      ) : null}
      {loading ? (
        <li className="py-4">
          <SkeletonRows count={3} label="Loading your team">
            {(i) => <TableRowSkeleton key={i} widths={[110, 70]} nameWidth={160} />}
          </SkeletonRows>
        </li>
      ) : (
        members.map((member) => (
          <MobileRow
            key={member.id}
            name={member.name}
            email={member.email}
            role="Store Attendant"
            pin={member.isActive ? (member.hasPin ? 'set' : 'unset') : null}
            active={member.isActive}
            action={
              member.isActive ? (
                <button type="button" disabled={busy} onClick={() => onActions(member)} className={cn(MOBILE_ACTION, 'text-wds-primary')}>
                  Actions
                  <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden>
                    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => onAction({ kind: 'reactivate', member })} className={cn(MOBILE_ACTION, 'text-wds-primary')}>
                  Reactivate
                </button>
              )
            }
          />
        ))
      )}
    </ul>
  );
}

const MOBILE_ACTION =
  'inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-end gap-1 font-wds-sans text-wds-body-sm font-medium outline-none focus-visible:rounded-wds-sm focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-50';

function MobileRow({
  name,
  email,
  you,
  role,
  pin,
  active,
  action,
}: {
  name: string;
  email: string;
  you?: boolean;
  role: string;
  pin: 'set' | 'unset' | null;
  active: boolean;
  action: React.ReactNode;
}) {
  const muted = !active;
  return (
    <li className="flex flex-col gap-1 border-b border-wds-border py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-px pt-1.5">
          <span className={cn('font-wds-sans text-wds-body', muted ? 'text-wds-text-faint' : 'text-wds-text-ink')}>
            {name}
            {you ? ' · you' : ''}
          </span>
          <span className={cn('break-all font-wds-sans text-wds-caption', muted ? 'text-wds-text-faint' : 'text-wds-text-copy-muted')}>{email}</span>
        </div>
        <div className="flex shrink-0 justify-end">{action}</div>
      </div>
      <div className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-1 font-wds-sans text-wds-caption', muted ? 'text-wds-text-faint' : 'text-wds-neutral-700')}>
        <span>{role}</span>
        {pin ? <StatusDot tone={pin === 'set' ? 'success' : 'warning'} className="text-wds-caption text-wds-neutral-700">{pin === 'set' ? 'PIN set' : 'PIN not set'}</StatusDot> : null}
        <StatusDot tone={active ? 'success' : 'neutral'} className={cn('text-wds-caption', muted ? 'text-wds-text-faint' : 'text-wds-neutral-700')}>
          {active ? 'Active' : 'Inactive'}
        </StatusDot>
      </div>
    </li>
  );
}
