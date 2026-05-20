'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer, WifiOff } from 'lucide-react';
import { Modal, Button, Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { printService } from '@/services/printService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { SelectablePrintStation } from '@/types/print';

const LAST_STATION_KEY = 'wendo:lastPrintStationId';

interface PrintTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What is being printed — drives the modal copy only. */
  kind: 'BILL' | 'RECEIPT';
  /** Called with the chosen station id, or null to let any station claim it. */
  onConfirm: (targetStationId: string | null) => void;
  isSubmitting?: boolean;
}

const readLastStationId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LAST_STATION_KEY);
  } catch {
    return null;
  }
};

const writeLastStationId = (id: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_STATION_KEY, id);
  } catch {
    // localStorage unavailable (private mode / quota) — non-fatal.
  }
};

/**
 * Device picker shown when a waiter prints a bill or receipt.
 *
 * - Lists every print station in the branch; offline ones are marked, not hidden.
 * - Defaults to the last-used station when it is online, otherwise the first
 *   online station (the last-used choice is still remembered for next time).
 * - Picking an offline station is allowed but needs a second confirm (soft block):
 *   the job is still created and prints once the device reconnects.
 * - If the station list fails to load or is empty, falls back to a plain confirm
 *   that creates a null-target job — i.e. exactly the pre-feature behavior.
 */
export function PrintTargetModal({
  isOpen,
  onClose,
  kind,
  onConfirm,
  isSubmitting = false,
}: PrintTargetModalProps): JSX.Element | null {
  const accessToken = useAuthStore((s) => s.accessToken);

  const [stations, setStations] = useState<SelectablePrintStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [offlineConfirmPending, setOfflineConfirmPending] = useState(false);

  const loadStations = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const data = await printService.listSelectableStations(accessToken);
      setStations(data);

      // Default selection: last-used-if-online → first online → first overall.
      const lastId = readLastStationId();
      const lastStation = data.find((s) => s.id === lastId);
      const firstOnline = data.find((s) => s.isOnline);
      const fallback = data[0];
      const chosen = lastStation?.isOnline ? lastStation : (firstOnline ?? fallback);
      setSelectedId(chosen?.id ?? '');
    } catch (error) {
      // Network/permission failure — degrade to the plain (null-target) confirm.
      setLoadFailed(error instanceof ApiError || error instanceof Error);
      setStations([]);
      setSelectedId('');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  // Fetch the list lazily, only when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setOfflineConfirmPending(false);
    void loadStations();
  }, [isOpen, loadStations]);

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedId) ?? null,
    [stations, selectedId],
  );

  const options: SelectOption[] = useMemo(
    () =>
      stations.map((s) => ({
        value: s.id,
        label: s.isOnline ? s.name : `${s.name} — offline`,
      })),
    [stations],
  );

  const noStations = !isLoading && stations.length === 0;
  const useNullTargetFallback = loadFailed || noStations;

  const kindLabel = kind === 'BILL' ? 'bill' : 'receipt';

  const handleConfirm = (): void => {
    // Fallback path: no usable station list — create a null-target job.
    if (useNullTargetFallback) {
      onConfirm(null);
      return;
    }
    if (!selectedStation) return;

    // Soft block: an offline device needs an explicit second confirm.
    if (!selectedStation.isOnline && !offlineConfirmPending) {
      setOfflineConfirmPending(true);
      return;
    }

    writeLastStationId(selectedStation.id);
    onConfirm(selectedStation.id);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={kind === 'BILL' ? 'Print Bill' : 'Print Receipt'}
      maxWidth="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            isLoading={isSubmitting}
            disabled={isLoading || (!useNullTargetFallback && !selectedStation)}
            onClick={handleConfirm}
          >
            <Printer size={16} className="mr-2 shrink-0" />
            {offlineConfirmPending ? 'Print Anyway' : 'Print'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {kind === 'RECEIPT' && (
          <p className="text-body-sm text-stone-600">
            This prints 2 copies (customer + accountant). Printing again is allowed if a copy is
            already out.
          </p>
        )}

        {isLoading && <p className="text-body-sm text-stone-500">Loading print devices…</p>}

        {useNullTargetFallback && !isLoading && (
          <p className="text-body-sm text-stone-600">
            {loadFailed
              ? 'Could not load the device list. The ' +
                kindLabel +
                ' will be sent to the branch and printed by the first available device.'
              : 'No print device is registered for this branch yet. The ' +
                kindLabel +
                ' will be queued for the first device that connects.'}
          </p>
        )}

        {!isLoading && !useNullTargetFallback && (
          <Select
            label="Print device"
            options={options}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setOfflineConfirmPending(false);
            }}
          />
        )}

        {selectedStation && !selectedStation.isOnline && (
          <div className="flex items-start gap-2 rounded-sm bg-amber-50 border border-amber-200 p-3">
            <WifiOff size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-body-sm text-amber-800">
              <span className="font-medium">{selectedStation.name}</span> is offline. The{' '}
              {kindLabel} will print as soon as that device reconnects.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
