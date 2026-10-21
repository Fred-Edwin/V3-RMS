'use client';

import { useEffect, useState } from 'react';

import { peopleReads } from '../services/people-reads';

/**
 * The one sign-in address for this name (`firstname.secondname@wendo.co.ke`, numbered on a clash), made by the server so the
 * rule and the free-address check live in one place. Nothing is offered until the name has two words or the server answers.
 */
export function useSignInAddress(name: string): string | null {
  const key = name.trim();
  const [found, setFound] = useState<{ key: string; email: string | null }>({ key: '', email: null });

  useEffect(() => {
    if (key === '') return;
    let cancelled = false;
    peopleReads.suggestSignIn(key).then(
      (r) => !cancelled && setFound({ key, email: r.email }),
      () => !cancelled && setFound({ key, email: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return found.key === key ? found.email : null;
}
