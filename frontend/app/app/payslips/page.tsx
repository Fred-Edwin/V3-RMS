'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Printer, RefreshCw, X } from 'lucide-react';
import { Button, PageHeader, PageLayout, SkeletonBlock, SkeletonTable } from '@/components/ui';
import { PayslipDetailModal } from '@/components/payslips/PayslipDetailModal';
import { useToast } from '@/hooks/useToast';
import { payslipService } from '@/services/payslipService';
import { useAuthStore } from '@/store/authStore';
import type { Payslip } from '@/types/payslip';
import { formatCurrency, formatPayPeriod } from '@/components/payslips/payslip-utils';
import { cn } from '@/lib/cn';

type TabId = 'current' | 'history' | 'details';

interface PaymentDetailsForm {
  kraPIN: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankBranch: string;
  helbNumber: string;
}

const emptyForm = (): PaymentDetailsForm => ({
  kraPIN: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  bankBranch: '',
  helbNumber: '',
});

function formatDate(iso: string | null | undefined, prefix?: string): string {
  if (!iso) return '';
  const d = new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return prefix ? `${prefix} ${d}` : d;
}

const DeductionRow = ({ label, value, note }: { label: string; value: string | null | undefined; note?: string }) => {
  if (!value || value === '0' || value === '0.00') return null;
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-stone-100 py-2.5', note && 'bg-red-50/50')}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-stone-600">{label}</span>
        {note && <span className="text-[11px] italic text-stone-400">{note}</span>}
      </div>
      <span className="text-[13px] font-semibold text-red-600 whitespace-nowrap">Ksh {formatCurrency(value)}</span>
    </div>
  );
};

export default function MyPaymentsPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('current');
  const [currentPayslip, setCurrentPayslip] = useState<Payslip | null>(null);
  const [history, setHistory] = useState<Payslip[]>([]);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Payment details edit state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<PaymentDetailsForm>(emptyForm());

  const loadCurrentPayslip = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingCurrent(true);
    try {
      const result = await payslipService.listMyPayslips(accessToken, { page: 1, perPage: 1 });
      setCurrentPayslip(result.items[0] ?? null);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load payslip', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoadingCurrent(false);
    }
  }, [accessToken, toast]);

  const loadHistory = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingHistory(true);
    try {
      const result = await payslipService.listMyPayslips(accessToken, { page: 1, perPage: 24 });
      setHistory(result.items);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load history', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void loadCurrentPayslip(); }, [loadCurrentPayslip]);
  useEffect(() => { if (activeTab === 'history') void loadHistory(); }, [activeTab, loadHistory]);

  // Populate form when entering edit mode
  const startEditing = () => {
    const ep = currentPayslip?.user.employeeProfile;
    setForm({
      kraPIN: ep?.kraPIN ?? '',
      bankName: ep?.bankName ?? '',
      accountNumber: ep?.accountNumber ?? '',
      accountName: ep?.accountName ?? '',
      bankBranch: ep?.bankBranch ?? '',
      helbNumber: '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setIsSaving(true);
    try {
      await payslipService.updateMyPaymentDetails(
        {
          kraPIN: form.kraPIN || null,
          bankName: form.bankName || null,
          accountNumber: form.accountNumber || null,
          accountName: form.accountName || null,
          bankBranch: form.bankBranch || null,
          helbNumber: form.helbNumber || null,
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Details saved', message: 'Your bank and KRA details have been updated.' });
      setIsEditing(false);
      void loadCurrentPayslip();
    } catch (error) {
      toast({ variant: 'error', title: 'Save failed', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const openPrint = (payslip: Payslip) => { setSelectedPayslip(payslip); setIsDetailOpen(true); };

  const ep = currentPayslip?.user.employeeProfile;

  return (
    <PageLayout className="animate-fade-up space-y-4 max-w-[860px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="My Payments"
          subtitle="Your salary, deductions, and payment history. Update your bank details and KRA PIN so payroll reaches you correctly."
          titleClassName="font-display text-display-lg font-semibold text-espresso"
        />
        {activeTab === 'current' && (
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={() => void loadCurrentPayslip()} className="mt-1 shrink-0">
            Refresh
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        {([
          ['current', 'Current Month'],
          ['history', 'Payment History'],
          ['details', 'Bank & KRA Details'],
        ] as [TabId, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              activeTab === id
                ? 'border-[#6b4226] text-[#1a0a00] font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── CURRENT MONTH TAB ── */}
      {activeTab === 'current' && (
        <div className="space-y-4">
          {isLoadingCurrent ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-14 rounded-xl" />
              <SkeletonBlock className="h-52 rounded-[24px]" />
              <SkeletonBlock className="h-64 rounded-[24px]" />
            </div>
          ) : !currentPayslip ? (
            <div className="rounded-[24px] border border-stone-200 bg-white p-12 text-center shadow-sm">
              <p className="text-[14px] text-stone-500">No payslip available yet for this period.</p>
              <p className="mt-1 text-[13px] text-stone-400">Your HR team will publish figures here when payroll is prepared.</p>
            </div>
          ) : (
            <>
              {/* Notice banner */}
              {currentPayslip.isLocked ? (
                <div className="flex items-start gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <span className="text-emerald-600 text-base flex-shrink-0 mt-0.5">✓</span>
                  <div>
                    <div className="text-[13px] font-bold text-emerald-800">Finalised</div>
                    <div className="text-[12px] text-emerald-700 opacity-85">
                      Your payroll for {formatPayPeriod(currentPayslip.payPeriod)} has been published.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
                  <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">⏳</span>
                  <div>
                    <div className="text-[13px] font-bold text-amber-800">Estimated — not yet finalised</div>
                    <div className="text-[12px] text-amber-700 opacity-85">
                      HR is still preparing the {formatPayPeriod(currentPayslip.payPeriod)} payroll. These figures update as they edit.
                      If anything looks wrong, speak to HR or your manager now.
                    </div>
                  </div>
                </div>
              )}

              {/* Hero card */}
              <div
                className="relative overflow-hidden rounded-[24px] p-6 text-white"
                style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #3d1a08 100%)' }}
              >
                <div className="pointer-events-none absolute -top-10 -right-10 size-44 rounded-full opacity-[0.04] bg-white" />
                <div className="pointer-events-none absolute -bottom-14 left-5 size-60 rounded-full opacity-[0.03] bg-white" />

                <div className="relative">
                  {/* Status badge */}
                  <div className="mb-3">
                    {currentPayslip.isLocked ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-400" /> Finalised
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                        <span className="size-1.5 rounded-full bg-amber-400" /> Draft · HR is editing
                      </span>
                    )}
                  </div>

                  <p className="text-[12px] opacity-60 mb-0.5">
                    {formatPayPeriod(currentPayslip.payPeriod)} · Expected pay date: {formatDate(currentPayslip.payDate)}
                  </p>
                  <p className="text-[17px] font-bold opacity-90 mb-5">
                    {user?.name ?? currentPayslip.user.name} · {currentPayslip.user.employeeProfile?.jobTitle ?? currentPayslip.user.role}
                  </p>

                  {/* Stats — stacked on mobile, row on sm+ */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Gross Pay</div>
                      <div className="text-[20px] font-bold opacity-95">Ksh {formatCurrency(currentPayslip.grossPay)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Total Deductions</div>
                      <div className="text-[20px] font-bold" style={{ color: '#fca5a5' }}>Ksh {formatCurrency(currentPayslip.totalDeductions)}</div>
                    </div>
                    <div className="sm:ml-auto">
                      <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Net Pay</div>
                      <div className="text-[30px] font-bold leading-none" style={{ color: '#6ee7b7' }}>Ksh {formatCurrency(currentPayslip.netPay)}</div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-3 text-[12px] opacity-50">
                    ℹ️ &nbsp; Figures update as HR edits the payroll sheet
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions breakdown */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Earnings */}
                <div className="overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                    ↑ &nbsp;Earnings
                  </div>
                  <div className="px-4 py-1">
                    <div className="flex items-center justify-between gap-4 border-b border-stone-100 py-2.5">
                      <span className="text-[13px] text-stone-600">Gross Salary</span>
                      <span className="text-[13px] font-semibold text-emerald-600 whitespace-nowrap">Ksh {formatCurrency(currentPayslip.grossPay)}</span>
                    </div>
                    {currentPayslip.overtime && currentPayslip.overtime !== '0' && currentPayslip.overtime !== '0.00' && (
                      <div className="flex items-center justify-between gap-4 border-b border-stone-100 py-2.5">
                        <span className="text-[13px] text-stone-600">Overtime</span>
                        <span className="text-[13px] font-semibold text-emerald-600 whitespace-nowrap">Ksh {formatCurrency(currentPayslip.overtime)}</span>
                      </div>
                    )}
                    {currentPayslip.incentives && currentPayslip.incentives !== '0' && currentPayslip.incentives !== '0.00' && (
                      <div className="flex items-center justify-between gap-4 py-2.5">
                        <span className="text-[13px] text-stone-600">Incentives</span>
                        <span className="text-[13px] font-semibold text-emerald-600 whitespace-nowrap">Ksh {formatCurrency(currentPayslip.incentives)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deductions */}
                <div className="overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-red-600">
                    ↓ &nbsp;Deductions
                  </div>
                  <div className="px-4 py-1">
                    <DeductionRow label="PAYE" value={currentPayslip.paye} />
                    <DeductionRow label="SHA (NHIF)" value={currentPayslip.sha} />
                    <DeductionRow label="NSSF (Tier 1)" value={currentPayslip.nssfTier1} />
                    <DeductionRow label="NSSF (Tier 2)" value={currentPayslip.nssfTier2} />
                    <DeductionRow label="Housing Levy" value={currentPayslip.housingLevy} />
                    <DeductionRow label="HELB" value={currentPayslip.helb} />
                    <DeductionRow label="Salary Advance" value={currentPayslip.advance} />
                    {(currentPayslip.otherDeductions ?? []).map((item, i) => (
                      <DeductionRow key={i} label="Other Deductions" value={item.amount} note={item.label} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Net Pay equation summary — responsive */}
              <div className="rounded-[20px] border border-stone-200 bg-white px-6 py-5 shadow-sm">
                {/* Mobile: vertical stack */}
                <div className="flex flex-col items-center gap-1 sm:hidden">
                  <div className="text-[11px] uppercase tracking-wider text-stone-400">Gross Pay</div>
                  <div className="text-[16px] font-bold text-stone-800">Ksh {formatCurrency(currentPayslip.grossPay)}</div>
                  <div className="text-[18px] text-stone-300 leading-none">−</div>
                  <div className="text-[11px] uppercase tracking-wider text-stone-400">Total Deductions</div>
                  <div className="text-[16px] font-bold text-red-600">Ksh {formatCurrency(currentPayslip.totalDeductions)}</div>
                  <div className="text-[18px] text-stone-300 leading-none">=</div>
                  <div className="text-[11px] uppercase tracking-wider text-stone-400">Net Pay</div>
                  <div className="text-[26px] font-bold text-emerald-700">Ksh {formatCurrency(currentPayslip.netPay)}</div>
                </div>
                {/* Desktop: horizontal */}
                <div className="hidden sm:flex items-center justify-between gap-4">
                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Gross Pay</div>
                    <div className="text-[16px] font-bold text-stone-800">Ksh {formatCurrency(currentPayslip.grossPay)}</div>
                  </div>
                  <div className="text-[20px] text-stone-300">−</div>
                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Total Deductions</div>
                    <div className="text-[16px] font-bold text-red-600">Ksh {formatCurrency(currentPayslip.totalDeductions)}</div>
                  </div>
                  <div className="text-[20px] text-stone-300">=</div>
                  <div className="text-center">
                    <div className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">Net Pay</div>
                    <div className="text-[22px] font-bold text-emerald-700">Ksh {formatCurrency(currentPayslip.netPay)}</div>
                  </div>
                </div>
              </div>

              {/* Print button */}
              <div className="flex justify-end">
                <Button
                  leftIcon={<Printer size={16} />}
                  disabled={!currentPayslip.isLocked}
                  onClick={() => openPrint(currentPayslip)}
                  title={!currentPayslip.isLocked ? 'Available once HR publishes the payroll' : undefined}
                >
                  Print Payslip
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PAYMENT HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-5 py-4">
            <h3 className="text-[14px] font-bold text-espresso">Payment History</h3>
            <p className="mt-0.5 text-[12px] text-stone-400">Past payslips — click Print for a paper copy.</p>
          </div>

          {isLoadingHistory ? (
            <div className="p-5"><SkeletonTable rows={5} columns={5} /></div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-[14px] text-stone-500">No payment history yet.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-stone-400">Period</th>
                  {/* Hidden on mobile */}
                  <th className="hidden sm:table-cell px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-stone-400">Gross</th>
                  <th className="hidden sm:table-cell px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-stone-400">Deductions</th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-stone-400">Net Pay</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-stone-400">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-stone-800">{formatPayPeriod(p.payPeriod)}</div>
                      <div className="text-[12px] text-stone-400 mt-0.5">
                        {formatDate(p.payDate, p.isLocked ? 'Paid:' : 'Pay date:')}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums text-stone-600">
                      Ksh {formatCurrency(p.grossPay)}
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums text-red-600">
                      Ksh {formatCurrency(p.totalDeductions)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                      Ksh {formatCurrency(p.netPay)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
                          p.isLocked
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-600 border-amber-200',
                        )}
                      >
                        {p.isLocked ? 'Paid' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => p.isLocked && openPrint(p)}
                        disabled={!p.isLocked}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Printer size={12} />
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── BANK & KRA DETAILS TAB ── */}
      {activeTab === 'details' && (
        <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
          <div className="flex items-start justify-between border-b border-stone-100 px-5 py-4">
            <div>
              <h3 className="text-[14px] font-bold text-espresso">Bank &amp; KRA Details</h3>
              <p className="mt-0.5 text-[12px] text-stone-400">Printed on your payslip. Keep these current.</p>
            </div>
            {!isEditing && (
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <Pencil size={13} />
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            /* ── EDIT FORM ── */
            <div className="px-5 py-4 space-y-3">
              {([
                { key: 'kraPIN', label: 'KRA PIN', placeholder: 'e.g. A001234567B', type: 'text' },
                { key: 'bankName', label: 'Bank Name', placeholder: 'e.g. Equity Bank Kenya', type: 'text' },
                { key: 'accountNumber', label: 'Account Number', placeholder: 'Full account number', type: 'text' },
                { key: 'accountName', label: 'Account Name', placeholder: 'Name on the account', type: 'text' },
                { key: 'bankBranch', label: 'Bank Branch', placeholder: 'e.g. Nyeri Branch', type: 'text' },
                { key: 'helbNumber', label: 'HELB Reference No.', placeholder: 'Leave blank if not applicable', type: 'text' },
              ] as { key: keyof PaymentDetailsForm; label: string; placeholder: string; type: string }[]).map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="mb-1 block text-[12px] font-semibold text-stone-600">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-[13px] text-stone-800 placeholder:text-stone-300 focus:border-[#6b4226] focus:outline-none focus:ring-2 focus:ring-[#6b4226]/10"
                  />
                </div>
              ))}

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={() => void handleSave()} isLoading={isSaving}>
                  Save details
                </Button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-stone-500 hover:text-stone-700 transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── READ VIEW ── */
            ep ? (
              <div className="px-5 py-1">
                {([
                  { label: 'KRA PIN', value: ep.kraPIN },
                  { label: 'Bank Name', value: ep.bankName },
                  {
                    label: 'Account Number',
                    value: ep.accountNumber ? `•••• •••• ${ep.accountNumber.slice(-4)}` : null,
                  },
                  { label: 'Account Name', value: ep.accountName },
                  { label: 'Bank Branch', value: ep.bankBranch },
                  { label: 'HELB Deduction', value: null },
                ]).map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between border-b border-stone-100 py-3 gap-4 last:border-none">
                    <span className="text-[12px] text-stone-500 min-w-[140px]">{label}</span>
                    <span className={cn('text-[13px] font-medium text-right', value ? 'text-stone-800' : 'italic text-stone-300')}>
                      {value ?? 'Not set — contact HR'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-stone-400 mb-3">No profile found. You need an employee profile before you can save your details.</p>
                <p className="text-[12px] text-stone-400">Contact HR to create your employee profile first.</p>
              </div>
            )
          )}
        </div>
      )}

      <PayslipDetailModal
        payslip={selectedPayslip}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </PageLayout>
  );
}
