import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { LayoutDashboard } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Director Dashboard" subtitle="Cross-branch performance overview." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<LayoutDashboard size={24} />}
          heading="Director metrics are coming soon"
          body="Branch comparisons, portfolio trends, and executive summaries will appear here."
        />
      </div>
    </PageLayout>
  );
}
