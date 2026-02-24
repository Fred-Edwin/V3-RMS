import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { BarChart2 } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Reports" subtitle="Review branch trends, revenue, and performance." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<BarChart2 size={24} />}
          heading="Reports are coming soon"
          body="Revenue trends, payment breakdowns, and operational summaries will appear here."
        />
      </div>
    </PageLayout>
  );
}
