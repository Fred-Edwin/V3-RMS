import { EmptyState, PageHeader, PageLayout } from '@/components/ui';
import { Bike } from 'lucide-react';

export default function Page(): JSX.Element {
  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Delivery Zones" subtitle="Manage delivery coverage and fee bands." />
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <EmptyState
          icon={<Bike size={24} />}
          heading="Delivery zone tools are coming soon"
          body="Zone setup, fee configuration, and coverage controls will appear here."
        />
      </div>
    </PageLayout>
  );
}
