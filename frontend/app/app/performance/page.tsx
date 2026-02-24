import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { BarChart2 } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Performance" subtitle="Personal productivity insights will appear here." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<BarChart2 size={24} />}
          heading="Performance insights are coming soon"
          body="You will see completed work, averages, and trends in this view."
        />
      </div>
    </PageLayout>
  );
}
