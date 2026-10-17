'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { peopleReads } from '../../_shared/services/people-reads';
import { peopleWrites } from '../../_shared/services/people-writes';
import type { DuplicateCheck, HireResult, Lookups } from '../../_shared/types/people-types';
import { afterJobChoice, loginEmailDefault, withSingleSite } from '../lib/hire-choices';
import { emptyHire, fromDraft, stepsFor, toDraft, toHireBody, type HireState, type HireStepKey } from '../lib/hire-model';
import { hasErrors, validateStep, type HireErrors } from '../lib/hire-validation';

/**
 * The hire wizard's behaviour: the form, the step, the checks, the draft and the final call. The screen only draws what this holds.
 *
 * The draft saves a moment after each change once there is a name (`POST` first, then `PATCH`), never while the hire is going,
 * and never holds the password or account number (`toDraft`). The duplicate check asks the server by ID number, phone and email
 * and gets booleans back; it never learns or shows who the match is.
 */
const DRAFT_DELAY_MS = 900;
const CHECK_DELAY_MS = 500;

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'failed';

export interface HireWizardInput {
  lookups: Lookups | null;
  canSetPay: boolean;
  today: string;
  resumeDraftId: string | null;
}

export function useHireWizard({ lookups, canSetPay, today, resumeDraftId }: HireWizardInput) {
  const [state, setState] = useState<HireState>(() => emptyHire(today));
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<HireErrors>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateCheck | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const draftId = useRef<string | null>(resumeDraftId);
  const hired = useRef(false);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const loadedFor = useRef<string | null>(null);

  const steps: HireStepKey[] = useMemo(() => stepsFor(state, canSetPay), [state, canSetPay]);
  const step: HireStepKey = steps[Math.min(stepIndex, steps.length - 1)] ?? 'who';

  // One site: choose it. Done once the lookups arrive and the form has none.
  useEffect(() => {
    if (lookups) setState((s) => withSingleSite(s, lookups));
  }, [lookups]);

  // Resuming a draft: read it over the empty form once.
  useEffect(() => {
    if (!resumeDraftId || loadedFor.current === resumeDraftId) return;
    loadedFor.current = resumeDraftId;
    peopleReads.drafts().then(
      (rows) => {
        const row = rows.find((r) => r.id === resumeDraftId);
        if (!row) return;
        setState(fromDraft(row.payload, today));
        setStepIndex(Math.max(0, row.step - 1));
      },
      () => undefined
    );
  }, [resumeDraftId, today]);

  const set = useCallback((patch: Partial<HireState>) => {
    setState((s) => ({ ...s, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch) as (keyof HireState)[]) delete next[key];
      return next;
    });
  }, []);

  const setJob = useCallback(
    (patch: Partial<HireState>) => {
      if (!lookups) return;
      setState((s) => afterJobChoice(s, patch, lookups));
      setErrors((e) => {
        const next = { ...e };
        for (const key of Object.keys(patch) as (keyof HireState)[]) delete next[key];
        return next;
      });
    },
    [lookups]
  );

  // The duplicate check, a moment after the three identifying fields stop changing.
  useEffect(() => {
    if (step !== 'who') return;
    const nationalId = state.nationalId.trim();
    const phone = state.phone.trim();
    const email = state.email.trim();
    if (nationalId.length < 5 && phone.length < 7 && !email.includes('@')) {
      setDuplicate(null);
      return;
    }
    // `stale` stops an earlier answer that arrives late from overwriting the answer for what is typed now.
    let stale = false;
    const timer = setTimeout(() => {
      peopleReads
        .duplicateCheck({ nationalId: nationalId.length >= 5 ? nationalId : undefined, phone: phone.length >= 7 ? phone : undefined, email: email.includes('@') ? email : undefined })
        .then(
          (found) => { if (!stale) setDuplicate(found); },
          () => { if (!stale) setDuplicate(null); }
        );
    }, CHECK_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [step, state.nationalId, state.phone, state.email]);

  // The draft, saved as you go.
  useEffect(() => {
    if (submitting || hired.current || state.name.trim() === '') return;
    const timer = setTimeout(() => {
      setDraftStatus('saving');
      const body = toDraft(state, stepIndex + 1);
      saving.current = saving.current.then(async () => {
        try {
          if (draftId.current) await peopleWrites.updateDraft(draftId.current, body);
          else draftId.current = (await peopleWrites.createDraft(body)).id;
          setDraftStatus('saved');
        } catch {
          setDraftStatus('failed');
        }
      });
    }, DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, stepIndex, submitting]);

  const goTo = useCallback((index: number) => setStepIndex(Math.max(0, Math.min(index, steps.length - 1))), [steps.length]);

  /** Validates this step; on success returns true and the caller moves on. */
  const check = useCallback(
    (key: HireStepKey): boolean => {
      const found = validateStep(key, { ...state, loginEmail: loginEmailDefault(state) }, lookups);
      if (key === 'who' && duplicate?.nationalId) found.nationalId = 'This ID number is already on file.';
      if (key === 'who' && duplicate?.phone && !state.confirmDuplicatePhone) found.phone = 'Confirm this is a different person, or change the number.';
      if (key === 'who' && duplicate?.email) found.email = 'Someone with this email address already has a login.';
      setErrors(found);
      return !hasErrors(found);
    },
    [state, lookups, duplicate]
  );

  const next = useCallback(() => {
    if (check(step)) goTo(stepIndex + 1);
  }, [check, step, goTo, stepIndex]);
  const back = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex]);

  /** Hires. The first step that does not pass is shown instead of sending. */
  const submit = useCallback(async (): Promise<HireResult | null> => {
    for (let i = 0; i < steps.length; i++) {
      const key = steps[i];
      if (key && !check(key)) {
        setStepIndex(i);
        return null;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const filled = { ...state, loginEmail: loginEmailDefault(state) };
      const result = await peopleWrites.hire(toHireBody(filled, canSetPay, draftId.current ?? undefined));
      hired.current = true; // the server has consumed the draft, so autosave must not write to it again
      if (photo) await peopleWrites.photo(result.employee.id, photo).catch(() => undefined);
      return result;
    } catch (err) {
      setSubmitError(formatApiErrorMessage(err, 'The hire did not go through. Nothing was saved.'));
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [steps, check, state, canSetPay, photo]);

  /** "Save and close": waits for the draft to be written. */
  const saveDraftNow = useCallback(async (): Promise<boolean> => {
    if (state.name.trim() === '') return true;
    const body = toDraft(state, stepIndex + 1);
    saving.current = saving.current.then(async () => {
      if (draftId.current) await peopleWrites.updateDraft(draftId.current, body);
      else draftId.current = (await peopleWrites.createDraft(body)).id;
    });
    try {
      await saving.current;
      return true;
    } catch {
      setDraftStatus('failed');
      return false;
    }
  }, [state, stepIndex]);

  return { state, set, setJob, step, steps, stepIndex, errors, next, back, goTo, submit, submitting, submitError, photo, setPhoto, duplicate, draftStatus, saveDraftNow };
}
