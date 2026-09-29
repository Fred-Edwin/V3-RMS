/**
 * Central Store team (Pre-Demo Fixes) — a Store Manager's hub-org attendants.
 * Mirrors `GET /staff` for a STORE_MANAGER actor (docs/API_CONTRACT.md §6,
 * "Store Manager team management"). `hasPin` is a boolean; the PIN hash never
 * reaches the client.
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'STORE_ATTENDANT';
  isActive: boolean;
  organizationId: string | null;
  hasPin: boolean;
}

export interface AddAttendantInput {
  name: string;
  email: string;
  temporaryPassword: string;
}
