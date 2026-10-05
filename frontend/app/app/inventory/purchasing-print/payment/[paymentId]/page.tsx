import { PaymentAdvicePrintScreen } from '@/features/inventory/purchasing/components/screens/payment-advice-print-screen';

/** Standalone print route for a payment advice (Paper `21`, `21b`): outside `(shell)`, no sidebar or top bar. */
export default async function PaymentAdvicePrintPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <PaymentAdvicePrintScreen paymentId={paymentId} />;
}
