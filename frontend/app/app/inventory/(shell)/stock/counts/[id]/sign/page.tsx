import { ReviewSignScreen } from '@/features/inventory';

export default function CountSignPage({ params }: { params: { id: string } }) {
  return <ReviewSignScreen countId={params.id} />;
}
