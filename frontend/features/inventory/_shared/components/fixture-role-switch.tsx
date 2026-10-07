'use client';

import * as React from 'react';
import { notFound } from 'next/navigation';

import { cn } from '@/lib/cn';
import { USE_FIXTURES } from '../services/scw-call';

/**
 * Dev story page for the Stock, Counting and Waste build (`NEXT_PUBLIC_SCW_FIXTURES=1` only; otherwise a 404): picks which role the
 * fixture handlers answer as, so every role's variant of every screen can be reached without a back end. Reloads after a change.
 * Removed with the fixtures when the real API is switched on.
 */
export function FixtureRoleSwitch() {
  const [mod, setMod] = React.useState<typeof import('../fixtures/fixture-role') | null>(null);
  const [current, setCurrent] = React.useState<string>('');
  React.useEffect(() => {
    if (!USE_FIXTURES) return;
    void import('../fixtures/fixture-role').then((m) => {
      setMod(m);
      setCurrent(m.getFixtureRole());
    });
  }, []);
  if (!USE_FIXTURES) notFound();
  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-6 font-wds-sans">
      <h1 className="text-wds-h2 text-wds-text-ink">Fixture role</h1>
      <p className="text-wds-body-sm text-wds-text-secondary">
        The Counting, Stock and Waste screens are answering from local sample data. Pick whose view to see. You must be signed in as a user who may open these pages (System Admin
        opens all of them).
      </p>
      <ul className="flex flex-col gap-2">
        {mod?.FIXTURE_ROLES.map(({ role, label }) => (
          <li key={role}>
            <button
              type="button"
              onClick={() => {
                mod.setFixtureRole(role);
                window.location.reload();
              }}
              aria-pressed={current === role}
              className={cn(
                'flex h-11 w-full items-center justify-between border px-3 text-left text-wds-body outline-none focus-visible:shadow-wds-ring',
                current === role ? 'border-wds-selected-edge bg-wds-espresso-50 font-semibold' : 'border-wds-border bg-wds-surface hover:bg-wds-neutral-50',
              )}
            >
              {label}
              {current === role ? <span className="font-wds-mono text-wds-caption text-wds-selected-edge">Selected</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
