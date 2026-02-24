import type { OrderSummary } from '@/types/order';

interface ActiveOrdersSummaryProps {
  orders: OrderSummary[];
}

export function ActiveOrdersSummary({ orders }: ActiveOrdersSummaryProps) {
  const pending = orders.filter((order) => order.status === 'PENDING').length;
  const inProgress = orders.filter((order) => order.status === 'IN_PROGRESS').length;
  const ready = orders.filter((order) => order.status === 'READY').length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-md border border-stone-200 bg-white p-3">
        <p className="text-label-sm text-stone-500">Pending</p>
        <p className="text-heading-md font-semibold text-stone-900">{pending}</p>
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-3">
        <p className="text-label-sm text-stone-500">In Progress</p>
        <p className="text-heading-md font-semibold text-stone-900">{inProgress}</p>
      </div>
      <div className="rounded-md border border-stone-200 bg-white p-3">
        <p className="text-label-sm text-stone-500">Ready</p>
        <p className="text-heading-md font-semibold text-stone-900">{ready}</p>
      </div>
    </div>
  );
}
