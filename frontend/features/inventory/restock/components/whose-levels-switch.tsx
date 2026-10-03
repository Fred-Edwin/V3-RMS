import * as React from 'react';

import { cn } from '@/lib/cn';
import type { DepartmentTag, RestockBranchOption, RestockScope } from '../../types';
import { DEPARTMENT_ORDER } from '../../catalog/lib/item-labels';
import { DEPARTMENT_LABEL } from '../../_shared/components/stock-format';

export const SCOPE_ORDER: readonly RestockScope[] = ['CENTRAL_STORE', ...DEPARTMENT_ORDER];

export const scopeLabel = (scope: RestockScope): string => (scope === 'CENTRAL_STORE' ? 'Central Store' : DEPARTMENT_LABEL[scope as DepartmentTag]);

const chip =
  'inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-wds-sm px-3 font-wds-sans text-[13px] leading-4 transition-[background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98] disabled:opacity-60';

export interface WhoseLevelsSwitchProps {
  scope: RestockScope;
  onScopeChange: (scope: RestockScope) => void;
  /** Branches for a department's levels; empty until loaded. */
  branches: RestockBranchOption[];
  branchId: string | null;
  onBranchChange: (branchId: string) => void;
  /** The Store Manager sees the department chips only when the branch list could be read. */
  departmentsAvailable: boolean;
  disabled?: boolean;
}

/**
 * "Whose levels" — the Central Store and the five departments (Paper step 11). A department also needs
 * its branch, because every branch has its own Kitchen, Pastry and so on: the branch select beside the
 * chips is not drawn in Paper (owner decision, 3 Oct 2026).
 */
export function WhoseLevelsSwitch({ scope, onScopeChange, branches, branchId, onBranchChange, departmentsAvailable, disabled }: WhoseLevelsSwitchProps) {
  const isDepartment = scope !== 'CENTRAL_STORE';
  const branchName = branches.find((b) => b.id === branchId)?.name;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Whose levels">
      <span className="mr-1 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">WHOSE LEVELS</span>
      {SCOPE_ORDER.filter((s) => s === 'CENTRAL_STORE' || departmentsAvailable).map((s) => {
        const active = s === scope;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => (active ? undefined : onScopeChange(s))}
            className={cn(
              chip,
              active ? 'bg-wds-text-ink text-white' : 'border border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50'
            )}
          >
            {scopeLabel(s)}
          </button>
        );
      })}
      {isDepartment && branchId ? (
        <label className="ml-1 flex items-center gap-2">
          <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">AT</span>
          <select
            value={branchId}
            disabled={disabled}
            onChange={(e) => onBranchChange(e.target.value)}
            aria-label="Branch"
            className="h-[30px] rounded-wds-sm border border-wds-border-strong bg-wds-surface px-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink transition-colors hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:border-wds-selected-edge focus-visible:shadow-wds-ring disabled:opacity-60"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <span className="ml-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {isDepartment
          ? `${scopeLabel(scope)}${branchName ? ` at ${branchName}` : ''}. Each change is logged.`
          : 'You can set any department’s levels as well. Each change is logged.'}
      </span>
    </div>
  );
}
