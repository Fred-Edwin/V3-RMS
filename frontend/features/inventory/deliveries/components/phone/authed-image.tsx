'use client';

import * as React from 'react';

import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';

/**
 * A photo from the delivery. Its `url` is an AUTHENTICATED link (Amendment 1 row 6): it is fetched with the login token and shown
 * from a local object URL. A local `blob:` or `data:` address (a photo just chosen, or the mock) is shown as it is.
 */
export function AuthedImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const token = useAuthStore((s) => s.accessToken);
  const [src, setSrc] = React.useState<string | null>(() => (url.startsWith('blob:') || url.startsWith('data:') ? url : null));
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (url === '' || url.startsWith('blob:') || url.startsWith('data:')) {
      setSrc(url === '' ? null : url);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    const full = url.startsWith('http') ? url : `${env.apiUrl.replace(/\/api\/v1\/?$/, '')}${url.startsWith('/api/') ? '' : '/api/v1'}${url}`;
    fetch(full, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('photo'))))
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token]);

  if (!src || failed) {
    return (
      <span role="img" aria-label={failed ? `${alt} (could not load)` : alt} className={className}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="m-auto text-wds-neutral-400">
          <path d="M4 6h16v12H4zM8 11l3 3 2-2 4 4M9 9h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- a local object URL of an authenticated photo; next/image cannot optimise it.
  return <img src={src} alt={alt} className={className} />;
}
