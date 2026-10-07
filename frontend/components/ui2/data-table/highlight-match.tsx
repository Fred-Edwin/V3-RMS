import * as React from 'react';

import { splitMatches } from './table-query';

/** Text with the letters that match the search in bold (§4a item 2). Use it in the cells people search by, passing `term` from the cell context. */
export function HighlightMatch({ text, term }: { text: string; term: string }) {
  const segments = splitMatches(text, term);
  if (segments.length === 1 && !segments[0]!.match) return <>{text}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <strong key={i} className="font-semibold text-wds-text-ink">
            {s.text}
          </strong>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        )
      )}
    </>
  );
}
