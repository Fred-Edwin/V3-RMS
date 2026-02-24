'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DisplayBoard } from '@/components/kitchen/DisplayBoard';
import { useAuthStore } from '@/store/authStore';

export default function KitchenPage(): JSX.Element | null {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);

  useEffect(() => {
    if (role && role !== 'CHEF' && role !== 'KITCHEN_DISPLAY') {
      router.replace('/app/dashboard');
    }
  }, [role, router]);

  if (!role || (role !== 'CHEF' && role !== 'KITCHEN_DISPLAY')) {
    return null;
  }

  return <DisplayBoard station="KITCHEN" />;
}
