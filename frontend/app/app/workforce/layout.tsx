import { WorkforceNavDrawerProvider } from '@/features/workforce/home';

/** Workforce route group. Routing only: it mounts the phone menu drawer that every Workforce screen's own header opens. */
export default function WorkforceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkforceNavDrawerProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </WorkforceNavDrawerProvider>
  );
}
