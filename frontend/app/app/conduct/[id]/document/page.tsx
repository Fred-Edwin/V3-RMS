import { ConductDocumentScreen, staffNoticeHref } from '@/features/workforce/conduct';

export default function ConductDocumentPage({ params }: { params: { id: string } }) {
  return <ConductDocumentScreen id={params.id} back={staffNoticeHref(params.id)} />;
}
