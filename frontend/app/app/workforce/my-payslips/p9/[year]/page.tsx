import { notFound } from 'next/navigation';

import { PayslipDocumentScreen } from '@/features/workforce/payslips';

export default function MyP9Page({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) notFound();
  return <PayslipDocumentScreen kind="p9" year={year} />;
}
