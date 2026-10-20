import { SignScreen } from '@/features/workforce/conduct';

export default function ConductSignPage({ params }: { params: { id: string } }) {
  return <SignScreen id={params.id} />;
}
