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
    <section className="rounded-md bg-stone-100 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-heading-sm font-semibold text-stone-900">{title}</h3>
        <span className="rounded-full bg-stone-300 px-2 py-0.5 text-label-sm text-stone-700">
          {tickets.length}
        </span>
      </div>

      {tickets.length === 0 ? (
        <p className="text-body-sm text-stone-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">{tickets.map((ticket) => renderTicket(ticket))}</div>
      )}
    </section>
  );
}
