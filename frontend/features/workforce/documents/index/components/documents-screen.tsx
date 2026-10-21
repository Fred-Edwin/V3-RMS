'use client';

import * as React from 'react';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { SearchInput } from '@/components/ui2/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';

import { EmptyState, ErrorBlock, FilterBar, ListSkeleton, PageHeader, WorkforceFrame } from '../../../_shared';
import { useDocuments } from '../hooks/use-documents';
import { DOCUMENTS_COPY, footer } from '../lib/documents-words';
import type { DocumentPanelData } from '../types/documents-types';
import { DocumentPanel } from './document-panel';
import { DocumentViewer } from './document-viewer';
import { DocumentsTable } from './documents-table';

const ANY = '__any__';

/**
 * Signed documents (6c D2): every letter and statement signed with a PIN, found by number or word. The API lists only the types this
 * reader may read; the Type and Site menus come from its answer. Search types ahead; the view and the chosen document are in the address bar.
 */
export function DocumentsScreen({ tabs }: { tabs?: React.ReactNode }) {
  const d = useDocuments();
  const [text, setText] = React.useState(d.query.q);
  const [viewing, setViewing] = React.useState<DocumentPanelData | null>(null);
  const sent = React.useRef(d.query.q);
  const { change } = d;
  React.useEffect(() => {
    if (d.query.q !== sent.current) {
      sent.current = d.query.q;
      setText(d.query.q);
    }
  }, [d.query.q]);
  React.useEffect(() => {
    if (text.trim() === d.query.q.trim()) return;
    const t = window.setTimeout(() => {
      sent.current = text.trim();
      change({ q: text.trim() });
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, d.query.q, change]);

  const data = d.list.data;
  const items = data?.items ?? [];
  const chosenKey = d.selected ? `${d.selected.number}.${d.selected.version}` : null;

  let body: React.ReactNode;
  if (d.list.status === 'loading') body = <ListSkeleton rows={8} columns={[110, 'fill', 120, 120]} label="Loading the documents" />;
  else if (d.list.status === 'error' && !data) body = <ErrorBlock title={DOCUMENTS_COPY.error} line={DOCUMENTS_COPY.errorLine} reference={d.list.error.code === 'NETWORK' ? undefined : d.list.error.code} onRetry={d.list.reload} />;
  else if (data && items.length === 0) {
    body = d.filtered ? <EmptyState kind="nothingFound" title={DOCUMENTS_COPY.nothingFound} action={{ label: 'Clear filters', onClick: d.clear }} /> : <EmptyState kind="nothingYet" title={DOCUMENTS_COPY.empty} />;
  } else if (data) {
    body = (
      <>
        <DocumentsTable items={items} term={d.query.q} chosen={chosenKey} onChoose={(i) => d.select({ number: i.number, version: i.version })} />
        <TablePager page={d.query.page} perPage={d.query.pageSize} shown={items.length} total={data.total} onPageChange={d.goToPage} onPerPageChange={(n) => d.change({ pageSize: n as 25 | 50 | 100 })} />
        <p role="status" className="m-0 px-4 pt-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{footer(data.page, data.pageSize, items.length, data.total, data.totalIsExact)}</p>
      </>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'Settings', screen: 'Signed documents' }} phoneTitle="Signed documents" label="Signed documents">
      <div className="flex flex-col gap-4 px-8 py-7 max-sm:px-4">
        <PageHeader size="lg" title="Audit log" subtitle={DOCUMENTS_COPY.subtitle} />
        {tabs}
        <FilterBar
          search={<SearchInput value={text} onChange={(e) => setText(e.target.value)} placeholder={DOCUMENTS_COPY.searchPlaceholder} shortcutHint="" aria-label="Search signed documents" maxLength={60} className="w-[300px] max-sm:w-full" />}
          trailing={
            <>
              <Select value={d.query.type || ANY} onValueChange={(v) => d.change({ type: v === ANY ? '' : v })}>
                <SelectTrigger aria-label="Type" className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All types</SelectItem>
                  {data?.types.map((t) => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {data && data.organizations.length > 0 ? (
                <Select value={d.query.siteId || ANY} onValueChange={(v) => d.change({ siteId: v === ANY ? '' : v })}>
                  <SelectTrigger aria-label="Site" className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>All sites</SelectItem>
                    {data.organizations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
              <DateRangePicker label="Dates" today={d.today} value={{ from: d.query.from, to: d.query.to }} buttonClassName="h-8 px-3 text-[12px]" onChange={(r) => r && d.change({ from: r.from, to: r.to })} />
              <Select value={d.query.sort} onValueChange={(v) => d.change({ sort: v === 'oldest' ? 'oldest' : 'newest' })}>
                <SelectTrigger aria-label="Sort" className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />
        <div className="flex items-start gap-5 max-lg:flex-col">
          <div className="min-w-0 flex-1">{body}</div>
          {d.selected ? <DocumentPanel panel={d.panel} onOpen={setViewing} onClose={() => d.select(null)} /> : null}
        </div>
      </div>
      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
    </WorkforceFrame>
  );
}
