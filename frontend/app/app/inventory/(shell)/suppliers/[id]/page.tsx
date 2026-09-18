'use client';

import { useParams } from 'next/navigation';

import { SupplierDetailScreen } from '@/features/inventory';

export default function SupplierDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <SupplierDetailScreen id={id} />;
}
