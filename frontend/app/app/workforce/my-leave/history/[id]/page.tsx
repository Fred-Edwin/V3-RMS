import { FollowScreen } from '@/features/workforce/leave';

export default function MyLeaveFollowRoute({ params }: { params: { id: string } }) {
  return <FollowScreen id={params.id} />;
}
