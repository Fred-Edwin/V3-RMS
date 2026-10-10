'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Footer, B2Header, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import { useCountView } from '../hooks/use-phone-day';
import { useSign } from '../hooks/use-sign';
import { groupSections } from '../lib/count-logic';
import { dayLine, plural, signedByText } from '../lib/phone-format';
import { DAY_COUNT, DAY_COUNT_FIGURES, DAY_SENT } from '../lib/phone-routes';
import { branchDayPhoneApi } from '../services/branch-day-phone-api';
import { BodyState, CardChip, ReceiptCard, ReceiptSection, RowsSkeleton, SignFields } from './phone-parts';

/** Paper B3b: check and sign. A receipt of what was counted (no figures, nothing to count against), then the PIN. */
export function CountCheckScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useCountView();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const isHead = useAuthStore((s) => s.isDepartmentHead);
  const copy = BRANCH_DAY_STATES_COPY.count;
  const sign = useSign(
    (pin, idempotencyKey) => branchDayPhoneApi.signCount({ pin, idempotencyKey }),
    () => router.push(DAY_SENT),
    (code) => {
      if (code === 'ALREADY_COUNTED') {
        router.replace(DAY_SENT);
        return true;
      }
      return false;
    },
  );

  // Something is still blank (a second device cleared it): back to the count, which shows what is missing.
  React.useEffect(() => {
    if (data && data.state === 'NOT_COUNTED' && data.summary.blankCount > 0) router.replace(DAY_COUNT);
    if (data?.state === 'COUNTED') router.replace(DAY_SENT);
  }, [data, router]);

  const sections = data ? groupSections(data.lines) : [];
  const total = data?.summary.itemCount ?? 0;

  return (
    <PhoneColumn>
      <B2Header
        title="Check and sign"
        subtitle={data ? dayLine(data.department.name, data.day.date, plural(total, 'item', 'items')) : ''}
        mono
        leading="back"
        onBack={() => router.push(DAY_COUNT)}
        place={orgName}
      />
      {status === 'loading' || status === 'idle' ? (
        <RowsSkeleton rows={4} text={copy.loading} />
      ) : status === 'error' || !data ? (
        <BodyState kind="error" text={error ?? 'Could not load your items. Try again.'} onRetry={() => void reload()} />
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wds-surface p-5">
            <ReceiptCard label="YOU COUNTED" title={plural(total, 'item', 'items')} chip={<CardChip tone="success" text="None left blank" />}>
              {sections.map((s) => (
                <ReceiptSection key={s.name}>
                  <p className="font-wds-sans text-[13px] font-medium leading-[18px] text-wds-text-ink">
                    {s.name} · {plural(s.itemCount, 'item', 'items')}
                  </p>
                  <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{s.names.join(', ')}</p>
                </ReceiptSection>
              ))}
              <ReceiptSection>
                <Link href={DAY_COUNT_FIGURES} className="relative flex items-center font-wds-sans text-[13px] font-medium leading-[18px] text-[var(--wds-primary-btn-start)] outline-none transition-opacity duration-100 ease-out before:absolute before:inset-x-0 before:-inset-y-[13px] before:content-[''] focus-visible:shadow-wds-ring active:opacity-60 [@media(hover:hover)]:hover:underline">
                  {BRANCH_DAY_BUTTONS.seeEveryFigure}
                </Link>
              </ReceiptSection>
            </ReceiptCard>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{BRANCH_DAY_MESSAGES.signedByManagerNote}</p>
            <SignFields signedBy={signedByText(data.department.name, isHead)} sign={sign} />
          </main>
          <B2Footer>
            <B2PrimaryButton disabled={!sign.ready} onClick={sign.submit}>
              {sign.saving ? 'Sending' : BRANCH_DAY_BUTTONS.sendToManager}
            </B2PrimaryButton>
          </B2Footer>
        </>
      )}
    </PhoneColumn>
  );
}
