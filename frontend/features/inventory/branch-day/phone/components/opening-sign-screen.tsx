'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Footer, B2Header, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { RecountPreview } from '../../_shared/types/branch-day-contract';
import { useOpeningView } from '../hooks/use-phone-day';
import { useSign } from '../hooks/use-sign';
import { isFigure } from '../lib/count-logic';
import { differenceText, figureText, plural, signedByText } from '../lib/phone-format';
import { DAY_HOME, DAY_OPENING_RECORDED, DAY_RECOUNT } from '../lib/phone-routes';
import { clearRecount, readRecount } from '../lib/recount-session';
import { branchDayPhoneApi } from '../services/branch-day-phone-api';
import { BodyState, CardChip, ReceiptCard, ReceiptSection, RowsSkeleton, SignFields } from './phone-parts';

const CheckMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0">
    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="var(--wds-success-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Paper B2: check the difference and sign. What matched, what differs, then the PIN. */
export function OpeningSignScreen() {
  const router = useRouter();
  const { data, status, error, reload } = useOpeningView();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const isHead = useAuthStore((s) => s.isDepartmentHead);
  const copy = BRANCH_DAY_STATES_COPY.opening;
  const [preview, setPreview] = React.useState<RecountPreview | null>(null);
  const figures = React.useRef<Record<string, string>>({});

  React.useEffect(() => {
    const session = readRecount();
    if (!session?.preview) {
      // Nothing was recounted in this tab (a reload cleared it): start the recount again.
      router.replace(DAY_RECOUNT);
      return;
    }
    figures.current = session.figures;
    setPreview(session.preview);
  }, [router]);
  React.useEffect(() => {
    if (data && data.check.state !== 'NOT_CHECKED') router.replace(DAY_HOME);
  }, [data, router]);

  const sign = useSign(
    (pin, idempotencyKey) =>
      branchDayPhoneApi.recount({
        lines: (data?.lines ?? []).filter((l) => isFigure(figures.current[l.itemId])).map((l) => ({ itemId: l.itemId, countedQty: String(figures.current[l.itemId]) })),
        pin,
        idempotencyKey,
      }),
    () => {
      clearRecount();
      router.push(DAY_OPENING_RECORDED);
    },
    (code) => {
      if (code === 'OPENING_ALREADY_CHECKED') {
        clearRecount();
        router.replace(DAY_HOME);
        return true;
      }
      return false;
    },
  );

  const ready = status === 'ready' && data && preview;
  const differences = preview?.differences ?? [];
  const matched = preview?.matchedItems ?? [];

  return (
    <PhoneColumn>
      <B2Header
        title="Record the opening"
        subtitle={data ? `${data.department.name} · recount · ${plural(data.itemCount, 'item', 'items')}` : ''}
        mono
        leading="back"
        onBack={() => router.push(DAY_RECOUNT)}
        place={orgName}
      />
      {status === 'error' ? (
        <BodyState kind="error" text={error ?? copy.error} onRetry={() => void reload()} />
      ) : !ready ? (
        <RowsSkeleton rows={4} text={copy.loading} />
      ) : (
        <>
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wds-surface p-5">
            <ReceiptCard
              label="YOU COUNTED"
              title={plural(preview.itemCount, 'item', 'items')}
              chip={differences.length === 0 ? <CardChip tone="success" text="No difference" /> : <CardChip tone="warning" text={plural(differences.length, 'difference', 'differences')} />}
            >
              {matched.length > 0 ? (
                <ReceiptSection>
                  <p className="flex items-start gap-2 font-wds-sans text-[13px] font-medium leading-[18px] text-wds-text-ink">
                    <CheckMark />
                    {plural(matched.length, 'item matches', 'items match')} last night
                  </p>
                  <p className="pl-[22px] font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{matched.join(', ')}</p>
                </ReceiptSection>
              ) : null}
              {differences.map((d) => (
                <div key={d.itemId} className="flex flex-col gap-0.5 border-t border-wds-warning-border bg-wds-warning-bg px-4 pb-3 pt-2.5">
                  <p className="font-wds-sans text-[13px] font-medium leading-[18px] text-wds-text-ink">
                    {d.itemName} · {differenceText(d.difference)}
                  </p>
                  <p className="font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
                    Signed last night: {figureText(d.lastNightQty)} {d.unit.toLowerCase()}. You counted: {figureText(d.countedQty)}.
                  </p>
                </div>
              ))}
            </ReceiptCard>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{BRANCH_DAY_MESSAGES.openingStartsFromCount}</p>
            <SignFields signedBy={signedByText(data.department.name, isHead)} sign={sign} />
          </main>
          <B2Footer>
            <B2PrimaryButton disabled={!sign.ready} onClick={sign.submit}>
              {sign.saving ? 'Recording' : BRANCH_DAY_BUTTONS.recordOpening}
            </B2PrimaryButton>
          </B2Footer>
        </>
      )}
    </PhoneColumn>
  );
}
