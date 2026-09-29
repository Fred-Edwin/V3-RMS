import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listTeam } from '../services/team-api-service';
import type { TeamMember } from '../types/team';

/** The Store Manager's attendants. Loads on mount; `reload` refreshes after any mutation. */
export function useTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setStatus('loading');
    setError(null);
    try {
      setMembers(await listTeam());
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load your team.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { members, status, error, reload: load };
}
