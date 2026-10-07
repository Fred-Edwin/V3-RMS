import * as React from 'react';

import { cn } from '@/lib/cn';
import { formulaText, scalingRows } from '../lib/recipe-scaling';

export interface ScalingPanelProps {
  targetYield: string;
  mainAmount: string | null;
  mainName: string | null;
  mainUnit: string | null;
  outputUnit: string;
}

/** Paper steps 25 and 26: the formula caption and three rows (half a batch, one batch, double) that move as the amounts change. No animation: it updates on every keystroke. */
export function ScalingPanel({ targetYield, mainAmount, mainName, mainUnit, outputUnit }: ScalingPanelProps) {
  const ready = mainAmount !== null && mainName !== null && mainUnit !== null;
  const rows = ready ? scalingRows({ targetYield, mainAmount, mainName, mainUnit, outputUnit }) : [];
  return (
    <div data-testid="scaling-panel" className="border border-wds-border bg-wds-neutral-50">
      <div className="border-b border-wds-border px-3 py-2.5">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">
          {ready ? formulaText({ targetYield, mainAmount, mainName, mainUnit, outputUnit }) : 'PICK A MAIN INGREDIENT TO SEE HOW THE TARGET SCALES'}
        </span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className={cn('flex justify-between gap-3 px-3 py-2', i < rows.length - 1 && 'border-b border-wds-border')}>
          <span className={cn('font-wds-sans text-[13px] leading-4', row.isOneBatch ? 'font-medium text-wds-text-ink' : 'text-wds-neutral-700')}>{row.label}</span>
          <span className={cn('whitespace-nowrap font-wds-mono text-[13px] leading-4', row.isOneBatch ? 'font-medium text-wds-text-ink' : 'text-wds-neutral-700')}>{row.result ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
