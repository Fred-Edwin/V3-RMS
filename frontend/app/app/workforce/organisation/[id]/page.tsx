import { DepartmentScreen } from '@/features/workforce/people';

export default function DepartmentPage({ params }: { params: { id: string } }) {
  return <DepartmentScreen id={params.id} />;
}
