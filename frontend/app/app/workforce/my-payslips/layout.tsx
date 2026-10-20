import { PayslipGate } from '@/features/workforce/payslips';

/** My payslips route group. Routing only: every page inside sits behind the payslip code. */
export default function MyPayslipsLayout({ children }: { children: React.ReactNode }) {
  return <PayslipGate>{children}</PayslipGate>;
}
