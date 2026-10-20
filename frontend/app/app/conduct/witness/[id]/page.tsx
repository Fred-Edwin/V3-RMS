import { WitnessCardScreen } from '@/features/workforce/conduct';

export default function ConductWitnessPage({ params }: { params: { id: string } }) {
  return <WitnessCardScreen id={params.id} />;
}
