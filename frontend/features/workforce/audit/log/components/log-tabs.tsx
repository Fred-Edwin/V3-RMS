'use client';

import { usePathname, useRouter } from 'next/navigation';

import { UnderlineTabs, useWorkforcePermissions, type WorkforceCapability } from '../../../_shared';

/** The types the Signed documents index may list; holding any one of these opens the tab (the API still lists only each type's own). */
const DOCUMENT_CAPABILITIES: readonly WorkforceCapability[] = ['payroll.read', 'payslip.read_any', 'casual.read', 'timesheet.read', 'leave.read', 'discipline.read', 'employee.read_sensitive'];
const LOG_CAPABILITIES: readonly WorkforceCapability[] = [
  'audit.read.people',
  'audit.read.time',
  'audit.read.leave',
  'audit.read.pay_setup',
  'audit.read.pay_run_prepare',
  'audit.read.pay_run_decide',
  'audit.read.rules_operating',
  'audit.read.rules_pay',
  'audit.read.payslip_access',
  'audit.read.discipline',
  'audit.read.security',
  'audit.read.documents',
  'audit.read.log_access',
];

/** What the person may open on this page, from the access table. The tabs and the page both read it. */
export function useAuditTabs() {
  const permissions = useWorkforcePermissions();
  const log = LOG_CAPABILITIES.some((c) => permissions.can(c));
  const documents = DOCUMENT_CAPABILITIES.some((c) => permissions.can(c));
  return { ready: permissions.ready, failed: permissions.failed, retry: permissions.retry, log, documents };
}

/**
 * "Company log" and "Signed documents" (Paper 17.1). A tab the person may not open is not drawn; one tab alone is not drawn as tabs.
 * The address bar holds the tab (`?tab=documents`); switching starts that tab's own filters fresh.
 */
export function LogTabs({ current, log, documents }: { current: 'log' | 'documents'; log: boolean; documents: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  if (!log || !documents) return null;
  return (
    <UnderlineTabs
      label="Audit log sections"
      value={current}
      onChange={(v) => router.replace(v === 'documents' ? `${pathname}?tab=documents` : pathname, { scroll: false })}
      items={[
        { value: 'log', label: 'Company log' },
        { value: 'documents', label: 'Signed documents' },
      ]}
    />
  );
}
