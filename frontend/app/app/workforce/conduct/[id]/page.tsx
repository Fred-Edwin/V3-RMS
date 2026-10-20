import { redirect } from 'next/navigation';

import { DESK_HOME } from '@/features/workforce/conduct';

/** One notice on the desk is the list with that notice chosen: the address `?id=` is the single way to name it. */
export default function ConductDeskNoticePage({ params }: { params: { id: string } }) {
  redirect(`${DESK_HOME}?id=${encodeURIComponent(params.id)}`);
}
