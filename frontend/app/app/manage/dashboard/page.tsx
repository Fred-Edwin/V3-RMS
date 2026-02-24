import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { LayoutDashboard } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Manager Dashboard" subtitle="Live branch operations overview." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<LayoutDashboard size={24} />}
          heading="Manager dashboard is coming soon"
          body="Live order feed, branch KPIs, and staffing snapshots will appear here."
        />
      </div>
    </PageLayout>
  );
}
