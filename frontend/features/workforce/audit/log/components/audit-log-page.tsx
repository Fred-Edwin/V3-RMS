'use client';

import { useSearchParams } from 'next/navigation';

import { DocumentsScreen } from '../../../documents';
import { ErrorBlock, ListSkeleton, WorkforceFrame } from '../../../_shared';
import { AuditLogScreen } from './audit-log-screen';
import { LogTabs, useAuditTabs } from './log-tabs';

/**
 * The route's body: "Company log" and "Signed documents" under one title (Paper 17.1). Each tab is drawn only to a person whose access
 * table allows it; a person who may open neither gets the page's own 404 wording and no menu row. The address bar holds the tab.
 */
export function AuditLogPage() {
  const access = useAuditTabs();
  const search = useSearchParams();
  if (!access.ready) {
    return (
      <WorkforceFrame breadcrumb={{ section: 'Settings', screen: 'Audit log' }} phoneTitle="Audit log" label="Audit log">
        <div className="px-8 py-7 max-sm:px-4">
          {access.failed ? <ErrorBlock title="We could not check what you may open." line="Nothing was changed." onRetry={access.retry} /> : <ListSkeleton rows={6} columns={[110, 'fill', 120]} label="Opening the audit log" />}
        </div>
      </WorkforceFrame>
    );
  }
  if (!access.log && !access.documents) {
    return (
      <WorkforceFrame breadcrumb={{ section: 'Settings', screen: 'Audit log' }} phoneTitle="Audit log" label="Audit log">
        <div className="px-8 py-7 max-sm:px-4">
          <ErrorBlock title="We could not find that page." line="You do not have access to the audit log." />
        </div>
      </WorkforceFrame>
    );
  }
  const current = access.documents && (search.get('tab') === 'documents' || !access.log) ? 'documents' : 'log';
  const tabs = <LogTabs current={current} log={access.log} documents={access.documents} />;
  return current === 'documents' ? <DocumentsScreen tabs={tabs} /> : <AuditLogScreen tabs={tabs} />;
}
