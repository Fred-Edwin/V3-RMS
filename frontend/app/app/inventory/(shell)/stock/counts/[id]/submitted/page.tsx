import { SubmittedScreen } from '@/features/inventory';

export default function CountSubmittedPage({ params }: { params: { id: string } }) {
  return <SubmittedScreen countId={params.id} />;
}
