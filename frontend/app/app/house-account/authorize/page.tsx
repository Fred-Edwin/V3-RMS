'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button, PageHeader, PageLayout } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { houseAccountAuthService } from '@/services/houseAccountAuthService';
import { useAuthStore } from '@/store/authStore';
import type { HouseAccountAuthRequest } from '@/types/houseAccountAuth';
import { ApiError } from '@/types/api';

type PageState = 'loading' | 'ready' | 'submitting' | 'resolved' | 'error' | 'not_found';

const formatCurrency = (value: string): string => {
  const num = Number.parseFloat(value);
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function HouseAccountAuthorizePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const requestId = searchParams.get('requestId');

  const [authRequest, setAuthRequest] = useState<HouseAccountAuthRequest | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [resolvedDecision, setResolvedDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const loadAuthRequest = useCallback(async () => {
    if (!requestId) {
      setPageState('not_found');
      return;
    }
    if (!accessToken) {
      // Not logged in — redirect to login with return URL
      router.push(`/login?returnTo=/app/house-account/authorize?requestId=${requestId}`);
      return;
    }
    try {
      const data = await houseAccountAuthService.getById(requestId, accessToken);
      setAuthRequest(data);
      if (data.status !== 'PENDING') {
        setResolvedDecision(data.status === 'APPROVED' ? 'APPROVED' : 'REJECTED');
        setPageState('resolved');
      } else {
        setPageState('ready');
      }
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setPageState('not_found');
      } else {
        setPageState('error');
      }
    }
  }, [requestId, accessToken, router]);

  useEffect(() => {
    void loadAuthRequest();
  }, [loadAuthRequest]);

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!authRequest || !accessToken) return;

    setPageState('submitting');
    try {
      const isManager = user?.role === 'MANAGER' || user?.role === 'DIRECTOR';
      const updated = isManager
        ? await houseAccountAuthService.override(authRequest.id, decision, accessToken)
        : await houseAccountAuthService.resolve(authRequest.id, decision, accessToken);

      setAuthRequest(updated);
      setResolvedDecision(decision);
      setPageState('resolved');
      toast({
        variant: 'success',
        title: decision === 'APPROVED' ? 'Charge approved' : 'Charge rejected',
        message:
          decision === 'APPROVED'
            ? `Order #${authRequest.order.dailyNumber} has been approved and will close.`
            : `Order #${authRequest.order.dailyNumber} was rejected. The waiter will be notified.`,
      });
    } catch (err) {
      setPageState('ready');
      toast({
        variant: 'error',
        title: 'Action failed',
        message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      });
    }
  };

  if (pageState === 'loading') {
    return (
      <PageLayout>
        <PageHeader title="House Account Authorization" />
        <div className="flex items-center justify-center h-40">
          <p className="text-body-md text-stone-500">Loading authorization request…</p>
        </div>
      </PageLayout>
    );
  }

  if (pageState === 'not_found') {
    return (
      <PageLayout>
        <PageHeader title="House Account Authorization" />
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-4">
          <AlertTriangle size={32} className="text-amber-500" />
          <p className="text-body-md text-stone-700">Authorization request not found or has already expired.</p>
          <Button variant="secondary" onClick={() => router.push('/app/orders')}>
            Back to Orders
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (pageState === 'error') {
    return (
      <PageLayout>
        <PageHeader title="House Account Authorization" />
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-4">
          <AlertTriangle size={32} className="text-red-500" />
          <p className="text-body-md text-stone-700">Unable to load the authorization request.</p>
          <Button variant="secondary" onClick={() => void loadAuthRequest()}>
            Try again
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (pageState === 'resolved' && authRequest) {
    const approved = resolvedDecision === 'APPROVED';
    return (
      <PageLayout>
        <PageHeader title="House Account Authorization" />
        <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center">
          {approved ? (
            <CheckCircle size={48} className="text-green-500" />
          ) : (
            <XCircle size={48} className="text-red-500" />
          )}
          <p className="text-heading-sm font-semibold text-stone-900">
            {approved ? 'Charge Approved' : 'Charge Rejected'}
          </p>
          <p className="text-body-md text-stone-600">
            {approved
              ? `Order #${authRequest.order.dailyNumber} for ${formatCurrency(authRequest.amount)} has been approved.`
              : `Order #${authRequest.order.dailyNumber} was rejected. The waiter will collect payment another way.`}
          </p>
          <Button variant="secondary" onClick={() => router.push('/app/orders')}>
            Back to Orders
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (!authRequest) return null;

  const isExpired = new Date(authRequest.expiresAt) < new Date();

  return (
    <PageLayout>
      <PageHeader title="House Account Authorization" />
      <div className="space-y-6 p-4 max-w-md mx-auto">
        {/* Request summary card */}
        <div className="rounded-lg border border-stone-200 p-4 space-y-3">
          <p className="text-label-sm text-stone-500 uppercase tracking-wide font-semibold">Charge Request</p>

          <div className="flex items-center justify-between">
            <span className="text-body-sm text-stone-600">Order</span>
            <span className="text-body-md font-semibold text-stone-900">#{authRequest.order.dailyNumber}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-body-sm text-stone-600">Amount</span>
            <span className="text-body-md font-semibold text-espresso">{formatCurrency(authRequest.amount)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-body-sm text-stone-600">Account holder</span>
            <span className="text-body-md text-stone-900">{authRequest.houseAccount.user.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-body-sm text-stone-600">Requested by</span>
            <span className="text-body-md text-stone-900">{authRequest.requestedBy.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-body-sm text-stone-600">Requested at</span>
            <span className="text-body-md text-stone-900">{formatTime(authRequest.createdAt)}</span>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <Clock size={13} className={isExpired ? 'text-red-500' : 'text-amber-500'} />
            <span className={`text-label-sm ${isExpired ? 'text-red-600' : 'text-amber-700'}`}>
              {isExpired ? 'This request has expired' : `Expires at ${formatTime(authRequest.expiresAt)}`}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {!isExpired && (
          <div className="space-y-3">
            <p className="text-body-sm text-stone-600 text-center">
              Do you authorise this charge to your house account?
            </p>
            <Button
              className="w-full"
              isLoading={pageState === 'submitting'}
              onClick={() => void handleDecision('APPROVED')}
            >
              <CheckCircle size={16} className="mr-2 shrink-0" />
              Approve Charge
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              isLoading={pageState === 'submitting'}
              onClick={() => void handleDecision('REJECTED')}
            >
              <XCircle size={16} className="mr-2 shrink-0" />
              Reject Charge
            </Button>
          </div>
        )}

        {isExpired && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-body-sm text-red-700">
              This authorization request has expired. The order has been returned to the waiter.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
