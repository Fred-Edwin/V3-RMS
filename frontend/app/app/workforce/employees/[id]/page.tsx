import { FileScreen } from '@/features/workforce/people';

export default function EmployeeFilePage({ params }: { params: { id: string } }) {
  return <FileScreen id={params.id} />;
}
