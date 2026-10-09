'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { PrintDispatch } from '@/features/inventory/dispatch/_shared/types/dispatch-contract';
import { formatQty } from '@/features/inventory/requisitions/lib/qty';
import { dateTimeText } from '@/features/inventory/requisitions/lib/time';

/**
 * Prints the delivery notes of the dispatches just sent: for each department the store copy, then the branch copy (Amendment 1 row 14).
 * A bare page (no shell). The finished A4 template (letterhead, QR, page 2) is the desktop lane's D17; this page lays the same data
 * out plainly until that component is wired in at integration.
 */
export default function DispatchPrintBatchPage() {
  const ids = (useSearchParams().get('ids') ?? '').split(',').filter(Boolean);
  const token = useAuthStore((s) => s.accessToken) ?? undefined;
  const [notes, setNotes] = React.useState<PrintDispatch[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!token || ids.length === 0) return;
    let live = true;
    Promise.all(
      ids.flatMap((id) => (['store', 'branch'] as const).map((copy) => apiClient.get<PrintDispatch>(`/inventory/dispatch/${id}/print?copy=${copy}`, token))),
    )
      .then((all) => {
        if (live) setNotes(all);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ids` is derived from the URL; its joined text is the real dependency.
  }, [token, ids.join(',')]);

  React.useEffect(() => {
    if (!notes) return;
    const t = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(t);
  }, [notes]);

  if (failed) return <p role="alert" className="p-8 font-wds-sans text-[14px] text-wds-error-fg">Could not load the delivery notes. Close this page and try again.</p>;
  if (!notes) return <p role="status" className="p-8 font-wds-sans text-[14px] text-wds-text-muted">Preparing the delivery notes…</p>;

  return (
    <main className="bg-white text-black print:p-0">
      {notes.map((n) => (
        <article key={`${n.reference}-${n.copy}`} className="mx-auto max-w-[794px] break-after-page p-10 font-wds-sans">
          {n.voided ? <p className="mb-3 bg-wds-error-fg px-3 py-1 text-center font-wds-mono text-[12px] tracking-widest text-white">VOID · CANCELLED</p> : null}
          <header className="mb-4 flex items-start justify-between border-b border-black pb-3">
            <div>
              <h1 className="text-[20px] font-semibold">Delivery note · {n.copy === 'store' ? 'store copy' : 'branch copy'}</h1>
              <p className="text-[13px]">{n.department.name}, {n.branch.name} · {n.requisitionReference}</p>
            </div>
            <p className="font-wds-mono text-[16px]">{n.reference}</p>
          </header>
          <p className="mb-4 text-[13px]">
            {n.date} · Carried by {n.carrier.name} · Packed by {n.packed.by.name}, {n.packed.by.roleLabel} · Signed by {n.signed.by.name} · {dateTimeText(n.signed.at)}
          </p>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 pr-2">#</th>
                <th className="py-1">Item</th>
                {n.copy === 'store' ? (
                  <>
                    <th className="py-1 text-right">Asked</th>
                    <th className="py-1 text-right">Sent</th>
                  </>
                ) : (
                  <th className="py-1 text-right">Your count</th>
                )}
              </tr>
            </thead>
            <tbody>
              {n.lines.map((l) => (
                <tr key={l.n} className="break-inside-avoid border-b border-neutral-300">
                  <td className="py-1.5 pr-2">{l.n}</td>
                  <td className="py-1.5">{l.itemName} <span className="text-neutral-600">({l.unit})</span></td>
                  {n.copy === 'store' && 'sentQty' in l ? (
                    <>
                      <td className="py-1.5 text-right">{formatQty(l.requestedQty)}</td>
                      <td className="py-1.5 text-right">{formatQty(l.sentQty)}</td>
                    </>
                  ) : (
                    <td className="w-32 border-l border-neutral-300 py-1.5" />
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-10 text-[13px]">Received by: ______________________ Date: ____________</p>
        </article>
      ))}
    </main>
  );
}
