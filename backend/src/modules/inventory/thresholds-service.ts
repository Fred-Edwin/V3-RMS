import type { Request } from 'express';
import { thresholdsRepository, type ThresholdsRow } from './thresholds-repository';
import { COUNTING_THRESHOLD_DEFAULTS } from './counting-thresholds';
import { requireHubOrgId } from './stock-scope';
import { ForbiddenError, ValidationError } from '../../utils/errors';
import type { Thresholds, UpdateDirectorThresholdInput, UpdateStoreThresholdsInput } from './thresholds.types';

type Actor = NonNullable<Request['user']>;

/** The two numbers a count is judged against — always read from the hub row (or defaults). */
export const getHubThresholdsInForce = async (
  hubOrgId: string,
): Promise<{ reasonRequiredKes: number; directorAlertKes: number }> => {
  const row = await thresholdsRepository.findByOrganization(hubOrgId);
  return {
    reasonRequiredKes: row?.reasonRequiredKes ?? COUNTING_THRESHOLD_DEFAULTS.hubReasonRequiredKes,
    directorAlertKes: row?.directorAlertKes ?? COUNTING_THRESHOLD_DEFAULTS.directorAlertKes,
  };
};

const serialize = (
  row: ThresholdsRow | null,
  defaults: { reasonRequiredKes: number; overnightAlertKes: number | null },
  directorAlertKes: number,
): Thresholds => ({
  reasonRequiredKes: row?.reasonRequiredKes ?? defaults.reasonRequiredKes,
  overnightAlertKes: row ? row.overnightAlertKes : defaults.overnightAlertKes,
  directorAlertKes,
  isDefault: row === null,
  updatedBy: row?.updatedBy ?? null,
  updatedAt: row?.updatedById ? row.updatedAt.toISOString() : null,
  directorUpdatedBy: null,
  directorUpdatedAt: null,
});

export const thresholdsService = {
  /** Store Manager → the hub row; Manager → their branch's row (Session 3 writes it). */
  get: async (actor: Actor): Promise<Thresholds> => {
    const hubOrgId = await requireHubOrgId();
    const hubRow = await thresholdsRepository.findByOrganization(hubOrgId);
    const directorAlertKes = hubRow?.directorAlertKes ?? COUNTING_THRESHOLD_DEFAULTS.directorAlertKes;
    const withDirector = (t: Thresholds): Thresholds => ({
      ...t,
      directorUpdatedBy: hubRow?.directorUpdatedBy ?? null,
      directorUpdatedAt: hubRow?.directorUpdatedAt?.toISOString() ?? null,
    });

    if (actor.role === 'STORE_MANAGER') {
      if (actor.organizationId !== hubOrgId) throw new ForbiddenError('Only the hub organization has Central Store thresholds');
      return withDirector(
        serialize(hubRow, { reasonRequiredKes: COUNTING_THRESHOLD_DEFAULTS.hubReasonRequiredKes, overnightAlertKes: null }, directorAlertKes),
      );
    }
    if (actor.role === 'MANAGER') {
      if (!actor.organizationId) throw new ValidationError('Branch context missing for this user');
      const row = await thresholdsRepository.findByOrganization(actor.organizationId);
      return withDirector(
        serialize(
          row,
          {
            reasonRequiredKes: COUNTING_THRESHOLD_DEFAULTS.branchReasonRequiredKes,
            overnightAlertKes: COUNTING_THRESHOLD_DEFAULTS.branchOvernightAlertKes,
          },
          directorAlertKes,
        ),
      );
    }
    throw new ForbiddenError('You may not view counting thresholds');
  },

  /** Store Manager: the Central Store reason threshold. Branch fields are structurally rejected by the schema. */
  updateStore: async (actor: Actor, input: UpdateStoreThresholdsInput): Promise<Thresholds> => {
    const hubOrgId = await requireHubOrgId();
    if (actor.role !== 'STORE_MANAGER' || actor.organizationId !== hubOrgId) {
      throw new ForbiddenError('Only the Store Manager sets the Central Store threshold');
    }
    const current = await getHubThresholdsInForce(hubOrgId);
    const row = await thresholdsRepository.upsertStoreReason(hubOrgId, {
      reasonRequiredKes: input.reasonRequiredKes,
      directorAlertKes: current.directorAlertKes,
      updatedById: actor.id,
    });
    return {
      ...serialize(row, { reasonRequiredKes: 0, overnightAlertKes: null }, row.directorAlertKes ?? current.directorAlertKes),
      directorUpdatedBy: row.directorUpdatedBy,
      directorUpdatedAt: row.directorUpdatedAt?.toISOString() ?? null,
    };
  },

  /** Director: the company-wide alert amount on the hub row. */
  updateDirector: async (actor: Actor, input: UpdateDirectorThresholdInput): Promise<Thresholds> => {
    if (actor.role !== 'DIRECTOR') throw new ForbiddenError('Only a Director sets the alert amount');
    const hubOrgId = await requireHubOrgId();
    const current = await getHubThresholdsInForce(hubOrgId);
    const row = await thresholdsRepository.upsertDirectorAlert(hubOrgId, {
      directorAlertKes: input.directorAlertKes,
      reasonRequiredKes: current.reasonRequiredKes,
      updatedById: actor.id,
    });
    return {
      ...serialize(row, { reasonRequiredKes: 0, overnightAlertKes: null }, row.directorAlertKes ?? input.directorAlertKes),
      directorUpdatedBy: row.directorUpdatedBy,
      directorUpdatedAt: row.directorUpdatedAt?.toISOString() ?? null,
    };
  },
};
