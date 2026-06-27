'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { Button, Input } from '@/components/ui';

interface PayslipLockScreenProps {
  onVerify: (password: string) => void | Promise<void>;
  isVerifying: boolean;
  error: string | null;
}

export function PayslipLockScreen({ onVerify, isVerifying, error }: PayslipLockScreenProps): JSX.Element {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password || isVerifying) return;
    void onVerify(password);
  };

  return (
    <div className="mx-auto mt-10 max-w-md">
      <div
        className="overflow-hidden rounded-[24px] p-8 text-white shadow-sm"
        style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #3d1a08 100%)' }}
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-white/10">
            <Lock size={22} className="text-amber-200" />
          </div>
          <h2 className="font-display text-[20px] font-semibold leading-tight">Confirm it&apos;s you</h2>
          <p className="mt-1.5 text-[13px] opacity-60">
            For your security, re-enter your account password to view your salary and deduction details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Your account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isVerifying}
            errorMessage={error ?? undefined}
            inputClassName="bg-white/95"
          />
          <Button type="submit" className="w-full" isLoading={isVerifying} disabled={!password}>
            Unlock my payments
          </Button>
        </form>
      </div>
    </div>
  );
}
