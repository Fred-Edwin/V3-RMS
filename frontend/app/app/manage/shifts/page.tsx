import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { Calendar } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Shift Management" subtitle="Configure and monitor branch schedules." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<Calendar size={24} />}
          heading="Shift management is coming soon"
          body="Shift templates, assignments, and attendance insights will appear here."
        />
      </div>
    </PageLayout>
  );
}
