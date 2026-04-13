'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Avatar, Spinner } from '@/components/ui';
import { staffService, type StaffDto } from '@/services/staffService';
import { useAuthStore } from '@/store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (staff: StaffDto) => void;
  error?: string | null;
  onClearError?: () => void;
}

// Roles that appear in the contact picker (display screens excluded)
const ALLOWED_ROLES = new Set(['DIRECTOR', 'MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA']);

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  WAITER: 'Waiter',
  CHEF: 'Chef',
  BARISTA: 'Barista',
};

// Grouped sections in display order
const SECTION_DEFS: { label: string; roles: string[] }[] = [
  { label: 'Leadership',  roles: ['DIRECTOR', 'MANAGER'] },
  { label: 'Finance',     roles: ['ACCOUNTANT'] },
  { label: 'Floor Staff', roles: ['WAITER'] },
  { label: 'Kitchen',     roles: ['CHEF'] },
  { label: 'Barista',     roles: ['BARISTA'] },
];

export function ContactPickerSheet({ isOpen, onClose, onSelect, error, onClearError }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const results = await staffService.listStaff(accessToken, { isActive: true });
      setStaff(results.filter((s) => s.id !== currentUserId && ALLOWED_ROLES.has(s.role)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      void load();
      setQuery('');
    }
  }, [isOpen, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (ROLE_LABELS[s.role] ?? s.role).toLowerCase().includes(q),
    );
  }, [staff, query]);

  const handleSelect = (person: StaffDto) => {
    onClearError?.();
    onSelect(person);
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F0E8]">
      {/* Header */}
      <div className="bg-[#2C1810] px-4 py-3 flex items-center shrink-0">
        <button type="button" onClick={onClose} className="text-[#F5F0E8]/80 hover:text-[#F5F0E8] transition-colors">
          <X size={20} />
        </button>
        <span className="flex-1 text-center text-[#F5F0E8] font-semibold text-base">New Message</span>
        <div className="w-6" />
      </div>

      {/* Search bar */}
      <div className="px-4 pt-4 pb-2 bg-white border-b border-[#E8E0D5] shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B49A] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or role…"
            className="w-full rounded-xl border border-[#E8E0D5] bg-[#FAFAF8] pl-9 pr-9 py-2.5 text-sm text-[#2C1810] placeholder:text-[#C4B49A] focus:outline-none focus:ring-1 focus:ring-[#2C1810]"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4B49A] hover:text-[#8B7355]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 shrink-0">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Staff list */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner />
          </div>
        ) : loadError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-red-600 mb-3">{loadError}</p>
            <button type="button" onClick={() => void load()} className="text-sm text-[#2C1810] underline">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-[#8B7355] py-10">
            {query ? 'No staff match your search' : 'No colleagues found'}
          </p>
        ) : (
          <ul>
            {SECTION_DEFS.map(({ label, roles }) => {
              const members = filtered.filter((p) => roles.includes(p.role));
              if (members.length === 0) return null;
              return (
                <li key={label}>
                  <p className="px-4 pt-4 pb-1 text-[11px] font-semibold text-[#8B7355] uppercase tracking-wider">
                    {label}
                  </p>
                  <ul className="divide-y divide-[#F0EBE3]">
                    {members.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(person)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F0E8] active:bg-[#EDE7DC] transition-colors text-left"
                        >
                          <Avatar name={person.name} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#2C1810] text-sm">{person.name}</p>
                            <p className="text-xs text-[#8B7355]">
                              {ROLE_LABELS[person.role] ?? person.role}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
