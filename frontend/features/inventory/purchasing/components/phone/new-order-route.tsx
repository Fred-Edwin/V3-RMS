'use client';

import * as React from 'react';

import { NewOrderScreen } from '../screens/new-order-screen';
import { useIsAttendant } from './gate';
import { NewOrderPhoneScreen } from './new-order-phone-screen';
import { PhoneLoading, PhoneScreen } from './phone-kit';

/** The Store Attendant gets the phone New order (every item, supplier and Low-and-out filters); whoever approves orders keeps the desktop one. */
export function NewOrderRoute() {
  const { ready, attendant } = useIsAttendant();
  if (!ready) {
    return (
      <PhoneScreen header={<div className="h-[88px] shrink-0 bg-wds-sidebar-top" aria-hidden="true" />}>
        <PhoneLoading rows={3} />
      </PhoneScreen>
    );
  }
  return attendant ? <NewOrderPhoneScreen /> : <NewOrderScreen />;
}
