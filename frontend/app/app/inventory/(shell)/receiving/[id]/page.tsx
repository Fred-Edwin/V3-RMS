'use client';

import { useParams } from 'next/navigation';

import { GoodsReceiptDetailScreen } from '@/features/inventory';

export default function GoodsReceiptDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <GoodsReceiptDetailScreen id={id} />;
}
