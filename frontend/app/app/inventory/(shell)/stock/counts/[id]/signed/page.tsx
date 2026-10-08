import { SignedCountScreen } from '@/features/inventory';

export default function CountSignedPage({ params }: { params: { id: string } }) {
  return <SignedCountScreen countId={params.id} />;
}
