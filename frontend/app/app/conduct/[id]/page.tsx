import { NoticeScreen } from '@/features/workforce/conduct';

export default function ConductNoticePage({ params }: { params: { id: string } }) {
  return <NoticeScreen id={params.id} />;
}
