'use client';

import * as React from 'react';

import { SetPinForm } from '@/components/app/shell/set-pin-form';
import { usePinStatus } from '@/hooks/usePinStatus';

import { Callout, DialogButton, KitDialog } from '../../_shared';
import { nairobiToday } from '../../rota';
import { useOnline } from '../hooks/use-rules-data';
import { roleInSentence, longDay, orList, unique } from '../lib/rules-words';
import { ruleFailure, wordsForCode, type RuleFailure } from '../lib/error-words';
import { rulesWrites } from '../services/rules-services';
import type { ChangeBody, RuleValues, RulesPage, SavedVersion } from '../types/rules-types';
import { AppliesTo, ImpactRows, NowNewBlock, PinSection, WhyField, toldCaption, type DialogPair } from './change-parts';
import { useChangePreview } from './use-change-preview';

export interface RuleChangeProps {
  page: RulesPage;
  title: string;
  helper: string;
  pairs: DialogPair[];
  /** Anything under the NOW → NEW block that the row needs (the leave-type form, the band editor). */
  extra?: React.ReactNode;
  /** The rows to set. Null while the draft is empty or wrong (Save stays off). `{}` is valid for "use the company rule again". */
  values: RuleValues | null;
  /** Why `values` is null: the words under Save ("Nothing to change yet", or the field's own error). */
  draftMessage?: string;
  useCompanyRuleFor?: string[];
  /** Show "Applies to" (Every site / One site). Only for a viewer of the company rule, on rows a site may own. */
  appliesTo?: boolean;
  /** The row is always a company rule (leave types), even when the page is looking at one site. */
  companyScope?: boolean;
  /** An extra note before the PIN ("Saving confirms these rates."). */
  note?: React.ReactNode;
  /** For a week-start change the new first day, so a wrong start day reads "Pick a Sunday". */
  weekStartName?: string;
  onSaved: (saved: SavedVersion) => void;
  /** Called when someone else changed the rule: the tab must be read again. */
  onStale: () => void;
  onClose: () => void;
}

const newKey = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** The shared Change dialog (Paper steps 02 and 08, Chapter 10 steps 19 and 20). It owns the day, the reason and the PIN; the row owns the value. */
export function RuleChangeDialog(props: RuleChangeProps) {
  const { page, title, helper, pairs, extra, values, draftMessage, useCompanyRuleFor, appliesTo = false, companyScope = false, note, weekStartName, onSaved, onStale, onClose } = props;
  const online = useOnline();
  const pinStatus = usePinStatus(true);
  const needsPin = pinStatus.hasPin === false;

  const [scope, setScope] = React.useState<'every' | 'one'>('every');
  const [chosenSite, setChosenSite] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<RuleFailure | null>(null);
  const [stale, setStale] = React.useState(false);
  const attempt = React.useRef<{ sig: string; key: string } | null>(null);

  const viewingSite = companyScope ? null : page.organizationId;
  const showApplies = appliesTo && viewingSite === null && page.organizations.length > 0;
  const siteId = viewingSite ?? (showApplies && scope === 'one' ? chosenSite : null);
  const waitingForSite = showApplies && scope === 'one' && chosenSite === null;
  const expectedVersion = siteId === null ? page.expectedVersion : siteId === viewingSite ? page.expectedSiteVersion : undefined;

  const body: ChangeBody | null = waitingForSite
    ? null
    : { organizationId: siteId, effectiveFrom: from ?? nairobiToday(), values: values ?? {}, ...(useCompanyRuleFor ? { useCompanyRuleFor } : {}), ...(expectedVersion !== undefined ? { expectedVersion } : {}) };
  const state = useChangePreview(page.group, body);
  const preview = state.preview;

  // The server's suggested day (D10) is the starting point until the person picks one.
  React.useEffect(() => {
    if (from === null && preview) setFrom(preview.defaultEffectiveFrom);
  }, [from, preview]);

  const mapped = (e: { code: string; message: string; details?: unknown }): string => wordsForCode(e.code, e.message, (e.details ?? {}) as Record<string, never>, weekStartName).text;
  const dateErrors = preview?.errors.filter((e) => e.field === 'effectiveFrom') ?? [];
  const otherErrors = (preview?.errors ?? []).filter((e) => e.field !== 'effectiveFrom' && !(values === null && e.code === 'RULE_NO_CHANGE'));
  const dateError = failure?.kind === 'date' ? failure.text : dateErrors[0] ? mapped(dateErrors[0]) : undefined;
  const pinMessage = failure && (failure.kind === 'pin' || failure.kind === 'locked') ? failure.text : null;
  const locked = failure?.kind === 'locked';
  const becomesFrom = from ? longDay(from) : '';

  const blocked: string | null = (() => {
    if (!online) return 'No connection';
    if (waitingForSite) return 'Choose a site';
    if (values === null) return draftMessage ?? 'Nothing to change yet';
    if (!preview) return 'Checking what it would change…';
    if (!preview.canSave) return preview.errors[0] ? mapped(preview.errors[0]) : 'This cannot be saved yet';
    if (state.status === 'loading') return 'Checking what it would change…';
    if (reason.trim().length === 0) return 'Say why';
    if (pin.length !== 4) return 'Enter your PIN';
    if (locked) return 'Signing is locked for now';
    return null;
  })();

  const save = async (): Promise<void> => {
    if (blocked !== null || body === null) return;
    setBusy(true);
    setFailure(null);
    const signature = JSON.stringify([page.group, body, reason.trim()]);
    if (attempt.current?.sig !== signature) attempt.current = { sig: signature, key: newKey() };
    try {
      const saved = await rulesWrites.create(page.group, { ...body, reason: reason.trim(), pin, idempotencyKey: attempt.current.key });
      onSaved(saved);
      onClose();
    } catch (err) {
      const found = ruleFailure(err, weekStartName);
      if (found.kind === 'stale') {
        setStale(true);
        setPin('');
        onStale();
      } else {
        setFailure(found);
        if (found.kind === 'pin' || found.kind === 'locked') setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmNote = ((): string | null => {
    if (!preview || preview.needsConfirmation.length === 0) return null;
    if (preview.confirmsWithYourPin.length > 0) return 'You confirm it with this PIN.';
    const who = orList(unique(preview.needsConfirmation.flatMap((n) => n.whoCan.map((w) => roleInSentence(w.role)))));
    return `${who.charAt(0).toUpperCase()}${who.slice(1)} must confirm the new value. Until then the old one stays in use.`;
  })();

  return (
    <KitDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={title}
      busy={busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={blocked !== null || busy || needsPin}>
            {busy ? 'Saving…' : preview?.becomes ? `Save as version ${preview.becomes.version}` : 'Save'}
          </DialogButton>
        </>
      }
    >
      {stale ? (
        <Callout tone="warning" size="sm" role="alert">
          Someone changed this rule a moment ago. Check the new value. What you typed is kept.
        </Callout>
      ) : null}
      <NowNewBlock pairs={pairs} from={from} onFrom={setFrom} minDate={preview?.earliestEffectiveFrom} dateError={dateError} />
      <p className="m-0 -mt-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{helper}</p>
      {otherErrors.map((e) => (
        <p key={`${e.code}-${e.field}`} role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {mapped(e)}
        </p>
      ))}
      {extra}
      {showApplies ? <AppliesTo scope={scope} onScope={setScope} siteId={chosenSite} onSite={setChosenSite} sites={page.organizations} /> : viewingSite && appliesTo ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{page.organizationName} only</p> : null}
      <WhyField value={reason} onChange={setReason} disabled={busy} />
      <ImpactRows preview={preview} loading={state.status === 'loading'} becomesFrom={becomesFrom} />
      {state.status === 'error' ? <Callout tone="error" size="sm" role="alert">Could not check what this would change. Try again.</Callout> : null}
      {confirmNote ? <Callout tone="warning" size="sm">{confirmNote}</Callout> : null}
      {note}
      {needsPin ? (
        <SetPinForm submitLabel="Set PIN" onCancel={onClose} onDone={(newPin) => { pinStatus.markSet(); setPin(newPin); }} />
      ) : (
        <PinSection pin={pin} onPin={setPin} invalid={Boolean(pinMessage) && !busy} disabled={busy || locked} message={pinMessage} />
      )}
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{toldCaption(preview)}</p>
      {failure && failure.kind === 'other' ? <Callout tone="error" size="sm" role="alert">{failure.text}</Callout> : null}
      {blocked ? (
        <p role="status" className="m-0 -mt-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {blocked}
        </p>
      ) : null}
    </KitDialog>
  );
}
