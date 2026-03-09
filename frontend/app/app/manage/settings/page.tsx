'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Printer, Trash2, Wifi, WifiOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { env } from '@/lib/env';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  SkeletonTable,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { printService } from '@/services/printService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { CreatedPrintStation, PrintStation } from '@/types/print';

export default function BranchSettingsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [stations, setStations] = useState<PrintStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add station modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Token reveal modal (shown once after creation)
  const [tokenModal, setTokenModal] = useState<{ stationName: string; token: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Remove confirm dialog
  const [stationPendingRemove, setStationPendingRemove] = useState<PrintStation | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const loadStations = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const data = await printService.listPrintStations(accessToken);
      setStations(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load print stations.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadStations();
  }, [loadStations]);

  const handleAddStation = async () => {
    if (!accessToken || !newStationName.trim()) return;
    setIsAdding(true);
    try {
      const created: CreatedPrintStation = await printService.createPrintStation(
        newStationName.trim(),
        accessToken,
      );
      setStations((prev) => [
        ...prev,
        {
          id: created.id,
          organizationId: created.organizationId,
          name: created.name,
          isActive: created.isActive,
          isOnline: false,
          lastSeenAt: null,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      ]);
      setIsAddModalOpen(false);
      setNewStationName('');
      setTokenModal({ stationName: created.name, token: created.token });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to create print station.';
      toast({ variant: 'error', title: 'Create failed', message });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveStation = async () => {
    if (!accessToken || !stationPendingRemove) return;
    setIsRemoving(true);
    try {
      await printService.deactivatePrintStation(stationPendingRemove.id, accessToken);
      setStations((prev) => prev.filter((s) => s.id !== stationPendingRemove.id));
      toast({ variant: 'success', title: 'Print station removed' });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to remove print station.';
      toast({ variant: 'error', title: 'Remove failed', message });
    } finally {
      setIsRemoving(false);
      setStationPendingRemove(null);
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast({ variant: 'error', title: 'Copy failed', message: 'Could not copy to clipboard.' });
    }
  };

  const formatLastSeen = (lastSeenAt: string | null): string => {
    if (!lastSeenAt) return 'Never';
    const date = new Date(lastSeenAt);
    return date.toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <PageLayout className="space-y-6">
      <PageHeader title="Branch Settings" subtitle="Manage printers and branch configuration" />

      {/* Print Stations section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-body-md font-semibold text-stone-900">Print Stations</h2>
            <p className="text-body-sm text-stone-500">
              Thermal receipt printers connected via the Wendo Printer app
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setNewStationName('');
              setIsAddModalOpen(true);
            }}
          >
            Add Printer
          </Button>
        </div>

        {isLoading && <SkeletonTable rows={2} />}

        {!isLoading && stations.length === 0 && (
          <EmptyState
            icon={<Printer size={32} className="text-stone-400" />}
            heading="No print stations"
            body="Add a print station to enable receipt printing at this branch."
          />
        )}

        {!isLoading && stations.length > 0 && (
          <div className="space-y-2">
            {stations.map((station) => (
              <div
                key={station.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100">
                    <Printer size={18} className="text-stone-600" />
                  </div>
                  <div>
                    <p className="text-body-md font-medium text-stone-900">{station.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {station.isOnline ? (
                        <>
                          <Wifi size={12} className="text-[#1A6B3C]" />
                          <span className="text-caption text-[#1A6B3C]">Online</span>
                        </>
                      ) : (
                        <>
                          <WifiOff size={12} className="text-stone-400" />
                          <span className="text-caption text-stone-400">
                            {station.lastSeenAt ? `Last seen ${formatLastSeen(station.lastSeenAt)}` : 'Never connected'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <IconButton
                  icon={<Trash2 size={16} />}
                  label="Remove station"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStationPendingRemove(station)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add station modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Print Station"
        maxWidth="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              isLoading={isAdding}
              disabled={!newStationName.trim()}
              onClick={() => void handleAddStation()}
            >
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-1">
          <p className="text-body-sm text-stone-500">
            Give this printer a name (e.g. &quot;Counter Printer&quot;). A secret token will be
            generated — you&apos;ll enter it in the Wendo Printer app on the work phone.
          </p>
          <Input
            label="Printer name"
            value={newStationName}
            onChange={(e) => setNewStationName(e.target.value)}
            placeholder="e.g. Counter Printer"
            autoFocus
          />
        </div>
      </Modal>

      {/* Token reveal modal — shown once */}
      <Modal
        isOpen={tokenModal !== null}
        onClose={() => {
          setTokenModal(null);
          setIsCopied(false);
        }}
        title="Save This Token"
        maxWidth="sm"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setTokenModal(null);
              setIsCopied(false);
            }}
          >
            Done — I&apos;ve saved it
          </Button>
        }
      >
        <div className="space-y-4 p-1">
          <p className="text-body-sm text-stone-700">
            <strong>{tokenModal?.stationName}</strong> has been created. Scan the QR code with the
            Wendo Printer app, or copy the token manually.
          </p>
          {tokenModal && (
            <div className="flex justify-center rounded-xl border border-stone-200 bg-white p-4">
              <QRCodeSVG
                value={JSON.stringify({
                  url: env.apiUrl,
                  token: tokenModal.token,
                  name: tokenModal.stationName,
                })}
                size={180}
                level="M"
              />
            </div>
          )}
          <div className="rounded-lg border border-amber/40 bg-[#FDF3DC] p-3">
            <p className="mb-2 text-label-sm text-[#92650A]">
              This token will NOT be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
              <code className="flex-1 break-all text-caption text-stone-900">
                {tokenModal?.token}
              </code>
              <button
                type="button"
                onClick={() => tokenModal && void handleCopyToken(tokenModal.token)}
                className="shrink-0 rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                aria-label="Copy token"
              >
                {isCopied ? (
                  <Check size={16} className="text-[#1A6B3C]" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Remove confirm dialog */}
      <ConfirmDialog
        isOpen={stationPendingRemove !== null}
        onClose={() => setStationPendingRemove(null)}
        title="Remove Print Station"
        description={`Remove "${stationPendingRemove?.name}"? The token will be invalidated immediately. You can add a new station anytime.`}
        confirmLabel="Remove"
        isLoading={isRemoving}
        onConfirm={() => void handleRemoveStation()}
      />
    </PageLayout>
  );
}
