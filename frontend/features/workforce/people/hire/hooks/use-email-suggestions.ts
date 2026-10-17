'use client';

import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';

import { peopleReads } from '../../_shared/services/people-reads';
import { domainOf, suggestEmails } from '../lib/hire-email';

/**
 * Sign-in addresses worth offering for this name: built from the company domain (the signed-in person's own), then each one asked of
 * the server (`duplicate-check`, booleans only) so an address that already has a login is never offered. Up to three come back.
 * Nothing is offered until there is a name and a domain; a failed check offers the address anyway (the hire itself refuses a taken one).
 */
export function useEmailSuggestions(name: string): string[] {
  const domain = useAuthStore((s) => domainOf(s.user?.email));
  const [free, setFree] = useState<{ key: string; list: string[] }>({ key: '', list: [] });
  const key = `${name.trim().toLowerCase()}|${domain ?? ''}`;

  useEffect(() => {
    const candidates = suggestEmails(name, domain);
    if (candidates.length === 0) return;
    let cancelled = false;
    Promise.all(candidates.map((email) => peopleReads.duplicateCheck({ email }).then((r) => !r.email, () => true))).then((flags) => {
      if (!cancelled) setFree({ key, list: candidates.filter((_, i) => flags[i]) });
    });
    return () => {
      cancelled = true;
    };
    // `key` stands for name and domain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return free.key === key ? free.list : [];
}
