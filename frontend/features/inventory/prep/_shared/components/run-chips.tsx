import * as React from 'react';

import { StatusDot, type StatusTone } from '@/components/ui2/status-dot';
import type { PrepRunStatus, VsUsual } from '../types/prep-contract';

/** "vs usual" chip (Paper `7DF-0`, `1UAA-0`): a dot and the ready-to-show text from the server. */
export function VsUsualChip({ vsUsual, className }: { vsUsual: VsUsual; className?: string }) {
  const tone: StatusTone = vsUsual.label === 'ON_TARGET' ? 'success' : vsUsual.label === 'NO_BASIS' ? 'neutral' : 'warning';
  return (
    <StatusDot tone={tone} className={className}>
      {vsUsual.text}
    </StatusDot>
  );
}

const STATUS_COPY: Record<PrepRunStatus, { label: string; tone: StatusTone } | null> = {
  RECORDED: null,
  CORRECTED: { label: 'Corrected', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'error' },
};

/** Run status chip. A recorded run shows nothing (it is the normal case); corrected and cancelled runs are marked. */
export function RunStatusChip({ status, className }: { status: PrepRunStatus; className?: string }) {
  const copy = STATUS_COPY[status];
  if (!copy) return null;
  return (
    <StatusDot tone={copy.tone} className={className}>
      {copy.label}
    </StatusDot>
  );
}
