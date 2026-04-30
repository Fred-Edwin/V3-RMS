'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, Copy, ExternalLink, Hash, Pencil, Phone, Printer, QrCode, Smartphone, Trash2, Wifi, WifiOff } from 'lucide-react';
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
  SkeletonBlock,
  SkeletonTable,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto, type UpdateBranchProfileInput } from '@/services/branchService';
import { printService } from '@/services/printService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { CreatedPrintStation, PrintStation } from '@/types/print';

export default function DirectorBranchSettingsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  // ─── Branch list ─────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [isBranchesLoading, setIsBranchesLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  useEffect(() => {
    if (!accessToken) return;
    setIsBranchesLoading(true);
    branchService
      .listBranches(accessToken)
      .then((data) => {
        const active = data.filter((b) => b.isActive && !b.isHub);
        setBranches(active);
        if (active.length > 0) setSelectedBranchId(active[0].id);
      })
      .catch(() => {
        toast({ variant: 'error', title: 'Load failed', message: 'Unable to load branches.' });
      })
      .finally(() => setIsBranchesLoading(false));
  }, [accessToken, toast]);

  // ─── Branch profile ──────────────────────────────────────────────────────
  const [profile, setProfile] = useState<BranchDto | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<UpdateBranchProfileInput>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!accessToken || !selectedBranchId) return;
    setIsProfileLoading(true);
    setProfile(null);
    try {
      const data = await branchService.getBranchProfile(selectedBranchId, accessToken);
      setProfile(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load branch details.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsProfileLoading(false);
    }
  }, [accessToken, selectedBranchId, toast]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const openEditModal = () => {
    setEditForm({
      phone: profile?.phone ?? '',
      mpesaPaybill: profile?.mpesaPaybill ?? '',
      accountNumber: profile?.accountNumber ?? '',
      googleReviewUrl: profile?.googleReviewUrl ?? '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!accessToken || !selectedBranchId) return;
    setIsSaving(true);
    try {
      const payload: UpdateBranchProfileInput = {};
      if (editForm.phone?.trim()) payload.phone = editForm.phone.trim();
      if (editForm.mpesaPaybill?.trim()) payload.mpesaPaybill = editForm.mpesaPaybill.trim();
      if (editForm.accountNumber?.trim()) payload.accountNumber = editForm.accountNumber.trim();
      if (editForm.googleReviewUrl?.trim()) payload.googleReviewUrl = editForm.googleReviewUrl.trim();

      const updated = await branchService.updateBranchProfile(selectedBranchId, payload, accessToken);
      setProfile(updated);
      setIsEditModalOpen(false);
      toast({ variant: 'success', title: 'Branch details updated' });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to save branch details.';
      toast({ variant: 'error', title: 'Save failed', message });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Print Stations ──────────────────────────────────────────────────────
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [isStationsLoading, setIsStationsLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [tokenModal, setTokenModal] = useState<{ stationName: string; token: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [stationPendingRemove, setStationPendingRemove] = useState<PrintStation | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const [stationPendingRepair, setStationPendingRepair] = useState<PrintStation | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  const loadStations = useCallback(async () => {
    if (!accessToken || !selectedBranchId) return;
    setIsStationsLoading(true);
    setStations([]);
    try {
      const data = await printService.listPrintStations(accessToken, selectedBranchId);
      setStations(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load print stations.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsStationsLoading(false);
    }
  }, [accessToken, selectedBranchId, toast]);

  useEffect(() => {
    void loadStations();
  }, [loadStations]);

  const handleAddStation = async () => {
    if (!accessToken || !newStationName.trim() || !selectedBranchId) return;
    setIsAdding(true);
    try {
      const created: CreatedPrintStation = await printService.createPrintStation(
        newStationName.trim(),
        accessToken,
        selectedBranchId,
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
    if (!accessToken || !stationPendingRemove || !selectedBranchId) return;
    setIsRemoving(true);
    try {
      await printService.deactivatePrintStation(stationPendingRemove.id, accessToken, selectedBranchId);
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

  const handleRepairStation = async () => {
    if (!accessToken || !stationPendingRepair || !selectedBranchId) return;
    setIsRepairing(true);
    try {
      const created: CreatedPrintStation = await printService.createPrintStation(
        stationPendingRepair.name,
        accessToken,
        selectedBranchId,
      );
      await printService.deactivatePrintStation(stationPendingRepair.id, accessToken, selectedBranchId);
      setStations((prev) => [
        ...prev.filter((s) => s.id !== stationPendingRepair.id),
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
      setStationPendingRepair(null);
      setTokenModal({ stationName: created.name, token: created.token });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to re-pair print station.';
      toast({ variant: 'error', title: 'Re-pair failed', message });
    } finally {
      setIsRepairing(false);
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
    return date.toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <PageLayout className="space-y-6">
      <PageHeader title="Branch Settings" subtitle="View and update branch details for any branch" />

      {/* Branch selector */}
      <section>
        {isBranchesLoading ? (
          <SkeletonBlock className="h-10 w-64 rounded-lg" />
        ) : branches.length === 0 ? (
          <EmptyState icon={<Building2 size={32} className="text-stone-400" />} heading="No active branches" body="There are no active branches to configure." />
        ) : (
          <div className="flex items-center gap-3">
            <label htmlFor="branch-select" className="text-body-sm font-medium text-stone-700 shrink-0">
              Branch
            </label>
            <select
              id="branch-select"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-body-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {selectedBranchId && (
        <>
          {/* Branch Details */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-body-md font-semibold text-stone-900">Branch Details</h2>
                <p className="text-body-sm text-stone-500">Contact info and M-Pesa details shown on receipts</p>
              </div>
              {!isProfileLoading && profile && (
                <Button size="sm" variant="secondary" onClick={openEditModal}>
                  <Pencil size={14} className="mr-1.5" />
                  Edit
                </Button>
              )}
            </div>

            {isProfileLoading && <SkeletonBlock className="h-16 rounded-xl" />}

            {!isProfileLoading && profile && (
              <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
                <ProfileRow icon={<Phone size={14} />} label="Phone" value={profile.phone} placeholder="Not set" />
                <ProfileRow icon={<Smartphone size={14} />} label="M-Pesa Paybill" value={profile.mpesaPaybill} placeholder="Not set" />
                <ProfileRow icon={<Hash size={14} />} label="Account Number" value={profile.accountNumber} placeholder="Not set" />
                <ProfileRow icon={<ExternalLink size={14} />} label="Google Review Link" value={profile.googleReviewUrl} placeholder="Not set" />
              </div>
            )}
          </section>

          {/* Print Stations */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-body-md font-semibold text-stone-900">Print Stations</h2>
                <p className="text-body-sm text-stone-500">Thermal receipt printers connected via the Wendo Printer app</p>
              </div>
              <Button size="sm" onClick={() => { setNewStationName(''); setIsAddModalOpen(true); }}>
                Add Printer
              </Button>
            </div>

            {isStationsLoading && <SkeletonTable rows={2} />}

            {!isStationsLoading && stations.length === 0 && (
              <EmptyState
                icon={<Printer size={32} className="text-stone-400" />}
                heading="No print stations"
                body="Add a print station to enable receipt printing at this branch."
              />
            )}

            {!isStationsLoading && stations.length > 0 && (
              <div className="space-y-2">
                {stations.map((station) => (
                  <div key={station.id} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
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
                    <div className="flex items-center gap-1">
                      <IconButton icon={<QrCode size={16} />} label="Re-pair printer" variant="ghost" size="sm" onClick={() => setStationPendingRepair(station)} />
                      <IconButton icon={<Trash2 size={16} />} label="Remove station" variant="ghost" size="sm" onClick={() => setStationPendingRemove(station)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Edit Branch Details modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Branch Details"
        maxWidth="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button className="flex-1" isLoading={isSaving} onClick={() => void handleSaveProfile()}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4 p-1">
          <p className="text-body-sm text-stone-500">These details appear on printed receipts and bills for this branch.</p>
          <Input label="Phone Number" value={editForm.phone ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="e.g. 0707 242 987" />
          <Input label="M-Pesa Paybill" value={editForm.mpesaPaybill ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, mpesaPaybill: e.target.value }))} placeholder="e.g. 522522" />
          <Input label="Account Number" value={editForm.accountNumber ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, accountNumber: e.target.value }))} placeholder="e.g. King'ong'o" />
          <Input label="Google Review Link" value={editForm.googleReviewUrl ?? ''} onChange={(e) => setEditForm((prev) => ({ ...prev, googleReviewUrl: e.target.value }))} placeholder="https://g.page/r/..." />
        </div>
      </Modal>

      {/* Add station modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Print Station"
        maxWidth="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" isLoading={isAdding} disabled={!newStationName.trim()} onClick={() => void handleAddStation()}>Create</Button>
          </div>
        }
      >
        <div className="space-y-4 p-1">
          <p className="text-body-sm text-stone-500">
            Give this printer a name (e.g. &quot;Counter Printer&quot;). A secret token will be generated — you&apos;ll enter it in the Wendo Printer app on the work phone.
          </p>
          <Input label="Printer name" value={newStationName} onChange={(e) => setNewStationName(e.target.value)} placeholder="e.g. Counter Printer" autoFocus />
        </div>
      </Modal>

      {/* Token reveal modal — shown once */}
      <Modal
        isOpen={tokenModal !== null}
        onClose={() => { setTokenModal(null); setIsCopied(false); }}
        title="Save This Token"
        maxWidth="sm"
        footer={
          <Button className="w-full" onClick={() => { setTokenModal(null); setIsCopied(false); }}>
            Done — I&apos;ve saved it
          </Button>
        }
      >
        <div className="space-y-4 p-1">
          <p className="text-body-sm text-stone-700">
            <strong>{tokenModal?.stationName}</strong> has been created. Scan the QR code with the Wendo Printer app, or copy the token manually.
          </p>
          {tokenModal && (
            <div className="flex justify-center rounded-xl border border-stone-200 bg-white p-4">
              <QRCodeSVG
                value={JSON.stringify({ url: env.apiUrl, token: tokenModal.token, name: tokenModal.stationName })}
                size={180}
                level="M"
              />
            </div>
          )}
          <div className="rounded-lg border border-amber/40 bg-[#FDF3DC] p-3">
            <p className="mb-2 text-label-sm text-[#92650A]">This token will NOT be shown again.</p>
            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
              <code className="flex-1 break-all text-caption text-stone-900">{tokenModal?.token}</code>
              <button
                type="button"
                onClick={() => tokenModal && void handleCopyToken(tokenModal.token)}
                className="shrink-0 rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                aria-label="Copy token"
              >
                {isCopied ? <Check size={16} className="text-[#1A6B3C]" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Re-pair confirm dialog */}
      <ConfirmDialog
        isOpen={stationPendingRepair !== null}
        onClose={() => setStationPendingRepair(null)}
        title="Re-pair Print Station"
        description={`This will generate a new token for "${stationPendingRepair?.name}" and invalidate the current one. The Wendo Printer app will need to be re-configured by scanning the new QR code.`}
        confirmLabel="Re-pair"
        isLoading={isRepairing}
        onConfirm={() => void handleRepairStation()}
      />

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

// ─── ProfileRow sub-component ─────────────────────────────────────────────────

interface ProfileRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  placeholder: string;
}

function ProfileRow({ icon, label, value, placeholder }: ProfileRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 text-stone-400">{icon}</span>
        <span className="text-body-sm text-stone-500">{label}</span>
      </div>
      <span className={value ? 'text-body-sm font-medium text-stone-900' : 'text-body-sm text-stone-400'}>
        {value ?? placeholder}
      </span>
    </div>
  );
}
