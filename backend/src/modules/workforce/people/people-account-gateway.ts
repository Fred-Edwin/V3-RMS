import type { DepartmentTag, Prisma } from '@prisma/client';
import { authRepository } from '../../../repositories/auth-repository';
import * as hrRepository from '../../../repositories/hr-repository';
import { staffRepository } from '../../../repositories/staff-repository';
import { staffTransferRepository } from '../../../repositories/staff-transfer-repository';
import { assignContract } from '../../../services/hr-service';
import { staffService } from '../../../services/staff-service';
import { NotFoundError } from '../../../utils/errors';
import { headsRepository } from './organisation/heads/heads-repository';
import type { HireLoginRole } from './people.constants';

export interface NewLogin {
  name: string;
  email: string;
  phone: string | null;
  role: HireLoginRole;
  siteId: string;
  temporaryPassword: string;
}
export interface LoginCreated {
  userId: string;
  legacyProfileId: string | null;
}

/**
 * The ONLY file in Workforce that imports legacy Access code (staff-service, staff-repository, auth-repository,
 * staff-transfer-repository) and the legacy HR contract bridge. Contract section 6.3 lists what the Access owner agreed.
 *
 * Account creation (6.3 item 2): `staffService.createStaff` refuses the HR Manager, so the gateway calls it as a system
 * actor AFTER Workforce has checked the `employee.lifecycle` capability and the floor-role list. This is the contract's
 * fallback, used because Access has not changed `createStaff`.
 */
export interface AccountGateway {
  /** Creates the account through the legacy staff service. Never logs or stores the password. */
  createLogin(input: NewLogin, actorId: string): Promise<LoginCreated>;
  /** Deactivate (and revoke every refresh token) or reactivate. */
  setActive(userId: string, active: boolean): Promise<void>;
  /** Moves the login to another site through the legacy transfer code (writes StaffTransfer and User.siteId). */
  moveToSite(userId: string, toSiteId: string, authorizedById: string, notes: string): Promise<void>;
  /** The legacy HR profile id of a login, when it has one (adopting an account keeps the link). */
  findLegacyProfileId(userId: string): Promise<string | null>;
  /** Legacy leave bridge: while slice 5 is unbuilt, recording a contract still seeds leave balances. */
  assignLegacyContract(userId: string, contractTypeId: string | null, actorId: string): Promise<void>;
  /**
   * The only writer of User.isDepartmentHead and User.departmentTag (5.4), inside the caller's transaction. While the
   * person is a head, the legacy `departmentId` mirror follows the tag, as the old assign code did (undefined = leave it).
   */
  setHeadClaims(
    tx: Prisma.TransactionClient,
    userId: string,
    claims: { isDepartmentHead: boolean; departmentTag: DepartmentTag | null; departmentId?: string | null },
  ): Promise<void>;
}

/** The actor legacy services see: a system admin acting for a person whose capability Workforce already checked. */
const systemActor = (actorId: string) => ({ id: actorId, role: 'SYSTEM_ADMIN' as const, siteId: null });

export const accountGateway: AccountGateway = {
  async createLogin(input, actorId) {
    const created = await staffService.createStaff(
      {
        name: input.name,
        email: input.email,
        phone: input.phone ?? undefined,
        role: input.role,
        temporaryPassword: input.temporaryPassword,
        siteId: input.siteId,
      },
      systemActor(actorId),
    );
    const profile = await hrRepository.findProfileByUserId(created.id);
    return { userId: created.id, legacyProfileId: profile?.id ?? null };
  },

  async setActive(userId, active) {
    const result = await staffRepository.setActive(userId, active);
    if (result.count === 0) throw new NotFoundError('Login not found');
    // Today deactivateStaff does not drop refresh tokens; an exit must stop the login (6.3 item 4).
    if (!active) await authRepository.deleteAllRefreshTokensByUserId(userId);
  },

  async moveToSite(userId, toSiteId, authorizedById, notes) {
    const staff = await staffRepository.findById(userId);
    if (!staff) throw new NotFoundError('Login not found');
    if (staff.siteId === toSiteId) return;
    await staffTransferRepository.create({ userId, fromSiteId: staff.siteId, toSiteId, authorizedById, notes });
  },

  async findLegacyProfileId(userId) {
    const profile = await hrRepository.findProfileByUserId(userId);
    return profile?.id ?? null;
  },

  async assignLegacyContract(userId, contractTypeId, actorId) {
    const profile = await hrRepository.findProfileByUserId(userId);
    if (!profile) return; // no legacy profile (a casual, or an account made outside Staff): nothing to seed
    await assignContract({ id: actorId, role: 'HR_MANAGER', siteId: null }, userId, contractTypeId);
  },

  async setHeadClaims(tx, userId, claims) {
    await headsRepository.writeClaims(tx, userId, claims);
  },
};
