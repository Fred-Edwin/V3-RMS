/**
 * Inventory Milestone Six, Session 1 — stock position, ledger, waste.
 * Real backend implementation of the frozen contract (`../types/stock`,
 * `../types/waste`). Same token-reading convention as `prep-api-service.ts`.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { AttendantStockSummary, Ledger, LedgerQuery, ListStockQuery, StockList, StockSummary } from '../types/stock';
import type { CreateWasteInput, CreateWasteResult, WasteItemOptionList, WasteList } from '../../waste/department/types/waste';

function token(): string | undefined {
  return useAuthStore.getState().accessToken ?? undefined;
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function listStock(query: ListStockQuery = {}): Promise<StockList> {
  return apiClient.get<StockList>(`/inventory/stock${toQueryString(query)}`, token());
}

export async function getStockSummary(): Promise<StockSummary | AttendantStockSummary> {
  return apiClient.get<StockSummary | AttendantStockSummary>('/inventory/stock/summary', token());
}

export async function getStockLedger(itemId: string, query: LedgerQuery = {}): Promise<Ledger> {
  return apiClient.get<Ledger>(`/inventory/stock/items/${itemId}/ledger${toQueryString(query)}`, token());
}

export async function listWaste(days = 7): Promise<WasteList> {
  return apiClient.get<WasteList>(`/inventory/waste?days=${days}`, token());
}

export async function listWasteItemOptions(search?: string, limit = 20): Promise<WasteItemOptionList> {
  return apiClient.get<WasteItemOptionList>(`/inventory/waste/items${toQueryString({ search, limit })}`, token());
}

export async function createWaste(input: CreateWasteInput): Promise<CreateWasteResult> {
  return apiClient.post<CreateWasteResult>('/inventory/waste', input, token());
}
