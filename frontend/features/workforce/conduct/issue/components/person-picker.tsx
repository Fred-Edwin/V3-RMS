'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FIELD_CLASS, FOCUS_RING, PersonAvatar } from '../../../_shared';
import { conductReads } from '../../_shared/services/conduct-services';
import type { IssuePerson } from '../../_shared/types/conduct-types';
import { noticeNote } from '../lib/issue-rules';

const DEBOUNCE_MS = 200;

/**
 * The "Who" field (spec S9; Paper 1QJN-0): type-ahead over people the server lists for this reader (own site, never the reader, never an
 * exited file). Arrow keys move, Enter picks, Escape closes the list (a second Escape belongs to the panel). It is a combobox with a
 * listbox, so a screen reader hears "3 matches". After a pick the field reads "Name · Job · Site" with a Change button.
 */
export function PersonPicker({ person, siteLabel, onPick, onClear, disabled }: { person: IssuePerson | null; siteLabel: string; onPick: (p: IssuePerson) => void; onClear: () => void; disabled: boolean }) {
  const listId = React.useId();
  const [text, setText] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [people, setPeople] = React.useState<IssuePerson[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setFailed(false);
      conductReads.people(text.trim()).then(
        (rows) => {
          if (cancelled) return;
          setPeople(rows);
          setActive(0);
        },
        () => {
          if (!cancelled) setFailed(true);
        }
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [text, open]);

  const choose = (row: IssuePerson): void => {
    onPick(row);
    setOpen(false);
    setText('');
  };

  if (person) {
    return (
      <div className="flex items-center justify-between gap-3 border border-wds-border-strong bg-wds-surface px-3 py-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar name={person.name} size="xs" />
          <span className="truncate font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
            {person.name} · {person.department ?? 'Staff'} · {siteLabel}
          </span>
        </span>
        <button type="button" onClick={onClear} disabled={disabled} className={cn('shrink-0 font-wds-sans text-[13px] font-medium leading-4 text-wds-primary underline underline-offset-2', FOCUS_RING)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && people && people[active] ? `${listId}-${people[active]!.id}` : undefined}
        aria-label="Who is this notice for?"
        autoComplete="off"
        placeholder="Type a name"
        value={text}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && people?.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, people.length - 1));
          } else if (e.key === 'ArrowUp' && people?.length) {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && open && people?.[active]) {
            e.preventDefault();
            choose(people[active]!);
          } else if (e.key === 'Escape' && open) {
            // The first Escape closes the list; the panel's own close waits for the second.
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={FIELD_CLASS}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 flex flex-col border border-wds-border-strong bg-wds-surface shadow-[0_12px_28px_color-mix(in_oklab,var(--wds-neutral-950)_16%,transparent)]">
          <p className="m-0 border-b border-wds-neutral-100 px-3 py-2 font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary" aria-live="polite">
            {failed ? 'COULD NOT LOAD' : people === null ? 'SEARCHING…' : `MATCHES AT ${siteLabel.toUpperCase()} · ${people.length}`}
          </p>
          <ul id={listId} role="listbox" aria-label="People" className="m-0 max-h-[280px] list-none overflow-y-auto p-0">
            {people?.map((row, index) => {
              const note = noticeNote(row);
              return (
                <li
                  key={row.id}
                  id={`${listId}-${row.id}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(row)}
                  className={cn('flex cursor-pointer items-center gap-3 border-b border-wds-neutral-100 px-3 py-2.5 last:border-b-0', index === active && 'bg-wds-neutral-50')}
                >
                  <PersonAvatar name={row.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{row.name}</span>
                    <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                      {row.department ?? 'Staff'}
                      {row.isMyTeam ? ' · your team' : ''} · {row.employeeNumber}
                      {row.hasLogin ? '' : ' · no login'}
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-wds-sans text-[12px] leading-4', note.tone === 'warning' ? 'text-wds-warning-fg' : note.tone === 'ink' ? 'text-wds-text-ink' : 'text-wds-text-secondary')}>{note.text}</span>
                </li>
              );
            })}
            {people && people.length === 0 ? <li className="px-3 py-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No one matches &quot;{text}&quot;. Only people at your site appear.</li> : null}
          </ul>
          <p className="m-0 border-t border-wds-neutral-100 px-3 py-2 font-wds-sans text-[11px] leading-[14px] text-wds-text-faint">↑↓ to move · Enter to pick · only people at your site appear</p>
        </div>
      ) : null}
    </div>
  );
}
