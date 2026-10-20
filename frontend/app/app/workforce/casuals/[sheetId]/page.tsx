import { SheetScreen } from '@/features/workforce/casual';

export default function CasualSheetPage({ params }: { params: { sheetId: string } }) {
  return <SheetScreen id={params.sheetId} />;
}
