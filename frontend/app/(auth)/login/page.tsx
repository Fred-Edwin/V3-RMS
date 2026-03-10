'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SupportContact } from '@/components/ui/SupportContact';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { roleHome } from '@/lib/role-home';
import { ApiError } from '@/types/api';

export default function Page(): JSX.Element {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  const resolvedNextPath = useMemo(() => nextPath, [nextPath]);

  useEffect(() => {
    setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    const urlParams = new URLSearchParams(window.location.search);
    setNextPath(urlParams.get('next'));

    const onOnline = (): void => setIsOffline(false);
    const onOffline = (): void => setIsOffline(true);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.login({
        email: email.trim(),
        password,
      });

      setAuth(response);

      const defaultPath = roleHome[response.user.role];
      router.push(resolvedNextPath || defaultPath);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setErrorMessage('Invalid email or password.');
      } else {
        setErrorMessage('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-crema flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-up">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <Image
              src="/images/wendo-logo.jpg"
              alt="Wendo Coffee Bistro"
              width={72}
              height={72}
              className="rounded-full object-cover ring-2 ring-[#C4862A66] ring-offset-2 ring-offset-crema shadow-md"
              priority
            />
          </div>
          <h1 className="font-display text-display-xl text-espresso tracking-[-0.02em] text-center leading-[1.1]">
            Wendo<br />Coffee Bistro
          </h1>
          <p className="mt-2 text-caption text-stone-500 tracking-widest uppercase">
            Restaurant Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-md p-8">

          <div className="mb-6">
            <h2 className="text-heading-md font-sans font-semibold text-stone-900">Welcome back</h2>
            <p className="mt-1 text-body-sm text-stone-500">Sign in to your account to continue.</p>
          </div>

          {/* Offline banner */}
          {isOffline && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#F0D080] bg-[#FDF3DC] px-4 py-3">
              <WifiOff size={16} className="mt-0.5 shrink-0 text-[#92650A]" />
              <p className="text-body-sm text-[#92650A]">
                You&apos;re offline — check your connection before signing in.
              </p>
            </div>
          )}

          {/* Error banner */}
          {errorMessage && (
            <div className="mb-5 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
              <p className="text-body-sm text-[#991B1B]">{errorMessage}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@wendocoffee.com"
              leftIcon={<Mail size={16} />}
              disabled={isLoading}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                leftIcon={<Lock size={16} />}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 bottom-3 text-stone-400 hover:text-stone-600 transition-colors duration-fast"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              disabled={isOffline}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-caption text-stone-400">
          Wendo Coffee Bistro · Nyeri, Kenya
        </p>
        <SupportContact className="mt-3" />
      </div>
    </main>
  );
}
