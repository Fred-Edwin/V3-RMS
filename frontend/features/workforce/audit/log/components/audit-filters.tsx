'use client';

import * as React from 'react';

import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { SearchInput } from '@/components/ui2/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { cn } from '@/lib/cn';

import { FilterBar, FilterChip } from '../../../_shared';
import { AUDIT_COPY, EVENT_LABEL } from '../lib/audit-words';
import type { AuditFacets, AuditQuery } from '../types/audit-log-types';

const ANY = '__any__';

function Menu({ label, value, onChange, children, width }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; width: string }) {
  return (
    <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? '' : v)}>
      <SelectTrigger aria-label={label} className={width}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

/**
 * Search first, then the filters (UI_BUILD_RULES 4a). Area, Event and Site list only what the reader may read: they come from the API's
 * facets, never from a role name here. The search types ahead after 250 ms with no Enter, and `/` focuses it.
 */
export function AuditFilters({ query, facets, today, onChange }: { query: AuditQuery; facets: AuditFacets | null; today: string; onChange: (patch: Partial<AuditQuery>) => void }) {
  const [text, setText] = React.useState(query.q);
  const input = React.useRef<HTMLInputElement>(null);
  const sent = React.useRef(query.q);

  // The address bar changed under us (Clear filters, back button): follow it.
  React.useEffect(() => {
    if (query.q !== sent.current) {
      sent.current = query.q;
      setText(query.q);
    }
  }, [query.q]);

  React.useEffect(() => {
    if (text.trim() === query.q.trim()) return;
    const timer = window.setTimeout(() => {
      sent.current = text.trim();
      onChange({ q: text.trim() });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, query.q, onChange]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || t?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showArea = (facets?.areas.length ?? 0) > 1;
  const showSites = (facets?.organizations.length ?? 0) > 0;
  return (
    <FilterBar
      search={<SearchInput ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={AUDIT_COPY.searchPlaceholder} shortcutHint="/" aria-label="Search the audit log" maxLength={80} className="w-[300px] max-sm:w-full" />}
      chips={<FilterChip label="Flagged only" selected={query.flagged} onClick={() => onChange({ flagged: !query.flagged })} />}
      trailing={
        <>
          {showArea ? (
            <Menu label="Area" value={query.area} onChange={(v) => onChange({ area: v as AuditQuery['area'] })} width="w-[150px]">
              <SelectItem value={ANY}>All areas</SelectItem>
              {facets?.areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a === 'ACCESS' ? 'Access' : 'Workforce'}
                </SelectItem>
              ))}
            </Menu>
          ) : null}
          <Menu label="Event" value={query.event === 'all' ? '' : query.event} onChange={(v) => onChange({ event: (v || 'all') as AuditQuery['event'] })} width="w-[190px]">
            <SelectItem value={ANY}>All events</SelectItem>
            {facets?.events.map((e) => (
              <SelectItem key={e.code} value={e.code}>
                {EVENT_LABEL[e.code] ?? e.label}
              </SelectItem>
            ))}
          </Menu>
          {showSites ? (
            <Menu label="Site" value={query.siteId} onChange={(v) => onChange({ siteId: v })} width="w-[160px]">
              <SelectItem value={ANY}>All sites</SelectItem>
              {facets?.organizations.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </Menu>
          ) : null}
          <DateRangePicker
            label="Dates"
            today={today}
            value={{ from: query.from, to: query.to }}
            note={AUDIT_COPY.datesNote}
            buttonClassName={cn('h-8 px-3 text-[12px]')}
            onChange={(r) => r && onChange({ from: r.from, to: r.to })}
          />
          <Menu label="Sort" value={query.sort} onChange={(v) => onChange({ sort: v === 'oldest' ? 'oldest' : 'newest' })} width="w-[150px]">
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </Menu>
        </>
      }
    />
  );
}
