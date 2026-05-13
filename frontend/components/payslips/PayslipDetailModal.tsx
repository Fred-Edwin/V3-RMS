'use client';

import { Printer } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import type { Payslip } from '@/types/payslip';
import {
  formatCurrency,
  formatLongDate,
  formatPayPeriod,
  formatShortDate,
} from './payslip-utils';

interface PayslipDetailModalProps {
  payslip: Payslip | null;
  isOpen: boolean;
  onClose: () => void;
}

const LineRow = ({ label, value, note, green }: { label: string; value: string | null | undefined; note?: string; green?: boolean }) => {
  if (!value || value === '0' || value === '0.00') return null;
  return (
    <tr>
      <td style={{ padding: '5px 0', fontSize: 12, color: '#57534e', verticalAlign: 'top' }}>
        {label}
        {note && <div style={{ fontSize: 10, color: '#a8a29e', fontStyle: 'italic', marginTop: 1 }}>{note}</div>}
      </td>
      <td style={{ padding: '5px 0', fontSize: 12, fontWeight: 600, textAlign: 'right', color: green ? '#15803d' : '#1a0a00', whiteSpace: 'nowrap' }}>
        Ksh {formatCurrency(value)}
      </td>
    </tr>
  );
};

const Divider = () => (
  <tr><td colSpan={2} style={{ padding: 0 }}><div style={{ borderBottom: '1px solid #e7e5e4', margin: '2px 0' }} /></td></tr>
);

const amountToNumber = (value: string | null | undefined): number => Number(value ?? 0);

const totalEarnings = (payslip: Payslip): string =>
  (
    amountToNumber(payslip.grossPay) +
    amountToNumber(payslip.overtime) +
    amountToNumber(payslip.incentives) +
    amountToNumber(payslip.allowances)
  ).toFixed(2);

export function PayslipDetailModal({ payslip, isOpen, onClose }: PayslipDetailModalProps): JSX.Element {
  const footer = (
    <div className="flex items-center justify-end gap-3">
      <Button variant="ghost" onClick={onClose}>Close</Button>
      <Button leftIcon={<Printer size={16} />} onClick={() => window.print()} disabled={!payslip?.isLocked}>
        Print payslip
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={payslip ? `${payslip.user.name} — Payslip` : 'Payslip'}
      maxWidth="lg"
      className="print:max-w-none max-w-3xl"
      footer={footer}
    >
      {!payslip ? null : (
        <>
          <style jsx global>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 14mm;
              }
              body * { visibility: hidden; }
              body { margin: 0 !important; background: white !important; }
              .payslip-print-root,
              .payslip-print-root * { visibility: visible; }
              .payslip-print-root {
                position: fixed !important;
                left: 0 !important; top: 0 !important;
                width: 182mm !important;
                max-width: 182mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: white !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                border: 0 !important;
              }
            }
          `}</style>

          <div className="payslip-print-root" style={{ fontFamily: 'Georgia, "Times New Roman", serif', background: 'white' }}>

            {/* ── HEADER ─────────────────────────────────────── */}
            <div style={{ borderBottom: '2px solid #1a0a00', paddingBottom: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a0a00', letterSpacing: '-0.3px' }}>
                  WENDO COFFEE BISTRO
                </div>
                <div style={{ fontSize: 11, color: '#57534e', marginTop: 2 }}>
                  {payslip.organization.name}
                </div>
                {payslip.organization.kraPIN && (
                  <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 2 }}>
                    Employer KRA PIN: {payslip.organization.kraPIN}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1a0a00', letterSpacing: '-0.5px' }}>PAYSLIP</div>
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 99,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      background: payslip.isLocked ? '#f0fdf4' : '#fffbeb',
                      color: payslip.isLocked ? '#15803d' : '#d97706',
                      border: `1px solid ${payslip.isLocked ? '#bbf7d0' : '#fde68a'}`,
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    {payslip.isLocked ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── EMPLOYEE INFO TABLE ─────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '3px 0', width: '50%' }}>
                    <span style={{ color: '#a8a29e' }}>Employee: </span>
                    <strong style={{ color: '#1a0a00' }}>{payslip.user.name}</strong>
                  </td>
                  <td style={{ padding: '3px 0', width: '50%' }}>
                    <span style={{ color: '#a8a29e' }}>Pay Period: </span>
                    <strong style={{ color: '#1a0a00' }}>{formatPayPeriod(payslip.payPeriod)}</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '3px 0' }}>
                    <span style={{ color: '#a8a29e' }}>Job Title: </span>
                    <strong style={{ color: '#1a0a00' }}>{payslip.user.employeeProfile?.jobTitle ?? payslip.user.role}</strong>
                  </td>
                  <td style={{ padding: '3px 0' }}>
                    <span style={{ color: '#a8a29e' }}>Pay Date: </span>
                    <strong style={{ color: '#1a0a00' }}>{formatLongDate(payslip.payDate)}</strong>
                  </td>
                </tr>
                {payslip.user.employeeProfile?.kraPIN && (
                  <tr>
                    <td style={{ padding: '3px 0' }}>
                      <span style={{ color: '#a8a29e' }}>KRA PIN: </span>
                      <strong style={{ color: '#1a0a00' }}>{payslip.user.employeeProfile.kraPIN}</strong>
                    </td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>

            {/* ── TWO-COLUMN EARNINGS + DEDUCTIONS ───────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
              {/* Earnings */}
              <div style={{ border: '1px solid #e7e5e4', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f0fdf4', borderBottom: '1px solid #dcfce7', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#15803d', fontFamily: 'system-ui, sans-serif' }}>
                  EARNINGS
                </div>
                <div style={{ padding: '4px 12px 8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <LineRow label="Gross Salary" value={payslip.grossPay} green />
                      <LineRow label="Overtime" value={payslip.overtime} green />
                      <LineRow label="Incentives" value={payslip.incentives} green />
                      <LineRow label="Allowances" value={payslip.allowances} green />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions */}
              <div style={{ border: '1px solid #e7e5e4', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#dc2626', fontFamily: 'system-ui, sans-serif' }}>
                  DEDUCTIONS
                </div>
                <div style={{ padding: '4px 12px 8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <LineRow label="PAYE" value={payslip.paye} />
                      <LineRow label="SHA (NHIF)" value={payslip.sha} />
                      <LineRow label="NSSF Tier 1" value={payslip.nssfTier1} />
                      <LineRow label="NSSF Tier 2" value={payslip.nssfTier2} />
                      <LineRow label="Housing Levy" value={payslip.housingLevy} />
                      <LineRow label="HELB" value={payslip.helb} />
                      <LineRow label="Salary Advance" value={payslip.advance} />
                      {(payslip.otherDeductions ?? []).map((item, i) => (
                        <LineRow key={i} label={item.label} value={item.amount} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── NET PAY SUMMARY ─────────────────────────────── */}
            <div style={{ border: '1px solid #e7e5e4', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontFamily: 'system-ui, sans-serif' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Divider />
                  <tr>
                    <td style={{ padding: '5px 0', fontSize: 12, color: '#57534e' }}>Total Earnings</td>
                    <td style={{ padding: '5px 0', fontSize: 12, fontWeight: 600, textAlign: 'right', color: '#15803d' }}>
                      Ksh {formatCurrency(totalEarnings(payslip))}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 0', fontSize: 12, color: '#57534e' }}>Total Deductions</td>
                    <td style={{ padding: '5px 0', fontSize: 12, fontWeight: 600, textAlign: 'right', color: '#dc2626' }}>
                      Ksh {formatCurrency(payslip.totalDeductions)}
                    </td>
                  </tr>
                  <Divider />
                  {/* Boxed NET PAY */}
                  <tr>
                    <td colSpan={2} style={{ padding: '8px 0 0' }}>
                      <div style={{ border: '2px solid #1a0a00', borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf7f4' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a0a00', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NET PAY</span>
                        <span style={{ fontSize: 22, fontWeight: 700, color: '#1a0a00', letterSpacing: '-0.5px' }}>
                          Ksh {formatCurrency(payslip.netPay)}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── PAYMENT DETAILS ─────────────────────────────── */}
            <div style={{ border: '1px solid #e7e5e4', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a8a29e', marginBottom: 8 }}>
                PAYMENT DETAILS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                <div>
                  <span style={{ color: '#a8a29e' }}>Bank: </span>
                  <span style={{ color: '#1a0a00', fontWeight: 500 }}>{payslip.user.employeeProfile?.bankName ?? '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#a8a29e' }}>Branch: </span>
                  <span style={{ color: '#1a0a00', fontWeight: 500 }}>{payslip.user.employeeProfile?.bankBranch ?? '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#a8a29e' }}>A/C: </span>
                  <span style={{ color: '#1a0a00', fontWeight: 500 }}>
                    {payslip.user.employeeProfile?.accountNumber
                      ? `•••• •••• ${payslip.user.employeeProfile.accountNumber.slice(-4)}`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#a8a29e' }}>Name: </span>
                  <span style={{ color: '#1a0a00', fontWeight: 500 }}>{payslip.user.employeeProfile?.accountName ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* ── SIGNATURE LINES ─────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, fontFamily: 'system-ui, sans-serif', fontSize: 11, color: '#a8a29e', marginTop: 8 }}>
              <div>
                <div style={{ borderBottom: '1px solid #d6d3d1', paddingBottom: 4, marginBottom: 4 }}>
                  Prepared by: ___________________________
                </div>
                <div>Date: _______________</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #d6d3d1', paddingBottom: 4, marginBottom: 4 }}>
                  Employee signature: ___________________________
                </div>
                <div>Date: _______________</div>
              </div>
            </div>

            {/* Screen-only footer */}
            <div className="print:hidden" style={{ marginTop: 16, fontSize: 11, color: '#a8a29e', fontFamily: 'system-ui, sans-serif' }}>
              Created by {payslip.createdBy.name} on {formatShortDate(payslip.createdAt)}
            </div>

          </div>
        </>
      )}
    </Modal>
  );
}
