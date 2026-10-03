/**
 * Wire names: the one place that knows the old "organization" spellings.
 *
 * In code an Organization is a Site (a branch or the Central Store). The API, socket
 * events and the login token still say "organization", because the frontend is deployed
 * separately (Vercel) from the API and a renamed field would break the live app between
 * the two deploys. Everything leaving the process goes through `toWire`; everything
 * arriving goes through `fromWire`. Both are safe to call on already-translated data, so
 * old cached values, queued jobs and clients that already send the new names keep working.
 *
 * Only plain objects and arrays are walked. Dates, Prisma Decimals, Buffers and other class
 * instances are left alone (they serialise themselves).
 */

const SITE_TO_WIRE: Record<string, string> = {
  site: 'organization',
  sites: 'organizations',
  siteId: 'organizationId',
  siteIds: 'organizationIds',
  siteName: 'organizationName',
  fromSite: 'fromOrganization',
  fromSiteId: 'fromOrganizationId',
  toSite: 'toOrganization',
  toSiteId: 'toOrganizationId',
  toSiteName: 'toOrganizationName',
  requestedSiteId: 'requestedOrganizationId',
  targetSiteId: 'targetOrganizationId',
  hubSiteId: 'hubOrganizationId',
  hubSiteIds: 'hubOrganizationIds',
  orderSiteId: 'orderOrganizationId',
  storeSiteId: 'storeOrganizationId',
  catalogSiteId: 'catalogOrganizationId',
  actorSiteId: 'actorOrganizationId',
};

const WIRE_TO_SITE: Record<string, string> = Object.fromEntries(
  Object.entries(SITE_TO_WIRE).map(([site, wire]) => [wire, site]),
);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const translate = (value: unknown, map: Record<string, string>): unknown => {
  if (Array.isArray(value)) return value.map((item) => translate(item, map));
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[(Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined) ?? key] = translate(inner, map);
  }
  return out;
};

/** A key as the wire spells it, e.g. `siteId` -> `organizationId`. Unknown keys pass through. */
export const keyToWire = (key: string): string =>
  (Object.prototype.hasOwnProperty.call(SITE_TO_WIRE, key) ? SITE_TO_WIRE[key] : undefined) ?? key;

/** Code names -> wire names. Apply to anything sent out (responses, socket events). */
export const toWire = <T>(value: T): T => translate(value, SITE_TO_WIRE) as T;

/** Wire names -> code names. Apply to anything received (bodies, queries, socket payloads, token claims). */
export const fromWire = <T>(value: T): T => translate(value, WIRE_TO_SITE) as T;
