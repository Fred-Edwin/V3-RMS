/**
 * TEMPORARY ADAPTER (Prep rebuild, Slice 2). The old History page and the old run-detail drawer still read the pre-rebuild shapes
 * (`../types/prep`). Their back-end routes are gone: `GET /inventory/prep/runs` and `/runs/:id` now answer in the new contract
 * shapes (`../_shared/types/prep-contract`), and `GET /summary` and `/items/:id/typical-yield` no longer exist.
 *
 * This file calls the new endpoints and maps the answers back to the old shapes so no page on the branch breaks. It is deleted
 * with `prep-history-screen.tsx` (Slice 4) and `prep-run-detail-screen.tsx` (Slice 3), which move to `RunSummary` / `RunDetail`.
 *
 * Known approximations, all temporary:
 *  - the yield-flag filter has no server counterpart, so it is applied to the page that came back;
 *  - the summary is worked out from up to 100 runs in the range (the real `GET /runs/summary` arrives in Slice 4);
 *  - a role without `prep.see_costs` (the Attendant) gets `costsHidden: true` and "0" in the cost fields, which the old screens do not draw.
 */
import { prepApi } from '../_shared/services/prep-api';
import type { RunDetail, RunSummary } from '../_shared/types/prep-contract';
import type { ListPrepRunsQuery, PrepRunDetail, PrepRunSummary, PrepSummary, PrepSummaryQuery, YieldVarianceLabel } from '../types/prep';

const dateOnly = (iso: string | undefined): string | undefined => (iso ? iso.slice(0, 10) : undefined);

const labelOf = (run: RunSummary): YieldVarianceLabel | null => {
  switch (run.vsUsual.label) {
    case 'ON_TARGET':
      return 'normal';
    case 'LOW':
      return 'low yield';
    case 'HIGH':
      return 'high yield';
    default:
      return null;
  }
};

const toOldSummary = (run: RunSummary): PrepRunSummary => ({
  id: run.id,
  when: run.at,
  outputItemId: run.outputItemId,
  outputName: run.outputName,
  inputsPreview: { firstItemLabel: run.inputsPreview.firstLabel, remainingCount: run.inputsPreview.moreCount },
  actualYield: run.made,
  yieldUnit: run.unit,
  yieldVarianceLabel: labelOf(run),
  yieldVarianceDelta: run.vsUsual.deltaAmount,
  outputUnitCost: run.outputUnitCost ?? '0',
  createdByInitials: run.by.initials,
});

const toOldDetail = (run: RunDetail): PrepRunDetail => ({
  ...toOldSummary(run),
  costsHidden: run.outputUnitCost === undefined,
  createdByName: run.by.name,
  createdAt: run.at,
  inputLines: run.inputs.map((l) => ({
    itemName: l.itemName,
    quantity: l.quantity,
    unit: l.unit,
    unitCostAtRunTime: l.unitCost ?? '0',
    lineCost: l.lineCost ?? '0',
  })),
  totalInputCost: run.totalInputCost ?? '0',
  typicalYieldAtRunTime: run.expected.amount,
});

export async function listPrepRuns(query: ListPrepRunsQuery = {}): Promise<PrepRunSummary[]> {
  const result = await prepApi.listRuns({
    search: query.search,
    outputItemId: query.outputItemId,
    from: dateOnly(query.dateFrom),
    to: dateOnly(query.dateTo),
    page: query.page,
    perPage: query.limit,
  });
  const rows = result.items.map(toOldSummary);
  if (!query.yieldFlag) return rows;
  const wanted: YieldVarianceLabel = query.yieldFlag === 'normal' ? 'normal' : query.yieldFlag === 'low' ? 'low yield' : 'high yield';
  return rows.filter((r) => r.yieldVarianceLabel === wanted);
}

export async function getPrepRun(id: string): Promise<PrepRunDetail> {
  return toOldDetail(await prepApi.getRun(id));
}

export async function getPrepSummary(query: PrepSummaryQuery = {}): Promise<PrepSummary> {
  const result = await prepApi.listRuns({ from: dateOnly(query.dateFrom), to: dateOnly(query.dateTo), perPage: 100 });
  const rows = result.items.map(toOldSummary);
  // A run's input cost is its unit cost times what it made, so the total needs no extra field.
  const totalInputCost = result.items.reduce((sum, r) => sum + (r.outputUnitCost !== undefined ? Number(r.outputUnitCost) * Number(r.made) : 0), 0);
  return {
    runsInRange: result.total,
    totalInputCost: totalInputCost.toFixed(2),
    yieldFlagCount: rows.filter((r) => r.yieldVarianceLabel !== null && r.yieldVarianceLabel !== 'normal').length,
  };
}
