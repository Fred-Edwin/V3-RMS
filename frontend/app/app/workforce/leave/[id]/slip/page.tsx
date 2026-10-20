import { SlipScreen } from '@/features/workforce/leave';

export default function LeaveSlipRoute({ params }: { params: { id: string } }) {
  return <SlipScreen id={params.id} from="manager" />;
}
