'use client';

import { useParams } from 'next/navigation';

import { SupplierPageScreen } from '@/features/inventory/components/screens/supplier-page-screen';

export default function SupplierDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <SupplierPageScreen id={id} />;
}
