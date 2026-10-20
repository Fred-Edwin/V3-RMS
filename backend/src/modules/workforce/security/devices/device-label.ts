const BRANDS: [RegExp, string][] = [
  [/tecno/i, 'Tecno'],
  [/infinix/i, 'Infinix'],
  [/itel/i, 'Itel'],
  [/SM-[A-Z]\d|samsung/i, 'Samsung'],
  [/Pixel \d/i, 'Pixel'],
  [/redmi|xiaomi|poco|mi \d/i, 'Xiaomi'],
  [/huawei|honor/i, 'Huawei'],
  [/oppo|cph\d/i, 'Oppo'],
  [/vivo/i, 'Vivo'],
  [/nokia/i, 'Nokia'],
];

/**
 * "Tecno, Android" from a User-Agent: the phone's make when the browser says it, then the system. A label for people to recognise a
 * phone by, never an identifier. The browser's random device id is the identifier and it is never shown.
 */
export function phoneLabelOf(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown phone';
  const os = /Android/i.test(userAgent) ? 'Android' : /iPhone|iPad|iPod/i.test(userAgent) ? 'iPhone' : /Windows/i.test(userAgent) ? 'Windows' : /Mac OS X/i.test(userAgent) ? 'Mac' : /Linux/i.test(userAgent) ? 'Linux' : null;
  const brand = os === 'Android' ? (BRANDS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null) : null;
  return [brand, os].filter((p): p is string => p !== null).join(', ') || 'Unknown phone';
}

const COUNTRIES: Record<string, string> = { KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda', ET: 'Ethiopia', US: 'United States', GB: 'United Kingdom' };

type HeaderReader = (name: string) => string | undefined;

/**
 * A coarse place such as "Nyeri, Kenya" from the location headers the Cloudflare tunnel adds (`cf-ipcity`, `cf-ipcountry`). The
 * address itself is never read or stored. When the tunnel sends nothing the place is unknown (null) and the screens say so.
 */
export function placeLabelOf(header: HeaderReader): string | null {
  const city = header('cf-ipcity')?.trim().slice(0, 60) || null;
  const code = header('cf-ipcountry')?.trim().toUpperCase();
  const country = code && /^[A-Z]{2}$/.test(code) ? (COUNTRIES[code] ?? code) : null;
  return [city, country].filter((p): p is string => p !== null).join(', ') || null;
}
