import { ProbationReportScreen } from '@/features/workforce/people';

export default function ProbationReportPage({ params }: { params: { id: string } }) {
  return <ProbationReportScreen id={params.id} />;
}
