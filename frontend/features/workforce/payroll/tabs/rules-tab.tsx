'use client';

import Link from 'next/link';

import { ErrorBlock, ListSkeleton, useWorkforcePermissions } from '../../_shared';
import { FiguresCard, type FigureCell } from '../_shared/components/figures-card';
import { useRulesApplied } from '../_shared/hooks/use-payroll-data';
import { dayOfDate, kes } from '../_shared/lib/format';
import type { RuleCard } from '../_shared/types/tab-types';

const NAMES: Record<RuleCard['ruleKey'], string> = { OVERTIME: 'Overtime', LATENESS: 'Lateness', ABSENCE: 'Absence', LEAVE: 'Leave', HOLIDAYS: 'Holidays' };
const RULES_TAB: Record<RuleCard['ruleKey'], string> = { OVERTIME: 'overtime', LATENESS: 'lateness', ABSENCE: 'leave', LEAVE: 'leave', HOLIDAYS: 'holidays' };

const num = (v: number | string | undefined): string => (v === undefined ? '0' : typeof v === 'number' ? String(v) : kes(v));

/** The boxes under each card: the figures the month's stored lines gave for that rule. Lateness is minutes, not days (back-end decision D13). */
function boxes(card: RuleCard): FigureCell[] {
  const f = card.figures;
  switch (card.ruleKey) {
    case 'OVERTIME':
      return [{ label: 'PEOPLE', value: num(f.people) }, { label: 'AUTHORISED', value: String(f.authorised ?? '0 h 00') }, { label: 'PAID (KES)', value: num(f.paid) }];
    case 'LATENESS':
      return [{ label: 'PEOPLE', value: num(f.people) }, { label: 'LATE MINUTES', value: num(f.lateMinutes) }, { label: 'DEDUCTED (KES)', value: num(f.deducted) }];
    case 'ABSENCE':
      return [{ label: 'PEOPLE', value: num(f.people) }, { label: 'UNPAID DAYS', value: num(f.unpaidDays) }, { label: 'DEDUCTED (KES)', value: num(f.deducted) }];
    case 'LEAVE':
      return [{ label: 'PEOPLE', value: num(f.people) }, { label: 'LEAVE DAYS', value: num(f.leaveDays) }, { label: 'DEDUCTED (KES)', value: num(f.deducted) }];
    case 'HOLIDAYS':
      return [{ label: 'PEOPLE', value: num(f.people) }, { label: 'HOURS WORKED', value: `${Math.floor(Number(f.workedMinutes ?? 0) / 60)} h` }, { label: 'PAID (KES)', value: num(f.paid) }];
  }
}

/** Rules applied (spec S2): what each rule said and what it did, from the month's frozen versions, never from today's Rules. */
export function RulesTab({ monthKey, refresh }: { monthKey: string; refresh: number }) {
  const rules = useRulesApplied(monthKey, refresh);
  const permissions = useWorkforcePermissions();
  if (rules.status === 'loading' && !rules.data) return <ListSkeleton rows={6} columns={['fill', 120]} label="Loading the rules" />;
  if (rules.status === 'error' && !rules.data) return <ErrorBlock title="The rules did not load" line={rules.error.message} onRetry={rules.reload} reference={rules.error.code} />;
  const cards = rules.data?.cards ?? [];
  return (
    <div className="grid gap-4 min-[1100px]:grid-cols-2">
      {cards.map((card) => (
        <FiguresCard
          key={card.ruleKey}
          title={NAMES[card.ruleKey]}
          chip={`v${card.version}${card.effectiveFrom ? ` · from ${dayOfDate(card.effectiveFrom)}` : ''}`}
          aside={
            permissions.can('rules.read') ? (
              <Link href={`/app/workforce/rules?tab=${RULES_TAB[card.ruleKey]}`} className="text-wds-info-fg underline-offset-2 hover:underline">
                Rules ↗
              </Link>
            ) : null
          }
          rows={[...card.rows.map((r) => ({ label: r.label, value: r.value, mono: /\d/.test(r.value) })), ...(card.largest ? [{ label: 'Largest', value: `${card.largest.name} · ${card.largest.text}` }] : [])]}
          cells={boxes(card)}
        />
      ))}
    </div>
  );
}
