import { SheetDocumentScreen } from '@/features/workforce/casual';

export default function CasualSheetDocumentPage({ params }: { params: { sheetId: string } }) {
  return <SheetDocumentScreen id={params.sheetId} />;
}
