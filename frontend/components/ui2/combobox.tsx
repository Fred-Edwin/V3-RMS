'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * WDS Combobox — type-to-filter single-select with inline "create new"
 * support. New primitive, not sourced from Paper (Paper's Category/Supplier
 * fields are drawn as plain closed selects; the type-to-create interaction
 * was an owner-requested addition during the 2026-09-15 UI refinement
 * session, not a Paper node). Visually matches the `Select` trigger exactly
 * (h-8, radius-sm, border-strong, focus ring) so it reads as the same field
 * family, just with an editable value.
 *
 * Not built on Radix Select — Radix's trigger isn't a text input, so typing
 * to filter/create isn't expressible on top of it without fighting the
 * primitive. This is a plain controlled `<input>` + a floating listbox,
 * with the same focus/keyboard conventions (`Escape` closes, `ArrowDown`/
 * `ArrowUp` move a highlighted option, `Enter` selects it) as Select/
 * DropdownMenu already establish elsewhere in this build.
 */
export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** Shown as a "+ Create '{query}'" row when the typed text matches no option. Omit to disable creation (a closed picker). */
  onCreate?: (name: string) => void;
  createLabel?: (query: string) => string;
  className?: string;
  disabled?: boolean;
  /** Controls the listbox open state. Omit to let the combobox manage it internally (uncontrolled). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accessible name for the input when there's no visible `<label htmlFor>` pointing at it. */
  'aria-label'?: string;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  onCreate,
  createLabel,
  className,
  disabled,
  open: openProp,
  onOpenChange,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (openProp === undefined) setUncontrolledOpen(next);
    },
    [openProp, onOpenChange]
  );
  const [query, setQuery] = React.useState('');
  const [highlighted, setHighlighted] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  // The input shows the committed value while closed, and the in-progress
  // query while open — so opening always starts from a clean slate to filter.
  const displayValue = open ? query : (value ?? '');

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const exactMatch = options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());
  const showCreate = Boolean(onCreate) && query.trim().length > 0 && !exactMatch;
  const rows: Array<{ kind: 'option'; option: ComboboxOption } | { kind: 'create' }> = [
    ...filtered.map((option) => ({ kind: 'option' as const, option })),
    ...(showCreate ? [{ kind: 'create' as const }] : []),
  ];

  const commitOption = (option: ComboboxOption) => {
    onValueChange(option.value);
    setQuery('');
    setOpen(false);
  };

  const commitCreate = () => {
    const name = query.trim();
    if (!name || !onCreate) return;
    onCreate(name);
    setQuery('');
    setOpen(false);
  };

  const rowId = (i: number) => `${listboxId}-option-${i}`;
  const activeDescendant = open && rows[highlighted] ? rowId(highlighted) : undefined;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        autoComplete="off"
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setHighlighted(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
            inputRef.current?.blur();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, rows.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const row = rows[highlighted];
            if (!row) return;
            if (row.kind === 'option') commitOption(row.option);
            else commitCreate();
          }
        }}
        className={cn(
          'flex h-8 w-full items-center rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-ink transition-colors',
          'placeholder:text-wds-text-muted',
          'focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
      />
      {open && rows.length > 0 ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-wds-md border border-wds-border bg-wds-surface p-wds-1 shadow-wds-md"
        >
          {rows.map((row, i) => (
            <button
              key={row.kind === 'option' ? row.option.value : '__create__'}
              id={rowId(i)}
              type="button"
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (row.kind === 'option' ? commitOption(row.option) : commitCreate())}
              className={cn(
                'flex w-full cursor-default select-none items-center rounded-wds-sm px-wds-2 py-wds-1 text-left font-wds-sans text-wds-body-sm',
                row.kind === 'create' ? 'text-wds-primary' : 'text-wds-text-ink',
                i === highlighted && 'bg-wds-neutral-100'
              )}
              onMouseEnter={() => setHighlighted(i)}
            >
              {row.kind === 'option' ? row.option.label : (createLabel?.(query.trim()) ?? `+ Create "${query.trim()}"`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
