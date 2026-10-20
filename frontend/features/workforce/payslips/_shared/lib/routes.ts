/** Where the payslip screens live. The old payslip page keeps `/app/payslips` until every branch has moved (PD12). */
export const PAYSLIP_HOME = '/app/workforce/my-payslips';
const versionPart = (version?: number | null): string => (version ? `?v=${version}` : '');
export const payslipHref = (id: string, version?: number | null): string => `${PAYSLIP_HOME}/${id}${versionPart(version)}`;
export const payslipDocumentHref = (id: string, version?: number | null): string => `${PAYSLIP_HOME}/${id}/document${versionPart(version)}`;
export const PAYSLIP_HISTORY = `${PAYSLIP_HOME}/history`;
export const p9Href = (year: number): string => `${PAYSLIP_HOME}/p9/${year}`;
