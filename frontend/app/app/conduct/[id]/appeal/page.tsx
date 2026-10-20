import { AppealScreen } from '@/features/workforce/conduct';

export default function ConductAppealPage({ params }: { params: { id: string } }) {
  return <AppealScreen id={params.id} />;
}
