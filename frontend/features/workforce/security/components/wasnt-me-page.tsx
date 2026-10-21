'use client';

import { WasntMeScreen } from './wasnt-me-screen';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The route's body: the entry the person is answering comes from the address; anything that is not an id is dropped. */
export function WasntMePage({ entry }: { entry?: string }) {
  return <WasntMeScreen entryId={entry && UUID.test(entry) ? entry : undefined} />;
}
