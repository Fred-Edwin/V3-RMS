'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, EmptyState, Input, PageHeader, PageLayout, Select, SkeletonTable } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { incidentService, type Incident, type IncidentType } from '@/services/incidentService';
import { useAuthStore } from '@/store/authStore';
import { useIncidentStore } from '@/store/incidentStore';
import { getSocket } from '@/lib/socket';
import { ApiError } from '@/types/api';

const INCIDENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'ORDER_CANCELLED', label: 'Order Cancelled' },
  { value: 'TICKET_REJECTED', label: 'Ticket Rejected' },
  { value: 'MODIFICATION_REQUESTED', label: 'Modification Requested' },
  { value: 'MODIFICATION_APPROVED', label: 'Modification Approved' },
  { value: 'MODIFICATION_REJECTED', label: 'Modification Rejected' },
  { value: 'TICKET_UNCLAIMED', label: 'Ticket Unclaimed' },
  { value: 'ORDER_STALE', label: 'Order Stale' },
] as const;

const incidentTypeLabel: Record<IncidentType, string> = {
  ORDER_CANCELLED: 'Order Cancelled',
  TICKET_REJECTED: 'Ticket Rejected',
  MODIFICATION_REQUESTED: 'Modification Requested',
  MODIFICATION_APPROVED: 'Modification Approved',
  MODIFICATION_REJECTED: 'Modification Rejected',
  TICKET_UNCLAIMED: 'Ticket Unclaimed',
  ORDER_STALE: 'Order Stale',
};

const incidentTypeColor: Record<IncidentType, string> = {
  ORDER_CANCELLED: 'bg-[#FDF2F0] text-[#9B3A2A] border-[#F5A898]',
  TICKET_REJECTED: 'bg-[#FDF2F0] text-[#9B3A2A] border-[#F5A898]',
  MODIFICATION_REQUESTED: 'bg-[#FDF3DC] text-[#92650A] border-[#F0D080]',
  MODIFICATION_APPROVED: 'bg-[#EDFAF1] text-[#1A6B3C] border-[#86EFAC]',
  MODIFICATION_REJECTED: 'bg-[#FEF0E0] text-[#A04F0A] border-[#F5B87A]',
  TICKET_UNCLAIMED: 'bg-[#FEF0E0] text-[#A04F0A] border-[#F5B87A]',
  ORDER_STALE: 'bg-[#F4F4F5] text-[#71717A] border-[#D4D4D8]',
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

const formatDetails = (details: Record<string, unknown>): string => {
  const parts: string[] = [];
  if (details.reason) parts.push(`Reason: ${String(details.reason)}`);
  if (details.description) parts.push(`Description: ${String(details.description)}`);
  if (details.reviewNote) parts.push(`Note: ${String(details.reviewNote)}`);
  if (details.dailyNumber) parts.push(`Order #${String(details.dailyNumber)}`);
  if (parts.length === 0) return JSON.stringify(details);
  return parts.join(' | ');
};

export default function IncidentsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const resetUnread = useIncidentStore((state) => state.resetUnread);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState(toYmd(new Date()));
  const [endDate, setEndDate] = useState(toYmd(new Date()));
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    resetUnread();
  }, [resetUnread]);

  const loadIncidents = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await incidentService.getMany(
        {
          type: typeFilter ? (typeFilter as IncidentType) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          perPage: 20,
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
  }, [accessToken, typeFilter, startDate, endDate, page, toast]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  // Real-time: prepend new incidents
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewIncident = (payload: {
      id: string;
      type: string;
      orderId?: string;
      actor: { id: string; name: string };
      details: Record<string, unknown>;
      createdAt: string;
    }) => {
      const incident: Incident = {
        ...payload,
        type: payload.type as IncidentType,
        organizationId: '',
        orderId: payload.orderId ?? null,
      };
      setIncidents((prev) => [incident, ...prev]);
    };

    socket.on('incident:new', handleNewIncident);
    return () => {
      socket.off('incident:new', handleNewIncident);
    };
  }, []);

  return (
    <PageLayout className="space-y-4">
      <PageHeader title="Incidents" subtitle="Non-happy-path events across your branch" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select
            label="Type"
            options={INCIDENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
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

      {isLoading ? (
        <SkeletonTable rows={6} columns={4} />
      ) : incidents.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={40} />} heading="No incidents" body="No incidents match your filters." />
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
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-label-sm font-medium ${incidentTypeColor[incident.type]}`}
                  >
                    {incidentTypeLabel[incident.type]}
                  </span>
                  <span className="text-body-sm text-stone-600">{incident.actor.name}</span>
                </div>
                <span className="shrink-0 text-caption text-stone-400">
                  {formatTimestamp(incident.createdAt)}
                </span>
              </div>

              {expandedId === incident.id && (
                <div className="mt-2 rounded-md bg-stone-50 p-2 text-body-sm text-stone-700">
                  {formatDetails(incident.details)}
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
