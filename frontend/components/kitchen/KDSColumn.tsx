'use client';

import type { PrepTicketDetail } from '@/types/order';

interface KDSColumnProps {
  title: string;
  tickets: PrepTicketDetail[];
  emptyMessage: string;
  renderTicket: (ticket: PrepTicketDetail) => React.ReactNode;
}

export function KDSColumn({ title, tickets, emptyMessage, renderTicket }: KDSColumnProps) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-stone-200 bg-stone-100/80 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm">
        <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-label-sm text-stone-700">
          {tickets.length}
        </span>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-stone-200 bg-white px-4 py-6">
          <p className="text-body-sm text-stone-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">{tickets.map((ticket) => renderTicket(ticket))}</div>
      )}
    </section>
  );
}
