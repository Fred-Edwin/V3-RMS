import { redirect } from 'next/navigation';

/** Receiving is the "To receive" stage of the one Purchasing flow. */
export default function ReceivingPage() {
  redirect('/app/inventory/purchasing?tab=receive');
}
