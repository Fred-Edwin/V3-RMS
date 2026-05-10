'use client';

import { Printer } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import type { Payslip } from '@/types/payslip';
import { formatCurrency, formatPayPeriod } from './payslip-utils';

interface PayslipTableProps {
  payslips: Payslip[];
  emptyHeading: string;
  emptyBody: string;
  showBranch?: boolean;
  onView: (payslip: Payslip) => void;
}

const ROLE_ORDER: Record<string, number> = {
  DIRECTOR: 0,
  HR_MANAGER: 1,
  MANAGER: 2,
  ACCOUNTANT: 3,
  CHEF: 4,
  BARISTA: 5,
  WAITER: 6,
};

function sortByRole(a: Payslip, b: Payslip): number {
  const ra = ROLE_ORDER[a.user.role] ?? 99;
  const rb = ROLE_ORDER[b.user.role] ?? 99;
  if (ra !== rb) return ra - rb;
  return a.user.name.localeCompare(b.user.name);
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#a8a29e',
  textAlign: 'left',
  borderBottom: '1px solid #e7e5e4',
  background: '#fafaf9',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: '#1a0a00',
  borderBottom: '1px solid #f0ece8',
  verticalAlign: 'middle',
};

export function PayslipTable({
  payslips,
  emptyHeading,
  emptyBody,
  showBranch = true,
  onView,
}: PayslipTableProps): JSX.Element {
  const sorted = [...payslips].sort(sortByRole);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<Printer size={22} />}
        heading={emptyHeading}
        body={emptyBody}
        className="py-16"
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'system-ui, sans-serif' }}>
        <thead>
          <tr>
            <th style={thStyle}>Staff Member</th>
            {showBranch && <th style={thStyle}>Branch</th>}
            <th style={{ ...thStyle, textAlign: 'right' }}>Period</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Gross Pay</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Deductions</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Net Pay</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, idx) => {
            const isEven = idx % 2 === 1;
            const rowBg = isEven ? '#fafaf9' : '#ffffff';
            return (
              <tr key={p.id} style={{ background: rowBg }}>
                {/* Staff Member */}
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: '#1a0a00' }}>{p.user.name}</div>
                  <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 1 }}>
                    {p.user.employeeProfile?.jobTitle ?? p.user.role.replace(/_/g, ' ')}
                  </div>
                </td>

                {/* Branch */}
                {showBranch && (
                  <td style={{ ...tdStyle, color: '#57534e', fontSize: 12 }}>{p.organization.name}</td>
                )}

                {/* Period */}
                <td style={{ ...tdStyle, textAlign: 'right', color: '#57534e', whiteSpace: 'nowrap' }}>
                  {formatPayPeriod(p.payPeriod)}
                </td>

                {/* Gross Pay */}
                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  Ksh {formatCurrency(p.grossPay)}
                </td>

                {/* Deductions */}
                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', color: '#dc2626', fontWeight: 500 }}>
                  Ksh {formatCurrency(p.totalDeductions)}
                </td>

                {/* Net Pay */}
                <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap', color: '#15803d', fontWeight: 700 }}>
                  Ksh {formatCurrency(p.netPay)}
                </td>

                {/* Status — text only, no pill */}
                <td style={tdStyle}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: p.isLocked ? '#15803d' : '#d97706',
                  }}>
                    {p.isLocked ? 'Published' : 'Draft'}
                  </span>
                </td>

                {/* Actions — Print only, only when published */}
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {p.isLocked && (
                    <button
                      onClick={() => onView(p)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: '1px solid #e7e5e4',
                        background: 'white',
                        color: '#57534e',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Printer size={13} />
                      Print
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
