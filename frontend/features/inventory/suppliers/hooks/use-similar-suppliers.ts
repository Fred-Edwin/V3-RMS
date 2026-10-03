import { useEffect, useRef, useState } from 'react';

import { listSupplierRows } from '../../services';
import type { SupplierListRow } from '../types/supplier';

const digitsOnly = (v: string): string => v.replace(/\D/g, '');

/**
 * Suppliers that look like the one being typed (same name, or the same phone), for the hint under the Business name
 * field. Debounced; the latest typed value wins. The server decides at create time (a 409 asks to confirm), this only
 * warns early. `null` while there is nothing to compare yet.
 */
export function useSimilarSuppliers(name: string, phone: string, excludeId: string | null, enabled: boolean) {
  const [matches, setMatches] = useState<SupplierListRow[] | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const typed = name.trim();
    const phoneDigits = digitsOnly(phone);
    if (!enabled || typed.length < 3) {
      latest.current += 1;
      setMatches(null);
      return;
    }
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const byName = await listSupplierRows({ search: typed, perPage: 10, status: undefined });
        const byPhone = phoneDigits.length >= 7 ? await listSupplierRows({ search: phoneDigits.slice(-9), perPage: 10 }) : { data: [] };
        if (request !== latest.current) return;
        const wanted = typed.toLowerCase();
        const seen = new Map<string, SupplierListRow>();
        for (const row of byName.data) if (row.name.toLowerCase().includes(wanted) || wanted.includes(row.name.toLowerCase())) seen.set(row.id, row);
        for (const row of byPhone.data) seen.set(row.id, row);
        if (excludeId) seen.delete(excludeId);
        setMatches(Array.from(seen.values()));
      } catch {
        if (request === latest.current) setMatches(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name, phone, excludeId, enabled]);

  return matches;
}
