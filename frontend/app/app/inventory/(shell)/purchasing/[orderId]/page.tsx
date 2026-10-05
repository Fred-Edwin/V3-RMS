import { PurchaseFileScreen } from '@/features/inventory/purchasing/components/screens/purchase-file-screen';

export default async function PurchaseFilePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <PurchaseFileScreen orderId={orderId} />;
}
