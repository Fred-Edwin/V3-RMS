'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The app's own picker: it replaces the browser's native dropdown (`<select>` and `<datalist>`), whose list Android and Chrome draw
 * themselves, over the field, and cannot be styled or searched (training, 12 Oct 2026; docs/UI_BUILD_RULES.md "Inputs").
 *
 *  - Few choices (`chips`, or four or fewer when `chips` is not turned off): a row of chips, one tap, nothing opens.
 *  - Otherwise a field that opens a list right below it; with more than six choices the list has a search box on top.
 *
 * It keeps the shape of the old `<select>` call sites: `value`, a change callback, a placeholder, an accessible name.
 */
export interface PickerOption {
  value: string;
  label: string;
  /** A second, quieter line (a role, a code). */
  hint?: string;
  /**
   * Draws the row (and the closed field) instead of `label` and `hint`, for a person label. `query` is what was typed in the search
   * box so matching letters can be marked. `label` is still what the search matches against, so put the searchable words in it.
   */
  render?: (context: { query: string; inField: boolean }) => React.ReactNode;
}

export interface PickerProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly PickerOption[];
  /** What the closed field says when nothing is chosen. */
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
  disabled?: boolean;
  /** Classes for the closed field, so the picker takes the look of the screen it replaces a select on. */
  className?: string;
  /** Force chips on or off; by default chips show for four or fewer choices. */
  chips?: boolean;
  /** Force the search box on or off; by default it shows for more than six choices. */
  searchable?: boolean;
}

const CHIP_LIMIT = 4;
const SEARCH_FROM = 7;

export function Picker({ value, onValueChange, options, placeholder = 'Choose', 'aria-label': ariaLabel, id, disabled, className, chips, searchable }: PickerProps) {
  const asChips = chips ?? options.length <= CHIP_LIMIT;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listId = React.useId();
  const selected = options.find((o) => o.value === value);
  const withSearch = searchable ?? options.length >= SEARCH_FROM;

  React.useEffect(() => {
    if (!open) return;
    const away = (e: Event): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
    };
  }, [open]);

  if (asChips) {
    return (
      <div role="radiogroup" aria-label={ariaLabel} id={id} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onValueChange(o.value)}
              className={cn(
                'min-h-11 border px-3.5 font-wds-sans text-[14px] leading-5 outline-none transition-colors focus-visible:shadow-wds-ring disabled:opacity-60',
                on ? 'border-wds-primary bg-wds-espresso-50 font-medium text-wds-primary' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50'
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  const shown = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;
  const close = (refocus = false): void => {
    setOpen(false);
    setQuery('');
    // The list unmounts, so focus would fall to the page; put it back on the field.
    if (refocus) triggerRef.current?.focus();
  };
  // Arrow keys, Home and End move between the options (and from the search box or the field into the list).
  const moveFocus = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"] button') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, 0);
    items[to]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          else if (open) moveFocus(e);
          else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 border border-wds-border-strong bg-wds-surface px-3 text-left font-wds-sans text-[14px] leading-5 outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring disabled:opacity-60',
          selected ? 'text-wds-text-ink' : 'text-wds-text-secondary',
          className
        )}
      >
        {selected?.render ? <span className="min-w-0 flex-1">{selected.render({ query: '', inField: true })}</span> : <span className="truncate">{selected ? selected.label : placeholder}</span>}
        <span aria-hidden="true" className="shrink-0 text-[10px] text-wds-text-secondary">
          &#9662;
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 z-50 mt-1 w-max min-w-full max-w-[85vw] flex max-h-72 flex-col border border-wds-border bg-wds-surface shadow-wds-md" onKeyDown={(e) => (e.key === 'Escape' ? close(true) : moveFocus(e))}>
          {withSearch ? (
            <input
              type="search"
              autoComplete="off"
              aria-label="Search the list"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="h-11 w-full shrink-0 border-b border-wds-border bg-white px-3 font-wds-sans text-[14px] leading-5 text-wds-text-ink outline-none placeholder:text-wds-text-faint"
            />
          ) : null}
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="min-h-0 overflow-y-auto">
            {shown.length === 0 ? <li className="px-3 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Nothing matches.</li> : null}
            {shown.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(o.value);
                    close(true);
                  }}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left font-wds-sans text-[14px] leading-5 outline-none focus-visible:bg-wds-neutral-50',
                    o.value === value ? 'bg-wds-espresso-50 font-medium text-wds-primary' : 'text-wds-text-ink hover:bg-wds-neutral-50'
                  )}
                >
                  {o.render ? (
                    <span className="min-w-0 flex-1">{o.render({ query, inField: false })}</span>
                  ) : (
                    <>
                      <span className="truncate">{o.label}</span>
                      {o.hint ? <span className="shrink-0 text-[12px] text-wds-text-secondary">{o.hint}</span> : null}
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
