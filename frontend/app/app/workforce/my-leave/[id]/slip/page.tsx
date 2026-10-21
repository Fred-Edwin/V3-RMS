import { SlipScreen } from '@/features/workforce/leave';

export default function MyLeaveSlipRoute({ params }: { params: { id: string } }) {
  return <SlipScreen id={params.id} />;
}
