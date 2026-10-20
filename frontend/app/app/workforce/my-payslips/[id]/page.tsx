import { PayslipDetailScreen } from '@/features/workforce/payslips';

export default function MyPayslipPage({ params }: { params: { id: string } }) {
  return <PayslipDetailScreen id={params.id} />;
}
