'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui2/skeleton';
import type { Category, InventoryItemListRow } from '../../types';
import { useCategoryOptions, useItemDetail, useRetireRestoreItem, useSaveItem, useSimilarItem, useSupplierOptions } from '../../hooks/use-item-form';
import { editReviewBullets, retireReviewBullets } from '../../lib/item-review';
import type { ItemEditPlan } from '../../lib/item-form-model';
import { StockErrorCard } from '../stock/stock-states';
import { AddSellerView } from './add-seller-view';
import { CategoryView } from './category-view';
import { DrawerFrame, DrawerHost, SecondaryFooterButton } from './drawer-parts';
import { ItemDetailView } from './item-detail-view';
import { ItemFormView, type CreatedItem } from './item-form-view';
import { ItemReviewView } from './item-review-view';

/** What the screen asks the drawers to open. `key` changes on every request so asking for the same thing twice reopens it. */
export type DrawerRequest =
  | { kind: 'add'; key: number }
  | { kind: 'item'; itemId: string; key: number }
  | { kind: 'addSeller'; itemId: string; key: number }
  | { kind: 'categories'; key: number };

type View =
  | { kind: 'add' }
  | { kind: 'item'; itemId: string }
  | { kind: 'edit'; itemId: string }
  | { kind: 'review'; itemId: string; plan: ItemEditPlan }
  | { kind: 'retire'; itemId: string }
  | { kind: 'addSeller'; itemId: string }
  | { kind: 'categories' };

const viewFromRequest = (request: DrawerRequest): View => {
  switch (request.kind) {
    case 'add':
      return { kind: 'add' };
    case 'item':
      return { kind: 'item', itemId: request.itemId };
    case 'addSeller':
      return { kind: 'addSeller', itemId: request.itemId };
    case 'categories':
      return { kind: 'categories' };
  }
};

const viewItemId = (view: View): string | null => ('itemId' in view ? view.itemId : null);

export interface ItemDrawersProps {
  request: DrawerRequest | null;
  onClose: () => void;
  /** A new item was created: the catalog reloads, highlights it and offers "Add who sells it". */
  onItemCreated: (created: CreatedItem) => void;
  /** Anything about an item changed (edit, retire, restore, supplier added): reload the list behind. */
  onItemChanged: () => void;
  onCategoriesChanged: () => void;
  /** Live items in all, for the "no category yet" note. */
  totalItems: number | null;
  onOpenRestockLevels: () => void;
}

function LoadingFrame({ title }: { title: string }) {
  return (
    <DrawerFrame title={title} footer={<span />}>
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        <span className="sr-only">Loading</span>
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="h-24 w-full" />
      </div>
    </DrawerFrame>
  );
}

/**
 * The catalog's drawer sequence in one Radix dialog, so item page → edit →
 * review → back swaps content without the panel closing and reopening.
 * Add item · Item page · Add who sells it · Edit item · Review the change ·
 * Manage categories.
 */
export function ItemDrawers({ request, onClose, onItemCreated, onItemChanged, onCategoriesChanged, totalItems, onOpenRestockLevels }: ItemDrawersProps) {
  const [view, setView] = React.useState<View>({ kind: 'categories' });
  const open = request !== null;
  const requestKey = request?.key;

  // A new request resets the sequence to where it asked to start.
  React.useEffect(() => {
    if (request) setView(viewFromRequest(request));
    // Keyed on `key` only: the request object is rebuilt by the parent each render it re-asks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const itemId = viewItemId(view);
  const detail = useItemDetail(open ? itemId : null);
  const { categories } = useCategoryOptions(open && (view.kind === 'add' || view.kind === 'edit'));
  const suppliers = useSupplierOptions(open && view.kind === 'addSeller');
  const [typedName, setTypedName] = React.useState('');
  const similar = useSimilarItem(typedName, null, open && view.kind === 'add');
  const itemMutations = useRetireRestoreItem();
  const reviewSave = useSaveItem();

  React.useEffect(() => {
    if (!open) setTypedName('');
  }, [open]);

  const close = React.useCallback(() => onClose(), [onClose]);
  const goItem = (id: string) => setView({ kind: 'item', itemId: id });

  const reloadAndShowItem = async (id: string) => {
    onItemChanged();
    await detail.reload();
    goItem(id);
  };

  const needsItem = view.kind === 'item' || view.kind === 'edit' || view.kind === 'review' || view.kind === 'retire' || view.kind === 'addSeller';
  const item = detail.item;

  let content: React.ReactNode;
  if (view.kind === 'add') {
    content = (
      <ItemFormView
        key="add"
        item={null}
        categories={categories as Category[]}
        similar={similar as InventoryItemListRow | null}
        onNameChange={setTypedName}
        onCancel={close}
        onCreated={(created) => {
          onItemCreated(created);
          close();
        }}
        onSaved={() => undefined}
        onReview={() => undefined}
        onRetire={() => undefined}
        onRestore={() => undefined}
        restoreBusy={false}
        restoreError={null}
        onOpenSimilar={(id) => goItem(id)}
      />
    );
  } else if (view.kind === 'categories') {
    content = <CategoryView totalItems={totalItems} onDone={close} onChanged={onCategoriesChanged} />;
  } else if (needsItem && detail.status === 'error') {
    content = (
      <DrawerFrame title="Item" footer={<SecondaryFooterButton onClick={close}>Close</SecondaryFooterButton>}>
        <StockErrorCard title="Couldn’t load this item" description={detail.error ?? 'Check your connection and try again.'} onRetry={() => void detail.reload()} />
      </DrawerFrame>
    );
  } else if (needsItem && (!item || item.id !== itemId || detail.status === 'loading' || !detail.review)) {
    content = <LoadingFrame title="Item" />;
  } else if (item && detail.review && view.kind === 'item') {
    content = (
      <ItemDetailView
        item={item}
        history={detail.history}
        onEdit={() => setView({ kind: 'edit', itemId: item.id })}
        onAddSeller={() => setView({ kind: 'addSeller', itemId: item.id })}
        onRetire={() => {
          itemMutations.clearError();
          setView({ kind: 'retire', itemId: item.id });
        }}
        onRestore={async () => {
          if (await itemMutations.restore(item.id)) await reloadAndShowItem(item.id);
        }}
        restoreBusy={itemMutations.busy}
        actionError={itemMutations.error}
        onOpenRestockLevels={onOpenRestockLevels}
      />
    );
  } else if (item && detail.review && view.kind === 'edit') {
    content = (
      <ItemFormView
        key={`edit-${item.id}`}
        item={item}
        categories={categories}
        similar={null}
        onNameChange={() => undefined}
        onCancel={() => goItem(item.id)}
        onCreated={() => undefined}
        onSaved={() => void reloadAndShowItem(item.id)}
        onReview={(plan) => {
          reviewSave.clearError();
          setView({ kind: 'review', itemId: item.id, plan });
        }}
        onRetire={() => {
          itemMutations.clearError();
          setView({ kind: 'retire', itemId: item.id });
        }}
        onRestore={async () => {
          if (await itemMutations.restore(item.id)) await reloadAndShowItem(item.id);
        }}
        restoreBusy={itemMutations.busy}
        restoreError={itemMutations.error}
        onOpenSimilar={() => undefined}
      />
    );
  } else if (item && detail.review && view.kind === 'review') {
    const plan = view.plan;
    content = (
      <ItemReviewView
        itemName={item.name}
        action="Edit item"
        rows={plan.risky}
        bullets={editReviewBullets(plan, detail.review)}
        review={detail.review}
        confirmLabel="Confirm change"
        confirming={reviewSave.saving}
        error={reviewSave.error}
        onBack={() => setView({ kind: 'edit', itemId: item.id })}
        onConfirm={async () => {
          const result = await reviewSave.save(plan.input, item.id);
          if (result) await reloadAndShowItem(item.id);
        }}
      />
    );
  } else if (item && detail.review && view.kind === 'retire') {
    content = (
      <ItemReviewView
        itemName={item.name}
        action="Retire item"
        rows={[{ what: 'Status', now: 'Live', after: 'Retired' }]}
        bullets={retireReviewBullets(detail.review)}
        review={detail.review}
        confirmLabel="Retire item"
        confirming={itemMutations.busy}
        error={itemMutations.error}
        onBack={() => goItem(item.id)}
        onConfirm={async () => {
          if (await itemMutations.retire(item.id)) await reloadAndShowItem(item.id);
        }}
      />
    );
  } else if (item && detail.review && view.kind === 'addSeller') {
    content = (
      <AddSellerView
        key={`seller-${item.id}`}
        item={item}
        suppliers={suppliers.suppliers}
        suppliersLoading={suppliers.status === 'loading'}
        suppliersError={suppliers.error}
        onRetrySuppliers={() => void suppliers.reload()}
        onCancel={() => goItem(item.id)}
        onAdded={() => void reloadAndShowItem(item.id)}
      />
    );
  } else {
    content = <LoadingFrame title="Item" />;
  }

  return (
    <DrawerHost open={open} onOpenChange={(next) => (next ? undefined : close())} label="Catalog">
      {content}
    </DrawerHost>
  );
}
