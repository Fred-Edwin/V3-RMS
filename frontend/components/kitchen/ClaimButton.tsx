'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

interface ClaimButtonProps {
  staffOnShift: Array<{ id: string; name: string }>;
  isLoading?: boolean;
  onClaim: (staffId: string) => void;
}

export function ClaimButton({ staffOnShift, isLoading = false, onClaim }: ClaimButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  const defaultStaff = staffOnShift[0];
  const hasMultiple = staffOnShift.length > 1;
  const disabled = isLoading || staffOnShift.length === 0;

  const handleDirectClaim = () => {
    if (disabled || !defaultStaff) return;
    onClaim(defaultStaff.id);
  };

  const handleSelect = (staffId: string) => {
    setOpen(false);
    onClaim(staffId);
  };

  return (
    <div ref={containerRef} className="relative mt-3 w-full">
      <div className={cn('flex w-full overflow-hidden rounded-md', disabled && 'opacity-50')}>
        {/* Primary claim button */}
        <button
          type="button"
          disabled={disabled}
          onClick={handleDirectClaim}
          className={cn(
            'flex h-12 flex-1 items-center justify-center gap-2 bg-espresso text-label-lg font-medium text-crema',
            'transition-colors duration-fast hover:bg-espresso-light active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-espresso focus-visible:ring-offset-1',
            hasMultiple ? 'rounded-l-md' : 'rounded-md',
          )}
        >
          {isLoading ? (
            <Spinner size="sm" className="[&>span:first-child]:border-t-crema [&>span:first-child]:border-crema/30" />
          ) : (
            <>
              <span>Claim</span>
              {defaultStaff && hasMultiple && (
                <span className="max-w-[96px] truncate text-crema/70 text-label-md">
                  — {defaultStaff.name.split(' ')[0]}
                </span>
              )}
              {defaultStaff && !hasMultiple && (
                <span className="max-w-[120px] truncate text-crema/70 text-label-md">
                  — {defaultStaff.name}
                </span>
              )}
            </>
          )}
        </button>

        {/* Chevron — only rendered when there are multiple staff */}
        {hasMultiple && (
          <>
            {/* Divider */}
            <span className="w-px bg-crema/20" aria-hidden="true" />
            <button
              type="button"
              disabled={disabled}
              aria-label="Choose who is claiming this ticket"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-r-md bg-espresso',
                'transition-colors duration-fast hover:bg-espresso-light active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-espresso focus-visible:ring-offset-1',
              )}
            >
              <svg
                className={cn('h-4 w-4 text-crema transition-transform duration-fast', open && 'rotate-180')}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Staff list popover — opens upward to stay within the card */}
      {open && (
        <div
          role="listbox"
          aria-label="Staff on shift"
          className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-md border border-stone-200 bg-white shadow-lg z-30"
        >
          {staffOnShift.map((staff) => (
            <button
              key={staff.id}
              role="option"
              type="button"
              aria-selected={staff.id === defaultStaff?.id}
              onClick={() => handleSelect(staff.id)}
              className={cn(
                'flex w-full items-center px-4 py-3 text-left text-body-md text-stone-900',
                'hover:bg-stone-100 active:bg-stone-200 transition-colors duration-fast',
                staff.id === defaultStaff?.id && 'font-medium',
              )}
            >
              {staff.id === defaultStaff?.id && (
                <svg className="mr-2 h-4 w-4 shrink-0 text-espresso" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
              {staff.id !== defaultStaff?.id && <span className="mr-2 w-4 shrink-0" aria-hidden="true" />}
              {staff.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
