import { HeadFileScreen } from '@/features/inventory/requisitions';

export default function RequisitionFilePage({ params }: { params: { id: string } }) {
  return <HeadFileScreen requisitionId={params.id} />;
}
