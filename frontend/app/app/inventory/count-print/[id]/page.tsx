import { CountRecordPage } from '@/features/inventory';

export default function CountPrintPage({ params }: { params: { id: string } }) {
  return <CountRecordPage countId={params.id} />;
}
