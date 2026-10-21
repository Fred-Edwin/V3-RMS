'use client';

import { WorkforceDrawer } from '../../../../_shared';
import type { RequestableType } from '../../../_shared/types/leave-types';
import { RequestForm } from '../../request/components/request-form';

/** Ask for leave on a desktop opens the same form in a right-hand drawer (spec Step 13, production adds), not a new page. */
export function AskDrawer({ open, onOpenChange, chips, online, onSent }: { open: boolean; onOpenChange: (open: boolean) => void; chips: readonly RequestableType[]; online: boolean; onSent: (applicationId: string, sentTo: string) => void }) {
  return (
    <WorkforceDrawer open={open} onOpenChange={onOpenChange} title="Ask for leave" subtitle="Every calendar day counts.">
      {open ? <RequestForm chips={chips} online={online} onSent={(result, sentTo) => onSent(result.application.id, sentTo)} /> : null}
    </WorkforceDrawer>
  );
}
