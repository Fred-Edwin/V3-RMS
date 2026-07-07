'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Banknote, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ExcelTable,
  FormField,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  SkeletonTable,
  StatCard,
  TabBar,
  Toggle,
  type ExcelColumn,
  type SelectOption,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { otherIncomeService } from '@/services/otherIncomeService';
import { useAuthStore } from '@/store/authStore';
import { getTodayYmdInTimeZone } from '@/lib/date';
import { ApiError } from '@/types/api';
import type {
  OtherIncomeCategory,
  OtherIncomeEntry,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/types/otherIncome';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateDisplay = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CARD: 'Card',
  SPLIT: 'Split',
};

// ── Row types ─────────────────────────────────────────────────────────────────

type CategoryRow = Record<string, unknown> & OtherIncomeCategory;
type EntryRow = Record<string, unknown> & OtherIncomeEntry;

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'categories' | 'entries';

export default function DirectorOtherIncomePage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const todayYmd = getTodayYmdInTimeZone();

  const [activeTab, setActiveTab] = useState<Tab>('categories');

  // ── Branches ────────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<BranchDto[]>([]);
  // Separate org selectors per tab so switching tabs doesn't reset context
  const [catOrgId, setCatOrgId] = useState('');   // for categories tab
  const [entryOrgId, setEntryOrgId] = useState(''); // for entries tab

  // ── Categories state ──────────────────────────────────────────────────────
  const [categories, setCategories] = useState<OtherIncomeCategory[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  // branchId: null = all branches; string = specific branch id
  const [categoryForm, setCategoryForm] = useState<{ name: string; branchId: string | null }>({
    name: '',
    branchId: null,
  });
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState('');

  // ── Entries state ─────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<OtherIncomeEntry[]>([]);
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [entryStartDate, setEntryStartDate] = useState(todayYmd);
  const [entryEndDate, setEntryEndDate] = useState(todayYmd);
  const [entryCategoryFilter, setEntryCategoryFilter] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<EntryRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Load branches ────────────────────────────────────────────────────────
  const loadBranches = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    try {
      const data = await branchService.listBranches(accessToken);
      const active = data.filter((b) => b.isActive && !b.isHub);
      setBranches(active);
      // Auto-select first branch for both tabs on mount
      if (active.length > 0) {
        setCatOrgId((prev) => prev || active[0].id);
        setEntryOrgId((prev) => prev || active[0].id);
      }
    } catch {
      // non-critical
    }
  }, [accessToken]);

  // ── Load categories ──────────────────────────────────────────────────────
  const loadCategories = useCallback(async (): Promise<void> => {
    if (!accessToken || !catOrgId) return;
    setIsCategoriesLoading(true);
    try {
      const data = await otherIncomeService.listCategories(accessToken, catOrgId);
      setCategories(data as OtherIncomeCategory[]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load categories';
      toast({ variant: 'error', title: message });
    } finally {
      setIsCategoriesLoading(false);
    }
  }, [accessToken, catOrgId, toast]);

  // ── Load entries ──────────────────────────────────────────────────────────
  const loadEntries = useCallback(async (): Promise<void> => {
    if (!accessToken || !entryOrgId) return;
    setIsEntriesLoading(true);
    try {
      const { entries: data } = await otherIncomeService.listEntries(
        {
          organizationId: entryOrgId,
          startDate: entryStartDate,
          endDate: entryEndDate,
          categoryId: entryCategoryFilter || undefined,
          perPage: 100,
        },
        accessToken,
      );
      setEntries(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load entries';
      toast({ variant: 'error', title: message });
    } finally {
      setIsEntriesLoading(false);
    }
  }, [accessToken, entryOrgId, entryStartDate, entryEndDate, entryCategoryFilter, toast]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (catOrgId) void loadCategories();
  }, [catOrgId, loadCategories]);

  useEffect(() => {
    if (activeTab === 'entries' && entryOrgId) void loadEntries();
  }, [activeTab, loadEntries, entryOrgId]);

  // ── Category modal ────────────────────────────────────────────────────────
  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', branchId: null });
    setCategoryFormError('');
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (row: CategoryRow) => {
    setEditingCategory(row);
    setCategoryForm({ name: row.name, branchId: row.branchId });
    setCategoryFormError('');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!accessToken || !catOrgId) return;
    if (!categoryForm.name.trim()) {
      setCategoryFormError('Category name is required');
      return;
    }
    setCategoryFormError('');
    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        const updated = await otherIncomeService.updateCategory(
          editingCategory.id,
          { name: categoryForm.name.trim(), branchId: categoryForm.branchId } satisfies UpdateCategoryInput,
          accessToken,
          catOrgId,
        );
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast({ variant: 'success', title: 'Category updated' });
      } else {
        const created = await otherIncomeService.createCategory(
          { name: categoryForm.name.trim(), branchId: categoryForm.branchId } satisfies CreateCategoryInput,
          accessToken,
          catOrgId,
        );
        setCategories((prev) => [created, ...prev]);
        toast({ variant: 'success', title: 'Category created' });
      }
      setIsCategoryModalOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save category';
      setCategoryFormError(message);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (row: CategoryRow): Promise<void> => {
    if (!accessToken || !catOrgId) return;
    try {
      const updated = await otherIncomeService.updateCategory(
        row.id,
        { isActive: !row.isActive },
        accessToken,
        catOrgId,
      );
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast({
        variant: 'success',
        title: updated.isActive ? 'Category activated' : 'Category deactivated',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update category';
      toast({ variant: 'error', title: message });
    }
  };

  const handleDeleteEntry = async (): Promise<void> => {
    if (!accessToken || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await otherIncomeService.deleteEntry(deleteTarget.id, accessToken);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast({ variant: 'success', title: 'Entry deleted' });
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not delete entry';
      toast({ variant: 'error', title: message });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const entriesTotalValue = useMemo(
    () => entries.reduce((sum, e) => sum + Number.parseFloat(e.amount), 0),
    [entries],
  );

  const branchOptions: SelectOption[] = branches.map((b) => ({ value: b.id, label: b.name }));

  const categoryFilterOptions: SelectOption[] = [
    { value: '', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  // Options for the category scope select in the modal
  const scopeOptions: SelectOption[] = [
    { value: '', label: 'All branches' },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  // ── Category columns ──────────────────────────────────────────────────────
  const categoryColumns: ExcelColumn<CategoryRow>[] = [
    {
      key: 'name',
      label: 'Category Name',
      render: (row) => <span className="font-medium text-office-ink">{row.name}</span>,
    },
    {
      key: 'branch',
      label: 'Scope',
      render: (row) =>
        row.branch ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-pending-border bg-status-pending-bg px-2.5 py-0.5 text-label-sm font-medium text-status-pending-text">
            {row.branch.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-label-sm font-medium text-stone-600">
            All Branches
          </span>
        ),
    },
    {
      key: 'isActive',
      label: 'Active',
      align: 'center',
      render: (row) => (
        <Toggle
          checked={row.isActive}
          onChange={() => void handleToggleCategoryActive(row)}
          label=""
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'center',
      render: (row) => (
        <IconButton
          icon={<Pencil size={15} />}
          label="Edit category"
          onClick={() => openEditCategory(row)}
          variant="ghost"
          size="sm"
        />
      ),
    },
  ];

  // ── Entry columns ─────────────────────────────────────────────────────────
  const entryColumns: ExcelColumn<EntryRow>[] = [
    {
      key: 'category',
      label: 'Category',
      render: (row) => <span className="font-medium text-office-ink">{row.category.name}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      numeric: true,
      render: (row) => (
        <span className="font-semibold tabular-nums text-espresso">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      render: (row) => (
        <span className="text-stone-600">{PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod}</span>
      ),
    },
    {
      key: 'entryDate',
      label: 'Date',
      render: (row) => (
        <span className="text-stone-600">{formatDateDisplay(row.entryDate.slice(0, 10))}</span>
      ),
    },
    {
      key: 'recordedBy',
      label: 'Recorded By',
      render: (row) => <span className="text-stone-500">{row.recordedBy.name}</span>,
    },
    {
      key: 'description',
      label: 'Notes',
      render: (row) => <span className="italic text-stone-400">{row.description ?? '—'}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'center',
      render: (row) => (
        <button
          type="button"
          onClick={() => setDeleteTarget(row)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:shadow-focus"
          aria-label="Delete entry"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <PageLayout>
      <PageHeader
        title="Other Income"
        subtitle="Configure income categories and review all non-food revenue"
      />

      {/* Tab switcher */}
      <TabBar
        tabs={[
          { value: 'categories', label: 'Categories' },
          { value: 'entries', label: 'Entries' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        variant="segmented"
        className="mb-6"
      />

      {/* ── CATEGORIES TAB ── */}
      {activeTab === 'categories' && (
        <>
          {/* Action row: branch selector + new category button */}
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">
                  Branch
                </label>
                <div className="w-48">
                  <Select
                    options={branchOptions}
                    value={catOrgId}
                    onChange={(e) => setCatOrgId(e.target.value)}
                  />
                </div>
              </div>
              <p className="max-w-xs text-body-sm text-stone-500">
                Categories scoped to a branch are only visible to that branch&apos;s staff.
              </p>
            </div>
            <Button size="sm" onClick={openNewCategory} disabled={!catOrgId} className="shrink-0">
              <Plus size={16} className="mr-1.5" />
              New Category
            </Button>
          </div>

          {isCategoriesLoading ? (
            <SkeletonTable rows={4} columns={4} />
          ) : !catOrgId ? (
            <EmptyState
              icon={<Tags size={48} className="text-stone-300" />}
              heading="Select a branch"
              body="Choose a branch above to manage its income categories"
            />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<Tags size={48} className="text-stone-300" />}
              heading="No income categories yet"
              body="Add your first category to start tracking other income streams"
              action={
                <Button size="sm" onClick={openNewCategory}>
                  <Plus size={16} className="mr-1.5" />
                  New Category
                </Button>
              }
            />
          ) : (
            <ExcelTable
              columns={categoryColumns}
              rows={categories as CategoryRow[]}
              rowKey={(row) => row.id}
              headerTone="gray"
            />
          )}
        </>
      )}

      {/* ── ENTRIES TAB ── */}
      {activeTab === 'entries' && (
        <>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            {/* Branch selector for entries */}
            <div className="flex flex-col gap-1">
              <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">Branch</label>
              <div className="w-44">
                <Select
                  options={branchOptions}
                  value={entryOrgId}
                  onChange={(e) => setEntryOrgId(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">From</label>
              <Input type="date" value={entryStartDate} onChange={(e) => setEntryStartDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">To</label>
              <Input type="date" value={entryEndDate} onChange={(e) => setEntryEndDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">Category</label>
              <div className="w-44">
                <Select
                  options={categoryFilterOptions}
                  value={entryCategoryFilter}
                  onChange={(e) => setEntryCategoryFilter(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void loadEntries()} disabled={!entryOrgId}>
              Apply
            </Button>
          </div>

          {entries.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard
                label="Total Other Income"
                value={formatCurrency(entriesTotalValue.toFixed(2))}
                valueClassName="font-sans text-heading-lg font-bold tabular-nums tracking-tight text-espresso"
              />
              <StatCard
                label="Entries"
                value={String(entries.length)}
                valueClassName="font-sans text-heading-lg font-bold tabular-nums tracking-tight"
              />
            </div>
          )}

          {isEntriesLoading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : !entryOrgId ? (
            <EmptyState
              icon={<Banknote size={48} className="text-stone-300" />}
              heading="Select a branch"
              body="Choose a branch above to view its income entries"
            />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<Banknote size={48} className="text-stone-300" />}
              heading="No entries found"
              body="No other income has been recorded for the selected filters"
            />
          ) : (
            <ExcelTable
              columns={entryColumns}
              rows={entries as EntryRow[]}
              rowKey={(row) => row.id}
              headerTone="gray"
              totalsRow={{
                category: 'Total',
                amount: (
                  <span className="font-semibold tabular-nums text-espresso">
                    {formatCurrency(entriesTotalValue.toFixed(2))}
                  </span>
                ),
              }}
            />
          )}
        </>
      )}

      {/* ── Category modal ── */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'New Income Category'}
      >
        <form onSubmit={(e) => void handleSaveCategory(e)} noValidate className="space-y-4">
          <FormField label="Category Name" htmlFor="cat-name" errorMessage={categoryFormError} required>
            <Input
              id="cat-name"
              placeholder="e.g. Pool Table, Event Hire, Merchandise"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
              autoFocus
            />
          </FormField>

          <FormField
            label="Visible To"
            htmlFor="cat-scope"
            helperText="Limit this category to a specific branch, or make it available everywhere."
          >
            <Select
              id="cat-scope"
              options={scopeOptions}
              value={categoryForm.branchId ?? ''}
              onChange={(e) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  branchId: e.target.value === '' ? null : e.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSavingCategory}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete entry dialog ── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteEntry()}
        title="Delete income entry?"
        description={
          deleteTarget
            ? `This will permanently remove the ${formatCurrency(deleteTarget.amount)} entry for "${deleteTarget.category.name}".`
            : ''
        }
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </PageLayout>
  );
}
