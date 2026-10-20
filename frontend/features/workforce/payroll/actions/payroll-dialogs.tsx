'use client';

import * as React from 'react';

import { usePayrollUrl } from '../month/hooks/use-payroll-url';
import { ApproveDialog } from '../approve/approve-dialog';
import { ExportMenu } from '../exports/export-menu';
import { MarkPaidDialog } from '../payout/mark-paid-dialog';
import { PublishDialog } from '../publish/publish-dialog';
import { SendBackDialog, SendDialog } from '../review/send-dialogs';
import type { MonthView } from '../_shared/types/month-types';

export type DialogName = 'send' | 'sendBack' | 'approve' | 'publish' | 'pay' | 'export';

/**
 * The dialog the page asked for. Each one reloads the page when it finishes (`onChanged`, with the line to show) or when the server says
 * the month moved (`onStale`, no line), so the figures on screen are never the old ones.
 */
export function PayrollDialogs({ name, view, onClose, onChanged }: { name: DialogName; view: MonthView; onClose: () => void; onChanged: (message?: string) => void }) {
  const url = usePayrollUrl();
  const done = (message: string): void => {
    onClose();
    onChanged(message);
  };
  const stale = (): void => onChanged();
  switch (name) {
    case 'send':
      return <SendDialog view={view} onClose={onClose} onDone={done} onStale={stale} />;
    case 'sendBack':
      return <SendBackDialog view={view} onClose={onClose} onDone={done} onStale={stale} />;
    case 'approve':
      return (
        <ApproveDialog
          view={view}
          onClose={onClose}
          onDone={done}
          onStale={stale}
          onCheckByHand={() => {
            onClose();
            url.set({ tab: 'tax', handcheck: '1' });
          }}
        />
      );
    case 'publish':
      return <PublishDialog view={view} onClose={onClose} onDone={done} onStale={stale} />;
    case 'pay':
      return <MarkPaidDialog view={view} onClose={onClose} onDone={done} onStale={stale} />;
    case 'export':
      return <ExportMenu view={view} onClose={onClose} />;
  }
}
