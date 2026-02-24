import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { Clock } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Clock" subtitle="Clock-in and shift controls will appear here." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<Clock size={24} />}
          heading="Clock tools are coming soon"
          body="This page will host branch clock-in and shift attendance actions."
        />
      </div>
    </PageLayout>
  );
}
