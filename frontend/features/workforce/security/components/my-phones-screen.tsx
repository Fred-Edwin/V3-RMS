'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';

import { Callout, DialogButton, EmptyState, ErrorBlock, KeyValueRows, KitDialog, ListSkeleton, PhoneScreen, useNow } from '../../_shared';
import { usePhones } from '../hooks/use-phones';
import { PHONE_COPY, placeWords, removeTitle, shortDate } from '../lib/security-words';
import type { Phone } from '../types/security-types';
import { PhoneCard } from './phone-card';

/**
 * "My phones" (Paper Chapter 14 step 3, middle and right phones): every phone that has signed in as the person, this one first. Each person
 * sees only their own (HR and the System Admin cannot see or remove another person's phones). Needs signal: offline it says so rather than
 * showing a list that may be old. Five or more phones raise a one-line warning.
 */
export function MyPhonesScreen() {
  const router = useRouter();
  const now = useNow();
  const logout = useAuthStore((s) => s.logout);
  const phones = usePhones();
  const [removing, setRemoving] = React.useState<Phone | null>(null);
  const data = phones.list.data;

  const signOut = (): void => {
    void logout().then(() => router.replace('/login'));
  };

  let body: React.ReactNode;
  if (phones.list.status === 'loading') body = <ListSkeleton rows={2} columns={['fill', 70]} label="Loading your phones" />;
  else if (phones.list.status === 'error' && !data) {
    const offline = phones.list.error.code === 'NETWORK';
    body = <ErrorBlock title={offline ? PHONE_COPY.offline : 'We could not load your phones.'} line="Nothing was changed." reference={offline ? undefined : phones.list.error.code} onRetry={phones.list.reload} />;
  } else if (data) {
    const others = data.phones.filter((p) => !p.isThisPhone);
    body = (
      <>
        {data.manyPhones ? <Callout tone="warning">{PHONE_COPY.many(data.manyPhones)}</Callout> : null}
        {phones.error ? <Callout tone="error" role="alert">{phones.error}</Callout> : null}
        {data.phones.map((p) => (
          <PhoneCard key={p.id} phone={p} now={now} busy={phones.busy} onConfirm={() => void phones.confirm(p.id)} onRemove={() => setRemoving(p)} onSignOut={signOut} />
        ))}
        {others.length === 0 ? <EmptyState kind="nothingYet" title={PHONE_COPY.empty} /> : null}
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{PHONE_COPY.showing(data.phones.length)}</p>
      </>
    );
  }

  return (
    <PhoneScreen screen="My phones" kicker="PROFILE AND SECURITY · MY PHONES" back="/app/workforce" heading="My phones" subtitle={PHONE_COPY.listLine}>
      {body}
      <KitDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? removeTitle(removing) : 'Remove this phone?'}
        description={PHONE_COPY.removeLine}
        busy={phones.busy}
        width={480}
        footer={
          <>
            <DialogButton kind="cancel" onClick={() => setRemoving(null)}>
              {PHONE_COPY.keep}
            </DialogButton>
            <DialogButton
              kind="danger"
              disabled={phones.busy}
              onClick={() => {
                if (removing) void phones.remove(removing.id).then((ok) => ok && setRemoving(null));
              }}
            >
              {PHONE_COPY.removeThis}
            </DialogButton>
          </>
        }
      >
        {removing ? (
          <div className="flex flex-col gap-3">
            <KeyValueRows aria-label="The phone to remove" rows={[{ label: 'Phone', value: removing.label }, { label: 'Place', value: placeWords(removing.placeLabel) }, { label: 'First used', value: shortDate(removing.firstSeenAt) }]} />
            <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{PHONE_COPY.removed}</p>
          </div>
        ) : null}
      </KitDialog>
    </PhoneScreen>
  );
}
