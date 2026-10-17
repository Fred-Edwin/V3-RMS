'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';

import type { Lookups } from '../../../_shared/types/people-types';
import { useEmailSuggestions } from '../../hooks/use-email-suggestions';
import { loginEmailDefault, loginRolesFor, ROLE_LABELS } from '../../lib/hire-choices';
import { LOGIN_PANEL } from '../../lib/hire-copy';
import { generateTemporaryPassword } from '../../lib/hire-model';
import type { LoginSummary } from '../../lib/hire-summary';
import { HireField, HireInput, HireSelect } from '../hire-field';
import type { StepProps } from './who-step';

/** Step 5, Login (Paper `S3F-0`): the sign-in email, what the account may do, a one-time password, and a summary of the hire. */
export function LoginStep({ state, errors, set, lookups, summary }: StepProps & { lookups: Lookups; summary: LoginSummary }) {
  const roles = loginRolesFor(lookups);
  const suggestions = useEmailSuggestions(state.name);
  // The email starts as the one from step one, else the first free suggestion once it arrives; the first password is made when the step opens.
  React.useEffect(() => {
    if (state.loginEmail === '' && loginEmailDefault(state) === '' && suggestions[0]) set({ loginEmail: suggestions[0] });
  }, [suggestions, state, set]);
  React.useEffect(() => {
    if (state.loginEmail === '') set({ loginEmail: loginEmailDefault(state) });
    if (state.temporaryPassword === '') set({ temporaryPassword: generateTemporaryPassword() });
    // Runs once when the step opens; the form then owns both values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lines: [string, string][] = [
    [summary.job, summary.starts],
    [summary.employment, summary.flag],
    [summary.time, ''],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <HireField label="Sign-in email" error={errors.loginEmail}>
          {(ids) => <HireInput ids={ids} type="email" value={state.loginEmail} onChange={(e) => set({ loginEmail: e.target.value })} />}
        </HireField>
        {suggestions.length > 0 ? (
          <div role="group" aria-label="Suggested sign-in emails" className="col-span-2 -mt-1 flex flex-wrap items-center gap-2 max-md:col-span-1">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">SUGGESTED</span>
            {suggestions.map((email) => (
              <button
                key={email}
                type="button"
                aria-pressed={state.loginEmail === email}
                onClick={() => set({ loginEmail: email })}
                className={cn(
                  'h-7 border px-2.5 font-wds-mono text-[12px] leading-4 outline-none focus-visible:shadow-wds-ring',
                  state.loginEmail === email ? 'border-wds-primary bg-wds-caramel-100 text-wds-text-ink' : 'border-wds-border-strong text-wds-text-secondary [@media(hover:hover)]:hover:bg-wds-neutral-50'
                )}
              >
                {email}
              </button>
            ))}
          </div>
        ) : null}
        <HireField label="Access" error={errors.loginRole}>
          {(ids) => (
            <HireSelect
              ids={ids}
              value={state.loginRole}
              placeholder="Choose"
              options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))}
              onChange={(e) => set({ loginRole: e.target.value })}
            />
          )}
        </HireField>
      </div>
      <HireField label="Temporary password" helper={LOGIN_PANEL.shownOnce} error={errors.temporaryPassword}>
        {(ids) => (
          <div className="flex gap-2">
            <HireInput ids={ids} mono value={state.temporaryPassword} autoComplete="off" spellCheck={false} onChange={(e) => set({ temporaryPassword: e.target.value })} />
            <Button type="button" variant="flat" size="lg" className="h-10 shrink-0" onClick={() => set({ temporaryPassword: generateTemporaryPassword() })}>
              Generate another
            </Button>
          </div>
        )}
      </HireField>
      <section aria-label="Summary" className="border border-wds-border bg-wds-surface">
        <h2 className="m-0 px-3.5 py-3 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">SUMMARY</h2>
        <dl className="m-0 flex flex-col">
          {lines.map(([left, right]) => (
            <div key={left} className="flex justify-between gap-4 border-t border-wds-border px-3.5 py-2.5">
              <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{left}</dt>
              <dd className="m-0 text-right font-wds-sans text-[13px] leading-4 text-wds-warning-fg">{right}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
