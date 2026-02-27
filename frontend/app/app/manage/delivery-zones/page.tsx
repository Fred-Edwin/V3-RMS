'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bike, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  PriceDisplay,
  SkeletonTable,
  Table,
  Toggle,
  type TableColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import {
  deliveryZoneService,
  type CreateDeliveryZoneInput,
  type DeliveryZone,
  type UpdateDeliveryZoneInput,
} from '@/services/deliveryZoneService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

interface ZoneFormState {
  name: string;
  fee: string;
  isActive: boolean;
}

type ZoneRow = Record<string, unknown> & {
  id: string;
  name: string;
  fee: string;
  isActive: boolean;
};

const defaultFormState: ZoneFormState = {
  name: '',
  fee: '',
  isActive: true,
};

export default function DeliveryZonesPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zonePendingDelete, setZonePendingDelete] = useState<ZoneRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<ZoneFormState>(defaultFormState);

  const loadZones = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await deliveryZoneService.listZones(accessToken);
      setZones(response);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load delivery zones.';
      toast({
        variant: 'error',
        title: 'Load failed',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  const tableData = useMemo<ZoneRow[]>(
    () =>
      zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        fee: zone.fee,
        isActive: zone.isActive,
      })),
    [zones],
  );

  const openCreateModal = () => {
    setEditingZone(null);
    setForm(defaultFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (zone: ZoneRow) => {
    setEditingZone(zone);
    setForm({
      name: zone.name,
      fee: zone.fee,
      isActive: zone.isActive,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }
    setIsModalOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    const normalizedName = form.name.trim();
    const normalizedFee = form.fee.trim();
    if (!normalizedName || !normalizedFee) {
      toast({
        variant: 'warning',
        title: 'Name and fee are required',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingZone) {
        const payload: UpdateDeliveryZoneInput = {
          name: normalizedName,
          fee: normalizedFee,
          isActive: form.isActive,
        };
        const updated = await deliveryZoneService.updateZone(editingZone.id, payload, accessToken);
        setZones((current) => current.map((zone) => (zone.id === updated.id ? updated : zone)));
        toast({
          variant: 'success',
          title: 'Delivery zone updated',
        });
      } else {
        const payload: CreateDeliveryZoneInput = {
          name: normalizedName,
          fee: normalizedFee,
        };
        const created = await deliveryZoneService.createZone(payload, accessToken);
        setZones((current) => [created, ...current]);
        toast({
          variant: 'success',
          title: 'Delivery zone created',
        });
      }

      setIsModalOpen(false);
      setEditingZone(null);
      setForm(defaultFormState);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to save delivery zone.';
      toast({
        variant: 'error',
        title: 'Save failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!accessToken || !zonePendingDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await deliveryZoneService.deleteZone(zonePendingDelete.id, accessToken);
      setZones((current) => current.filter((zone) => zone.id !== zonePendingDelete.id));
      toast({
        variant: 'success',
        title: 'Delivery zone deactivated',
      });
      setZonePendingDelete(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to deactivate delivery zone.';
      toast({
        variant: 'error',
        title: 'Deactivate failed',
        message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<ZoneRow>[] = [
    {
      key: 'name',
      label: 'Zone Name',
    },
    {
      key: 'fee',
      label: 'Fee (KES)',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => (
        <span
          className={
            value
              ? 'inline-flex rounded-full border border-[#86EFAC] bg-[#EDFAF1] px-2 py-0.5 text-label-sm text-[#1A6B3C]'
              : 'inline-flex rounded-full border border-[#D4D4D8] bg-[#F4F4F5] px-2 py-0.5 text-label-sm text-[#71717A]'
          }
        >
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[130px]',
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <IconButton
            icon={<Pencil size={16} />}
            label={`Edit ${row.name}`}
            size="sm"
            onClick={() => openEditModal(row)}
          />
          <IconButton
            icon={<Trash2 size={16} />}
            label={`Deactivate ${row.name}`}
            size="sm"
            variant="destructive"
            onClick={() => setZonePendingDelete(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Delivery Zones"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Manage delivery coverage and fee bands."
        action={<Button onClick={openCreateModal}>Add Zone</Button>}
      />

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        {isLoading ? (
          <SkeletonTable columns={4} rows={5} />
        ) : tableData.length === 0 ? (
          <EmptyState
            icon={<Bike size={24} />}
            heading="No delivery zones yet"
            body="Add your first zone to enable delivery orders for this branch."
            action={<Button onClick={openCreateModal}>Add Zone</Button>}
          />
        ) : (
          <Table columns={columns} data={tableData} keyField="id" />
        )}
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingZone ? 'Edit Delivery Zone' : 'Create Delivery Zone'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="delivery-zone-form" isLoading={isSubmitting}>
              {editingZone ? 'Save Changes' : 'Create Zone'}
            </Button>
          </div>
        }
      >
        <form id="delivery-zone-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            label="Zone Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Kiganjo"
            disabled={isSubmitting}
          />
          <Input
            label="Delivery Fee (KES)"
            type="number"
            min="0"
            step="0.01"
            value={form.fee}
            onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))}
            placeholder="e.g. 200.00"
            disabled={isSubmitting}
          />
          {editingZone && (
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
              <Toggle
                checked={form.isActive}
                onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                label={form.isActive ? 'Zone is active — accepting delivery orders' : 'Zone is inactive — hidden from orders'}
                disabled={isSubmitting}
              />
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(zonePendingDelete)}
        onClose={() => {
          if (!isDeleting) {
            setZonePendingDelete(null);
          }
        }}
        onConfirm={() => void handleConfirmDelete()}
        title="Deactivate delivery zone?"
        description={
          zonePendingDelete
            ? `This will disable "${zonePendingDelete.name}" for new delivery orders.`
            : 'This will disable the selected zone for new delivery orders.'
        }
        confirmLabel="Deactivate"
        isLoading={isDeleting}
      />
    </PageLayout>
  );
}
