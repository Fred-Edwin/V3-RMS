import { LoadingState } from '@/components/app/shell/shell-states';

/**
 * Route-level fallback for Catalog/Suppliers while their data loads —
 * replaces Next's default bare spinner. Only the content area shows this;
 * the sidebar in `(shell)/layout.tsx` is a separate layout boundary and
 * stays mounted, unaffected by this Suspense fallback.
 */
export default function InventoryShellLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <LoadingState />
    </div>
  );
}
