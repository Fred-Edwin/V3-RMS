'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  PageLayout,
  Select,
  SkeletonTable,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { incidentService, type Incident, type IncidentType } from '@/services/incidentService';
import { branchService, type BranchDto } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

const INCIDENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'ORDER_CANCELLED', label: 'Order Cancelled' },
  { value: 'ORDER_ITEM_REMOVED', label: 'Order Item Removed' },
  { value: 'TICKET_REJECTED', label: 'Ticket Rejected' },
  { value: 'TICKET_UNCLAIMED', label: 'Ticket Unclaimed' },
  { value: 'ORDER_STALE', label: 'Order Stale' },
];

const incidentTypeLabel: Record<IncidentType, string> = {
  ORDER_CANCELLED: 'Order Cancelled',
  ORDER_ITEM_REMOVED: 'Item Removed',
  TICKET_REJECTED: 'Ticket Rejected',
  MODIFICATION_REQUESTED: 'Mod Requested',
  MODIFICATION_APPROVED: 'Mod Approved',
  MODIFICATION_REJECTED: 'Mod Rejected',
  TICKET_UNCLAIMED: 'Ticket Unclaimed',
  ORDER_STALE: 'Order Stale',
};

const incidentTypeColor: Record<IncidentType, string> = {
  ORDER_CANCELLED: 'bg-[#FDF2F0] text-[#9B3A2A] border-[#F5A898]',
  ORDER_ITEM_REMOVED: 'bg-[#FEF0E0] text-[#A04F0A] border-[#F5B87A]',
  TICKET_REJECTED: 'bg-[#FDF2F0] text-[#9B3A2A] border-[#F5A898]',
  MODIFICATION_REQUESTED: 'bg-[#FDF3DC] text-[#92650A] border-[#F0D080]',
  MODIFICATION_APPROVED: 'bg-[#EDFAF1] text-[#1A6B3C] border-[#86EFAC]',
  MODIFICATION_REJECTED: 'bg-[#FEF0E0] text-[#A04F0A] border-[#F5B87A]',
  TICKET_UNCLAIMED: 'bg-[#FEF0E0] text-[#A04F0A] border-[#F5B87A]',
  ORDER_STALE: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
};

const toYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDetails = (type: IncidentType, details: Record<string, unknown>): React.ReactNode => {
  if (type === 'ORDER_ITEM_REMOVED') {
    const removedItems = details.removedItems as Array<{ name: string; quantity: number }> | undefined;
    return (
      <div className="space-y-1.5">
        {Boolean(details.reason) && (
          <div className="flex items-start gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Reason</span>
            <span className="text-stone-700">{String(details.reason)}</span>
          </div>
        )}
        {Boolean(details.dailyNumber) && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Order</span>
            <span className="text-stone-700">#{String(details.dailyNumber)}</span>
          </div>
        )}
        {removedItems && removedItems.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0 mt-0.5">Removed</span>
            <div className="space-y-0.5">
              {removedItems.map((item, i) => (
                <div key={i} className="text-stone-700">
                  {item.name} {item.quantity > 1 ? `×${item.quantity}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
        {details.resultedInCancellation === true && (
          <div className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-caption text-red-700">
            Order cancelled as a result
          </div>
        )}
      </div>
    );
  }

  if (type === 'ORDER_STALE') {
    return (
      <div className="space-y-1.5">
        {Boolean(details.waiterName) && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Waiter</span>
            <span className="font-semibold text-stone-900">{String(details.waiterName)}</span>
          </div>
        )}
        {Boolean(details.dailyNumber) && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Order</span>
            <span className="text-stone-700">#{String(details.dailyNumber)}</span>
          </div>
        )}
      </div>
    );
  }

  const parts: string[] = [];
  if (details.reason) parts.push(`Reason: ${String(details.reason)}`);
  if (details.description) parts.push(String(details.description));
  if (details.dailyNumber) parts.push(`Order #${String(details.dailyNumber)}`);
  if (parts.length === 0) return JSON.stringify(details);
  return parts.join(' · ');
};

export default function DirectorIncidentsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [startDate, setStartDate] = useState(toYmd(new Date()));
  const [endDate, setEndDate] = useState(toYmd(new Date()));
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load branches once for the filter dropdown
  useEffect(() => {
    if (!accessToken) return;
    branchService.listBranches(accessToken).then((data) => {
      setBranches(data.filter((b) => b.isActive && !b.isHub));
    }).catch(() => { /* non-critical */ });
  }, [accessToken]);

  const loadIncidents = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await incidentService.getMany(
        {
          type: typeFilter ? (typeFilter as IncidentType) : undefined,
          branchId: branchFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          perPage: 25,
        },
        accessToken,
      );
      setIncidents(result.incidents);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load incidents';
      toast({ variant: 'error', title: 'Error', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, typeFilter, branchFilter, startDate, endDate, page, toast]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const branchOptions = [
    { value: '', label: 'All Branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <PageLayout className="space-y-4">
      <PageHeader
        title="Incident Log"
        subtitle="All interventions and non-happy-path events across branches"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select
            label="Branch"
            options={branchOptions}
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-52">
          <Select
            label="Type"
            options={INCIDENT_TYPE_OPTIONS}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-40">
          <Input
            label="From"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-40">
          <Input
            label="To"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable rows={8} columns={4} />
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={40} />}
          heading="No incidents"
          body="No incidents match your filters."
        />
      ) : (
        <div className="space-y-2">
          {incidents.map((incident) => (
            <button
              key={incident.id}
              type="button"
              className="w-full rounded-lg border border-stone-200 bg-white p-3 text-left transition-colors hover:border-stone-300"
              onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-label-sm font-medium ${incidentTypeColor[incident.type]}`}
                  >
                    {incidentTypeLabel[incident.type]}
                  </span>
                  {/* Branch */}
                  <span className="hidden sm:inline text-label-sm font-medium text-stone-700 bg-stone-100 rounded-full px-2 py-0.5">
                    {incident.branchName}
                  </span>
                  {/* Actor */}
                  <span className="text-body-sm text-stone-600">{incident.actor?.name ?? 'System'}</span>
                </div>
                <span className="shrink-0 text-caption text-stone-400">
                  {formatTimestamp(incident.createdAt)}
                </span>
              </div>

              {/* Branch on mobile (below the row) */}
              <div className="mt-1 sm:hidden text-caption text-stone-500">{incident.branchName}</div>

              {expandedId === incident.id && (
                <div className="mt-2 rounded-md bg-stone-50 p-2 text-body-sm text-stone-700">
                  {formatDetails(incident.type, incident.details)}
                </div>
              )}
            </button>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-body-sm text-stone-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
