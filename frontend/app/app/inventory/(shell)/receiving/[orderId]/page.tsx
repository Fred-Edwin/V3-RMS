import { ReceiveScreen } from '@/features/inventory/purchasing/components/screens/receive-screen';

export default async function ReceiveOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <ReceiveScreen orderId={orderId} />;
}
