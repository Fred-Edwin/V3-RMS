import { WasntMePage } from '@/features/workforce/security';

export default function WasntMeRoute({ searchParams }: { searchParams: { entry?: string } }) {
  return <WasntMePage entry={searchParams.entry} />;
}
