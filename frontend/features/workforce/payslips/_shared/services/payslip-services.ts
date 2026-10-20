import { deviceId } from '../lib/device-id';
import type { FileBlob, HistoryData, HomeData, LockedList, OpenPurpose, P9Card, PayslipDetail, Unlocked, VersionInfo } from '../types/payslip-types';
import { openFile, payslipFile, payslipJson } from './payslip-http';

/** One function per endpoint of API_CONTRACT §42 that the phone and the HR path use. */
const BASE = '/workforce/payslips';
const versionQuery = (version: number | null): string => (version ? `v=${version}` : '');
const withQuery = (...parts: string[]): string => {
  const q = parts.filter(Boolean).join('&');
  return q ? `?${q}` : '';
};

export const payslipReads = {
  /** S1: months and pay days, no amounts, no code needed. */
  list: (): Promise<LockedList> => payslipJson(`${BASE}/me`),
  home: (): Promise<HomeData> => payslipJson(`${BASE}/me/home`, { unlock: true }),
  history: (year?: number): Promise<HistoryData> => payslipJson(`${BASE}/me/history${withQuery(year ? `year=${year}` : '')}`, { unlock: true }),
  detail: (id: string, version: number | null): Promise<PayslipDetail> => payslipJson(`${BASE}/me/${id}${withQuery(versionQuery(version))}`, { unlock: true }),
  versions: (id: string): Promise<VersionInfo[]> => payslipJson(`${BASE}/me/${id}/versions`, { unlock: true }),
  p9: (year: number): Promise<P9Card & { formatConfirmed: boolean }> => payslipJson(`${BASE}/me/p9/${year}`),
  /** The stored A4 file. The purpose is recorded with the opening. */
  document: (id: string, version: number | null, purpose: OpenPurpose): Promise<FileBlob> =>
    payslipFile(`${BASE}/me/${id}/document${withQuery(versionQuery(version), `purpose=${purpose}`)}`, 'Payslip.pdf'),
  p9Document: (year: number): Promise<FileBlob> => payslipFile(`${BASE}/me/p9/${year}/document`, `P9-${year}.pdf`),
};

export const payslipWrites = {
  /** `403 CODE_WRONG` (maybe with `details.waitSeconds`), `429 CODE_SLOWED`, `409 NO_CODE_SET`. */
  unlock: (code: string): Promise<Unlocked> => payslipJson(`${BASE}/me/unlock`, { method: 'POST', body: { code, deviceId: deviceId() } }),
  /** A first code; it also opens the payslips. `409 CODE_EXISTS` when one is set. */
  setCode: (code: string): Promise<Unlocked> => payslipJson(`${BASE}/me/code`, { method: 'POST', body: { code, deviceId: deviceId() } }),
  lock: (): Promise<void> => payslipJson(`${BASE}/me/lock`, { method: 'POST', body: { deviceId: deviceId() } }),
};

/** HR and the Accountant: anyone's published payslip, no staff code, every opening recorded. */
export const payslipOthers = {
  detail: (id: string, version: number | null): Promise<PayslipDetail> => payslipJson(`${BASE}/${id}${withQuery(versionQuery(version))}`),
  document: (id: string, version: number | null, purpose: OpenPurpose): Promise<FileBlob> =>
    openFile(`${BASE}/${id}/document${withQuery(versionQuery(version), `purpose=${purpose}`)}`, 'Payslip.pdf'),
  /** The Accountant, once: the P9 layout is right. */
  confirmP9Format: (pin: string): Promise<{ layoutVersion: number; confirmed: true; already: boolean }> => payslipJson(`${BASE}/p9/format/confirm`, { method: 'POST', body: { pin } }),
  /** HR or the Accountant: a leaver's tax card. */
  p9ForPerson: (year: number, employeeId: string): Promise<FileBlob> => openFile(`${BASE}/p9/${year}/people/${employeeId}/generate`, `P9-${year}.pdf`, 'POST'),
};
