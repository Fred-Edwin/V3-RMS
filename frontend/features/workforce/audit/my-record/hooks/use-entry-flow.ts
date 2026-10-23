'use client';

import { useCallback, useState } from 'react';

import { useAnswer, useRecordCard } from './use-my-record';

/**
 * One opened entry and the two answers to it, for the phone's full entry and the desktop's detail panel. "That was me" says thank you;
 * "This wasn't me" asks first (the caller shows the dialog while `confirming`), then hands over to the password page through `onSignedOut`.
 */
export function useEntryFlow(id: string, onAnswered: () => void, onSignedOut: () => void) {
  const card = useRecordCard(id);
  const [confirming, setConfirming] = useState(false);
  const [thanks, setThanks] = useState(false);
  const answer = useAnswer(onAnswered);
  const { reload } = card;

  const meDone = useCallback(async (): Promise<void> => {
    if (await answer.answer(id, 'ME')) {
      setThanks(true);
      reload();
    }
  }, [answer, id, reload]);
  const notMe = useCallback(async (): Promise<void> => {
    const result = await answer.answer(id, 'NOT_ME');
    setConfirming(false);
    if (result) onSignedOut();
  }, [answer, id, onSignedOut]);

  return { card, confirming, setConfirming, thanks, answer, meDone, notMe };
}
