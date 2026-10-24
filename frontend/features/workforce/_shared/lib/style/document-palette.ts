/**
 * Colours of the printed Workforce documents (Paper 1E9N-0 leave slip, and the rota print, timesheet,
 * payslip, pay run summary and voucher). A printed page has its own palette, the way the LPO print page
 * does (`#0B2A4A`, `#D5DCE4`); it is not drawn from the screen's tokens, which are warm browns.
 *
 * The design system has no navy token. These four values are Paper's and live here, once, so a
 * document never carries a hex of its own. If the owner wants a navy token, only this file changes.
 */
export const DOC_COLOURS = {
  /** The 10 px top bar and the headings. */
  navy: '#14284B',
  /** Body text. */
  ink: '#111111',
  /** The hairlines under the header and over the footer. */
  rule: '#D8DEE9',
} as const;

/** A4 at 96 dpi, as Paper draws it. */
export const DOC_PAGE = {
  portrait: { width: 794, height: 1123 },
  landscape: { width: 1123, height: 794 },
} as const;

export type DocOrientation = keyof typeof DOC_PAGE;
