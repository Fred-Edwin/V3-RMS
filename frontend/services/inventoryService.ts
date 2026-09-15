import { apiClient } from '@/lib/apiClient';
import type { InventoryLocation } from '@/types/inventory';

// ─── Locations ─────────────────────────────────────────────────────────────
// The only inventory surface this legacy service still owns. Every other
// export here (items, suppliers with catalog fields, purchase orders, prep,
// stock counts, waste, supplier invoices/AP, reports) called routes that
// Inventory Milestone One's backend session deleted — see
// docs/features/inventory/05-plan.md §1.4. Removed 2026-09-15 as dead code
// that was still importing types/inventory.ts's legacy shape and blocking
// its cleanup; none of it had a real caller (verified: grepped every export
// for callers outside this file before removing — the only live caller
// anywhere was `createCentralStoreLocation`, from app/app/admin/page.tsx).
// The new Milestone One screens call features/inventory/services/ instead.
//
// This block survives because /locations and /locations/central-store are
// served by location-routes.ts, which Milestone One's plan (§1.3, §1.4)
// explicitly kept — Location is unchanged by this milestone.

export async function listLocations(token: string): Promise<InventoryLocation[]> {
  return apiClient.get<InventoryLocation[]>('/locations', token);
}

export async function getCentralStoreLocation(token: string): Promise<InventoryLocation | null> {
  const locations = await listLocations(token);
  return locations.find((l) => l.type === 'CENTRAL_STORE') ?? null;
}

// One-time setup, SYSTEM_ADMIN only. The backend resolves the owning
// organization to the hub org itself — no organization is sent from here.
export async function createCentralStoreLocation(
  token: string,
  name?: string,
): Promise<InventoryLocation> {
  return apiClient.post<InventoryLocation>('/locations/central-store', name ? { name } : {}, token);
}
