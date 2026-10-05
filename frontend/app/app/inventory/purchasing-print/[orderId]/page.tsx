import { LpoPrintScreen } from '@/features/inventory/purchasing/components/screens/lpo-print-screen';

/** Standalone print route for the LPO (Paper `09`): deliberately outside `(shell)`, no sidebar or top bar. */
export default async function LpoPrintPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <LpoPrintScreen orderId={orderId} />;
}
