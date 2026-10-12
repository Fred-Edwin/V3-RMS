'use client';

import * as React from 'react';

import { PurchaseFileScreen } from '../screens/purchase-file-screen';
import { useIsAttendant } from './gate';
import { OrderPhonePage } from './order-page';

/** `/purchasing/[orderId]`: the Attendant gets the phone page for the order's state; every desktop role keeps the purchase file. */
export function OrderRoute({ orderId }: { orderId: string }) {
  const { ready, attendant } = useIsAttendant();
  if (!ready) return null;
  return attendant ? <OrderPhonePage orderId={orderId} /> : <PurchaseFileScreen orderId={orderId} />;
}
