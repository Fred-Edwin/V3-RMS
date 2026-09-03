'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, PageHeader, PageLayout, SkeletonBlock } from '@/components/ui';
import { AssignHeadDrawer } from '@/components/department/AssignHeadDrawer';
import { DepartmentCard } from '@/components/department/DepartmentCard';
import {
  departmentService,
  type DepartmentSummaryDto,
  type EligibleStaffDto,
} from '@/services/departmentService';
import type { DepartmentTag } from '@/types/auth';
import { ApiError } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';

/**
 * Screen 2 — the Branch Manager's Departments page (Paper: `Departments
 * (Branch Manager, Desktop)`). One card per department; Kitchen & Pastry are
 * shown as a single merged card because one head covers both for now.
 *
 * Marker model (2026-09-03): assigning a head does NOT change the person's
 * role — they keep their real job and gain the ability to schedule their
 * department's shifts. Removing a head just clears that marker. The copy here
 * reflects that; there is no "reverts to previous role".
 */

interface MergedCard {
  key: string;
  title: string;
  /** Which tag the assign/change/remove actions act on. */
  actionTag: DepartmentTag;
  /** The department summary whose head + members this card renders. */
  summary: DepartmentSummaryDto;
  eligibleNoun: string;
}

const eligibleNounFor = (title: string): string => {
  if (title === 'Kitchen & Pastry') return 'Kitchen & Pastry chefs';
  if (title === 'Service') return 'Service waiters';
  if (title === 'Barista') return 'Baristas';
  return 'Stewards & housekeeping';
};

export default function DepartmentsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = useAuthStore((state) => state.organizationId);
  const branchName = useAuthStore((state) => state.user?.organizationName) ?? 'Current branch';
  const { toast } = useToast();

  const [departments, setDepartments] = useState<DepartmentSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [drawerTag, setDrawerTag] = useState<DepartmentTag | null>(null);
  const [eligibleStaff, setEligibleStaff] = useState<EligibleStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewAllKey, setViewAllKey] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken || !organizationId) return;
    setIsLoading(true);
    try {
      const data = await departmentService.listDepartments(organizationId, accessToken);
      setDepartments(data);
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Load failed',
        message: err instanceof ApiError ? err.message : 'Failed to load departments.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, organizationId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const byTag = useMemo(() => {
    const map = new Map<DepartmentTag, DepartmentSummaryDto>();
    for (const dept of departments) map.set(dept.departmentTag, dept);
    return map;
  }, [departments]);

  // Kitchen & Pastry merge into one card. They share the CHEF role, so their
  // member lists are identical; the head is whichever of the two tags carries
  // one, defaulting to KITCHEN for new assignments.
  const cards = useMemo<MergedCard[]>(() => {
    const kitchen = byTag.get('KITCHEN');
    const pastry = byTag.get('PASTRY');
    const result: MergedCard[] = [];

    if (kitchen) {
      const headTag: DepartmentTag = kitchen.head ? 'KITCHEN' : pastry?.head ? 'PASTRY' : 'KITCHEN';
      const summary: DepartmentSummaryDto = {
        departmentTag: 'KITCHEN',
        head: kitchen.head ?? pastry?.head ?? null,
        members: kitchen.members ?? [],
      };
      result.push({
        key: 'kitchen-pastry',
        title: 'Kitchen & Pastry',
        actionTag: headTag,
        summary,
        eligibleNoun: 'Kitchen & Pastry chefs',
      });
    }

    for (const tag of ['SERVICE', 'BARISTA', 'HOUSEKEEPING'] as DepartmentTag[]) {
      const dept = byTag.get(tag);
      if (!dept) continue;
      const title = tag === 'SERVICE' ? 'Service' : tag === 'BARISTA' ? 'Barista' : 'Housekeeping';
      result.push({
        key: tag,
        title,
        actionTag: tag,
        summary: dept,
        eligibleNoun: eligibleNounFor(title),
      });
    }
    return result;
  }, [byTag]);

  const activeCard = cards.find((c) => c.actionTag === drawerTag) ?? null;
  const viewAllCard = cards.find((c) => c.key === viewAllKey) ?? null;

  const openDrawer = async (card: MergedCard): Promise<void> => {
    if (!accessToken || !organizationId) return;
    setDrawerTag(card.actionTag);
    setEligibleStaff([]);
    setIsLoadingStaff(true);
    try {
      setEligibleStaff(
        await departmentService.listEligibleStaff(organizationId, card.actionTag, accessToken),
      );
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Load failed',
        message: err instanceof ApiError ? err.message : 'Failed to load eligible staff.',
      });
      setDrawerTag(null);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleConfirm = async (userId: string): Promise<void> => {
    if (!accessToken || !organizationId || !activeCard) return;
    setIsSubmitting(true);
    try {
      await departmentService.assignHead(organizationId, activeCard.actionTag, userId, accessToken);
      toast({
        variant: 'success',
        title: 'Head set',
        message: `${activeCard.title} now has a department head.`,
      });
      setDrawerTag(null);
      await load();
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not set head',
        message: err instanceof ApiError ? err.message : 'Failed to set the department head.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!accessToken || !organizationId || !activeCard) return;
    setIsSubmitting(true);
    try {
      await departmentService.unassignHead(organizationId, activeCard.actionTag, accessToken);
      toast({
        variant: 'success',
        title: 'Head removed',
        message: `${activeCard.title} no longer has a head. The person keeps their role.`,
      });
      setDrawerTag(null);
      await load();
    } catch (err) {
      toast({
        variant: 'error',
        title: 'Could not remove head',
        message: err instanceof ApiError ? err.message : 'Failed to remove the department head.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Departments"
        subtitle={`${branchName} · ${cards.length} departments · who leads each one and who's in it`}
      />

      <p className="mb-6 max-w-[720px] text-body-sm text-stone-600">
        Each department needs a head. Heads keep their normal role and gain the ability to schedule
        their own department&rsquo;s shifts and receive its inventory. Removing a head just clears
        that &mdash; the person stays in their job.
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-[164px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {cards.map((card) => (
            <DepartmentCard
              key={card.key}
              title={card.title}
              department={card.summary}
              onAssign={() => void openDrawer(card)}
              onChange={() => void openDrawer(card)}
              onViewAll={() => setViewAllKey(card.key)}
            />
          ))}
        </div>
      )}

      <AssignHeadDrawer
        isOpen={activeCard !== null}
        onClose={() => setDrawerTag(null)}
        departmentLabel={activeCard?.title ?? ''}
        branchName={branchName}
        eligibleNoun={activeCard?.eligibleNoun ?? ''}
        currentHead={activeCard?.summary.head ?? null}
        eligibleStaff={eligibleStaff}
        isLoadingStaff={isLoadingStaff}
        isSubmitting={isSubmitting}
        onConfirm={(userId) => void handleConfirm(userId)}
        onRemove={() => void handleRemove()}
      />

      <Modal
        isOpen={viewAllCard !== null}
        onClose={() => setViewAllKey(null)}
        title={viewAllCard ? `${viewAllCard.title} — everyone in the department` : ''}
        maxWidth="sm"
      >
        <ul className="divide-y divide-stone-100">
          {viewAllCard?.summary.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5">
              <span className="text-body-sm text-stone-900">{m.name}</span>
              <span className="text-caption text-stone-500">
                {viewAllCard.summary.head?.id === m.id ? 'Head' : ''}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </PageLayout>
  );
}
