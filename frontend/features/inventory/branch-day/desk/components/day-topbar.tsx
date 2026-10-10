'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import { useDayBase } from '../hooks/use-day-access';

/**
 * The top bar of every Branch day desktop screen: breadcrumb and "Search a day" (⌘K), 420 wide at most (Paper C13). Pressing Enter
 * opens History filtered to what was typed (a day number); contract gap G9's result list under the box is History's own search.
 */
export function DayTopbar({ breadcrumb, actions }: { breadcrumb: TopbarBreadcrumb; actions?: React.ReactNode }) {
  const router = useRouter();
  const base = useDayBase();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Topbar
      breadcrumb={breadcrumb}
      actions={actions}
      searchRef={inputRef}
      searchProps={{
        placeholder: 'Search a day',
        'aria-label': 'Search a day',
        value: text,
        className: 'w-full max-w-[420px] grow',
        onChange: (e) => setText(e.target.value),
        onKeyDown: (e) => {
          if (e.key === 'Enter' && text.trim() !== '') {
            e.preventDefault();
            router.push(`${base}/history?search=${encodeURIComponent(text.trim())}`);
            setText('');
          } else if (e.key === 'Escape') {
            setText('');
            e.currentTarget.blur();
          }
        },
      }}
    />
  );
}
