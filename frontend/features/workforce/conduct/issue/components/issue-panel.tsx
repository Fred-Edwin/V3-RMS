'use client';

import * as React from 'react';

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';
import { Textarea } from '@/components/ui2/textarea';
import { useAuthStore } from '@/store/authStore';

import { Callout, ChoiceChips, DialogButton, FIELD_CLASS, FormField, FOCUS_RING, MOTION, SegmentedControl, useRemote } from '../../../_shared';
import { SigningPin } from '../../_shared/components/signing-pin';
import { useOnline } from '../../_shared/hooks/use-online';
import { useSignedAct } from '../../_shared/hooks/use-signed-act';
import { ABOUT_OPTIONS, hasTimesheetFacts, OWN_LINE_MAX } from '../../_shared/lib/conduct-words';
import { conductReads, conductWrites } from '../../_shared/services/conduct-services';
import type { ConductAbout, ConductLevel, IssuePerson } from '../../_shared/types/conduct-types';
import { useLetterPreview } from '../hooks/use-letter-preview';
import { endsLine, levelHelper, levelItems, ownLineLength, sentMessage, smallPrint, submitBlock } from '../lib/issue-rules';
import { FactsBox } from './facts-box';
import { PersonPicker } from './person-picker';

/**
 * Issue a warning (spec S9; Paper 1QJN-0, 1GLY-0): a 530 px panel from the right. Who, the level (suggested from the notices on file),
 * what it is about, the facts attached from the timesheets, the manager's own line, the end date, and the manager's PIN. "Sign and send"
 * is the one brown button and waits with a reason in words. Enter never sends. Closing with anything typed asks "Discard this notice?" in
 * the panel (no browser dialog). The letter can be read first as a DRAFT. A double click sends one notice (one idempotency key).
 */
export function IssuePanel({ open, onClose, onDone, presetPerson }: { open: boolean; onClose: () => void; onDone: (message: string, noticeId?: string) => void; presetPerson?: IssuePerson | null }) {
  const online = useOnline();
  const siteLabel = useAuthStore((s) => s.user?.organizationName ?? 'your site');
  const act = useSignedAct();
  const preview = useLetterPreview();
  const [person, setPerson] = React.useState<IssuePerson | null>(presetPerson ?? null);
  const [level, setLevel] = React.useState<ConductLevel>('WRITTEN_WARNING');
  const [levelTouched, setLevelTouched] = React.useState(false);
  const [about, setAbout] = React.useState<ConductAbout>('LATENESS');
  const [month, setMonth] = React.useState<string | undefined>(undefined);
  const [ownLine, setOwnLine] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [hasPin, setHasPin] = React.useState<boolean | null>(null);
  const [asking, setAsking] = React.useState(false);

  const draft = useRemote(() => conductReads.draft(person?.id ?? '', about, month), `conduct-draft:${person?.id}:${about}:${month ?? ''}`, person !== null);
  const draftData = person ? draft.data : null;
  const wantsFacts = hasTimesheetFacts(about);
  const dirty = person !== null || ownLine.trim().length > 0;

  // The level starts at what the notices on file suggest, until the manager chooses one.
  React.useEffect(() => {
    if (draftData && !levelTouched && draftData.suggestedLevel) setLevel(draftData.suggestedLevel);
  }, [draftData, levelTouched]);
  // A final warning is not choosable when the server says no: step back to the suggested level.
  React.useEffect(() => {
    if (draftData && level === 'FINAL_WRITTEN_WARNING' && !draftData.finalAllowed && !draftData.finalAlreadyActive) setLevel(draftData.suggestedLevel ?? 'WRITTEN_WARNING');
  }, [draftData, level]);

  const block = submitBlock({ person, level, about, draft: draftData, ownLine, pin, online, hasPin });
  const factsMonth = wantsFacts ? (month ?? draftData?.month) : undefined;

  const close = (): void => {
    if (dirty && !act.busy) setAsking(true);
    else onClose();
  };
  const send = async (): Promise<void> => {
    if (!person || block !== null) return;
    const result = await act.run((idempotencyKey) => conductWrites.issue({ personId: person.id, level, about, factsMonth, ownLine: ownLine.trim(), pin, idempotencyKey }));
    if (result.ok) onDone(sentMessage(person, level, draftData?.ackDays ?? 3, new Date()), result.value.id);
    else setPin('');
  };
  const problem = act.problem?.kind === 'wrong' ? 'That PIN is not right.' : (act.problem?.message ?? null);
  const showPreview = level !== 'VERBAL_NOTE' && person !== null && ownLineLength(ownLine) >= 20 && !(wantsFacts && draftData?.noFacts);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <SheetContent hideClose side="right" className="w-[530px] max-w-full overflow-y-auto" overlayClassName="bg-[color-mix(in_oklab,var(--wds-neutral-950)_40%,transparent)]" onEscapeKeyDown={(e) => { if (act.busy) e.preventDefault(); }}>
        <div className="flex flex-col gap-5 p-[30px]">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <SheetTitle className="m-0 font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em] text-wds-text-ink">Issue a warning</SheetTitle>
              <SheetDescription className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Raise, sign and send a notice. The person is asked to sign on their phone.</SheetDescription>
            </div>
            <SheetClose aria-label="Close" className={`-mr-2 -mt-1 flex h-9 w-9 items-center justify-center text-[20px] leading-6 text-wds-text-muted ${MOTION} ${FOCUS_RING}`} onClick={(e) => { e.preventDefault(); close(); }}>
              <span aria-hidden>×</span>
            </SheetClose>
          </div>

          {asking ? (
            <Callout tone="warning" title="Discard this notice?" role="alert" action={<div className="flex gap-2"><DialogButton kind="cancel" onClick={() => setAsking(false)}>Keep editing</DialogButton><DialogButton kind="danger" onClick={onClose}>Discard</DialogButton></div>}>
              Nothing has been sent. What you typed will be lost.
            </Callout>
          ) : null}

          <FormField label="Who" hint="required">
            {() => <PersonPicker person={person} siteLabel={siteLabel} disabled={act.busy} onPick={(p) => { setPerson(p); setLevelTouched(false); setMonth(undefined); }} onClear={() => { setPerson(null); setLevelTouched(false); }} />}
          </FormField>
          {person && (draftData ? !draftData.hasLogin : !person.hasLogin) ? <Callout tone="warning" size="sm">This person has no login. Print the letter, give it by hand, then record that it was given.</Callout> : null}
          {draftData?.justIssued ? <Callout tone="warning" size="sm">A manager just issued a notice to this person. Check the list before you send.</Callout> : null}
          {draftData?.finalAlreadyActive ? <Callout tone="error" size="sm" role="alert">A final written warning is already on file. Speak to HR.</Callout> : null}

          <div className="flex flex-col gap-2">
            <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Level</span>
            <SegmentedControl label="Level" items={levelItems(draftData)} value={level} onChange={(v) => { setLevel(v as ConductLevel); setLevelTouched(true); }} />
            <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{levelHelper(level, draftData, person)}</p>
          </div>

          <ChoiceChips legend="About" legendStyle="sentence" options={ABOUT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={about} onChange={(v) => { setAbout(v as ConductAbout); setMonth(undefined); }} />

          {wantsFacts && person ? <FactsBox draft={draftData} loading={draft.status === 'loading'} failed={draft.status === 'error' && !draft.data} month={month} onMonth={setMonth} kind={about === 'ABSENCE' ? 'ABSENCE' : 'LATENESS'} /> : null}

          <FormField label="Your own line in the letter" hint="required" helper={`One or two sentences; the rest of the letter is fixed. ${ownLineLength(ownLine)} of ${OWN_LINE_MAX}`}>
            {(ids) => <Textarea id={ids.id} aria-describedby={ids.describedBy} rows={3} maxLength={OWN_LINE_MAX} value={ownLine} disabled={act.busy} onChange={(e) => setOwnLine(e.target.value)} className={`${FIELD_CLASS} h-auto min-h-[84px] py-2.5 leading-5`} />}
          </FormField>

          <div className="flex items-baseline justify-between gap-3 border-t border-wds-border pt-3">
            <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">The notice ends by itself after</span>
            <span className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">{endsLine(level, draftData, new Date())}</span>
          </div>
          {showPreview ? (
            <div className="flex flex-col gap-1">
              <button type="button" disabled={preview.busy} onClick={() => person && void preview.open({ personId: person.id, level, about, factsMonth, ownLine: ownLine.trim() })} className={`w-fit font-wds-sans text-[13px] font-medium leading-4 text-wds-primary underline underline-offset-2 ${FOCUS_RING}`}>
                {preview.busy ? 'Preparing the letter…' : 'Read the letter'}
              </button>
              {preview.error ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{preview.error}</p> : null}
            </div>
          ) : null}

          <SigningPin active={open} value={pin} onChange={setPin} label="Your PIN, to sign the notice" invalid={act.problem?.kind === 'wrong'} disabled={act.busy} error={problem} onStatus={setHasPin} />
          <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{smallPrint(person, level, draftData)}</p>

          <div className="flex flex-col gap-2">
            <div className="flex justify-end gap-2.5">
              <DialogButton kind="cancel" size="lg" onClick={close} disabled={act.busy}>
                Cancel
              </DialogButton>
              <DialogButton kind="primary" size="lg" onClick={() => void send()} disabled={block !== null || act.busy} aria-describedby="issue-reason">
                {act.busy ? 'Signing…' : 'Sign and send'}
              </DialogButton>
            </div>
            <p id="issue-reason" aria-live="polite" className="m-0 text-right font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              {act.busy ? '' : (block ?? '')}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
