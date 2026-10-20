import { ConductDocumentScreen, deskNoticeHref } from '@/features/workforce/conduct';

export default function ConductDeskDocumentPage({ params }: { params: { id: string } }) {
  return <ConductDocumentScreen id={params.id} back={deskNoticeHref(params.id)} />;
}
