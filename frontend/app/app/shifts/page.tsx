import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { Calendar } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Shifts" subtitle="Track schedules and attendance." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<Calendar size={24} />}
          heading="Shift scheduling is coming soon"
          body="You will be able to review upcoming and completed shifts here."
        />
      </div>
    </PageLayout>
  );
}
