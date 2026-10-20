import { PayslipDocumentScreen } from '@/features/workforce/payslips';

export default function MyPayslipDocumentPage({ params }: { params: { id: string } }) {
  return <PayslipDocumentScreen id={params.id} />;
}
