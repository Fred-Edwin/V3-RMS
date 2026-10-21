'use client';

import * as React from 'react';

import { Callout, ErrorBlock, PdfViewer, PhoneScreen, useRemote } from '../../../_shared';
import { DownloadSlipButton, ShareSlipButton } from '../../_shared/components/slip-buttons';
import { useOnline } from '../../_shared/hooks/use-online';
import { MY_LEAVE_HISTORY, myLeaveFollowHref, requestsHref } from '../../_shared/lib/leave-routes';
import { leaveReads, slipFile } from '../../_shared/services/leave-services';

/**
 * The Document view of a leave slip (spec Step 6): the stored A4 file fitted to the phone, pinch to zoom, Download PDF and Share. Every
 * "Download leave slip" and "See my leave slip" button opens this first. A request with no slip answers 404 and says so in words.
 * `from` is where the arrow goes back to: the person's follow-up, or the Leave page for a manager.
 */
export function SlipScreen({ id, from = 'mine' }: { id: string; from?: 'mine' | 'manager' }) {
  const online = useOnline();
  const [counter, setCounter] = React.useState('');
  const meta = useRemote(() => leaveReads.detail(id), `slip-meta:${id}`);
  const code = meta.data?.application.slipCode ?? null;
  const cancelled = meta.data?.application.status === 'CANCELLED';
  const back = from === 'manager' ? requestsHref(id) : meta.data ? myLeaveFollowHref(id) : MY_LEAVE_HISTORY;
  const name = code ? `Leave slip ${code}, one page` : 'Leave slip';

  let body: React.ReactNode;
  if (meta.status === 'error' && !meta.data) {
    body = <div className="p-4"><ErrorBlock title="We could not open this slip" line={meta.error.status === 404 ? 'There is no leave slip for this request.' : 'Check your connection and try again.'} onRetry={meta.reload} /></div>;
  } else if (!code) {
    body = <div className="p-4 text-wds-neutral-300 font-wds-sans text-[13px]" role="status">Opening the slip…</div>;
  } else if (!online) {
    body = <div className="p-4"><Callout tone="warning" role="alert">No connection. Try again when you have signal.</Callout></div>;
  } else {
    body = (
      <PdfViewer
        name={name}
        load={async () => (await slipFile(id, `Leave-slip-${code}.pdf`)).blob}
        onPage={(page, pages) => setCounter(`${page} / ${pages}`)}
        top={cancelled ? <p className="m-0 px-4 pt-3 font-wds-sans text-[13px] leading-4 text-wds-neutral-300" role="status">This leave was cancelled.</p> : undefined}
        footer={
          <div className="flex gap-2.5">
            <DownloadSlipButton id={id} code={code} kind="primary" className="min-w-0 flex-[2]" />
            <ShareSlipButton id={id} code={code} className="min-w-0 flex-1" />
          </div>
        }
      />
    );
  }

  return (
    <PhoneScreen
      screen="Leave slip"
      kicker={code ? `LEAVE SLIP · ${code}` : 'LEAVE SLIP'}
      back={back}
      desktopTitle={code ? `Leave slip ${code}` : 'Leave slip'}
      bleed
      trailing={counter ? <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.08em] text-wds-neutral-300">{counter}</span> : undefined}
    >
      {body}
    </PhoneScreen>
  );
}
