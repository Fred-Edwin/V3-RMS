'use client';

import * as React from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { Callout, ChangeSummary, DialogButton, KitDialog, PersonRadioList, SingleDateField } from '../../../../_shared';
import { useAction } from '../../../_shared/hooks/use-action';
import { addDays, nairobiDay } from '../../../_shared/lib/people-dates';
import { useHeadCandidates, useWithoutLogin } from '../../_shared/hooks/use-org-data';
import { firstName } from '../../_shared/lib/org-copy';
import { orgWrites } from '../../_shared/services/org-services';
import type { HeadPreview } from '../../_shared/types/org-types';
import { candidateChoices, previewLines, toAssignBody, validateReturnDay, type HeadMode } from '../lib/head-copy';

/**
 * Assign a head, replace the head, or name an acting head (Paper Chapter 3 steps 03 and 04; O6, O7, O8). The grey box is the server's
 * own preview of what changes, written before anything is saved. Refusals (`HEAD_NOT_ELIGIBLE`, `ALREADY_HEAD`, `HUB_HAS_NO_HEADS`,
 * `INVALID_RETURN_DATE`) arrive in the server's words and are shown under the box.
 */
export interface AssignHeadTarget {
  id: string;
  name: string;
  organizationName: string;
  people: number;
  /** Who approves today (the head, an acting head, or "the Branch Manager"). */
  approver: string;
  hasHead: boolean;
  hasActingHead: boolean;
}

export function AssignHeadDialog({ target, mode, onClose, done }: { target: AssignHeadTarget; mode: HeadMode; onClose: () => void; done: (message: string) => void }) {
  const today = React.useMemo(() => nairobiDay(), []);
  const candidates = useHeadCandidates(target.id);
  const noLogin = useWithoutLogin(target.id, candidates.status === 'ready' && candidates.data.length === 0);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [returnsOn, setReturnsOn] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState(false);
  const [preview, setPreview] = React.useState<{ key: string; value: HeadPreview } | { key: string; error: string } | null>(null);
  const action = useAction((m) => done(m ?? 'Saved.'));

  const list = candidates.data;
  const choices = React.useMemo(() => candidateChoices(list ?? []), [list]);
  const chosen = picked ?? list?.find((c) => c.recommended)?.employeeId ?? list?.[0]?.employeeId ?? null;
  const returnError = mode === 'ACTING' ? validateReturnDay(returnsOn, today) : undefined;
  const wanted = chosen && !returnError ? `${chosen}|${mode}|${returnsOn ?? ''}` : null;
  const replaceActing = mode === 'ACTING' && target.hasActingHead;

  React.useEffect(() => {
    if (!wanted || !chosen) return;
    let cancelled = false;
    orgWrites.previewHead(target.id, toAssignBody(chosen, mode, returnsOn, replaceActing)).then(
      (value) => !cancelled && setPreview({ key: wanted, value }),
      (err: unknown) => !cancelled && setPreview({ key: wanted, error: formatApiErrorMessage(err, 'The preview did not load.') })
    );
    return () => {
      cancelled = true;
    };
    // `chosen`, `mode`, `returnsOn` and `replaceActing` are all inside `wanted`; `target.id` never changes while the dialog is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, target.id]);

  const current = preview && preview.key === wanted ? preview : null;
  const ready = current !== null && 'value' in current;
  const title = mode === 'ACTING' ? `Name an acting head for ${target.name}` : target.hasHead ? `Replace the head of ${target.name}` : `Assign a head for ${target.name}`;
  const who = list?.find((c) => c.employeeId === chosen)?.name;

  const save = (): void => {
    setShown(true);
    if (!chosen || returnError) return;
    const first = who ? firstName(who) : 'They';
    void action.run(
      () => orgWrites.assignHead(target.id, toAssignBody(chosen, mode, returnsOn, replaceActing)),
      mode === 'ACTING' ? `${first} is acting head of ${target.name}.` : `${first} is now head of ${target.name}.`
    );
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={`${target.organizationName}. ${target.people} ${target.people === 1 ? 'person works' : 'people work'} here, and approvals are with ${target.approver} for now.`}
      busy={action.busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          {list && list.length === 0 ? null : (
            <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy || !ready}>
              {action.busy ? 'Saving…' : mode === 'ACTING' ? `Name ${who ? firstName(who) : 'them'} acting head` : `Assign ${who ? firstName(who) : 'them'} as head`}
            </DialogButton>
          )}
        </>
      }
    >
      {candidates.status === 'error' ? (
        <Callout tone="error" role="alert" size="sm">The people who could lead did not load. {candidates.error.message}</Callout>
      ) : list && list.length === 0 ? (
        <Callout tone="warning" size="sm" title="Nobody here has a login yet">
          Only people in this department with a login can lead it. Casuals are not shown. Someone from another department can move here first.
          {noLogin.status === 'ready' && noLogin.data.length > 0 ? (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {noLogin.data.map((p) => (
                <li key={p.employeeId}>
                  {p.name}
                  {p.positionName ? `, ${p.positionName}` : ''}:{' '}
                  <a className="underline" href={`/app/workforce/employees/${p.employeeId}`}>Give a login first</a>
                </li>
              ))}
            </ul>
          ) : (
            <> Add the person in <a className="underline" href="/app/workforce/employees">Employees</a> first.</>
          )}
        </Callout>
      ) : list ? (
        <>
          <PersonRadioList legend="WHO SHOULD LEAD IT" people={choices} value={chosen} onChange={setPicked} disabled={action.busy} />
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Only people in this department with a login can lead it. Casuals are not shown. Someone from another department can move here first.</p>
        </>
      ) : (
        <p role="status" className="m-0 font-wds-sans text-[13px] text-wds-text-secondary">Finding who could lead…</p>
      )}
      {mode === 'ACTING' && list && list.length > 0 ? (
        <SingleDateField plainLabel label="The head is back on" value={returnsOn} onChange={setReturnsOn} minDate={addDays(today, 1)} maxDate={addDays(today, 366)} error={shown ? returnError : undefined} helper="The acting head's cover ends by itself the day before." />
      ) : null}
      {current && 'value' in current ? <ChangeSummary caption={`WHAT CHANGES WHEN ${(who ?? 'THEY').split(' ')[0]?.toUpperCase()} ${mode === 'ACTING' ? 'ACTS AS' : 'BECOMES'} HEAD`} lines={previewLines(current.value, target.hasHead ? target.approver : null)} /> : null}
      {current && 'error' in current ? <Callout tone="error" role="alert" size="sm">{current.error}</Callout> : null}
      {action.error ? <Callout tone="error" role="alert" size="sm">{action.error}</Callout> : null}
    </KitDialog>
  );
}
