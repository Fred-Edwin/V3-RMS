/** `GET /workforce/page-for?path=...`: who a page is for, from the access table, for the refusal screen (Paper 10.1, 10.2). */
export interface PageFor {
  page: string;
  forWords: string | null;
  roles: string[];
  reference: string;
  instead: { line: string; label: string; href: string } | null;
  homeLabel: 'Overview' | 'Home';
}
