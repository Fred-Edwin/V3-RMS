import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { roleHome } from '@/lib/role-home';
import { isAllowedPath } from '@/lib/route-access';
import type { AppRole } from '@/types/auth';

const PUBLIC_PATHS = ['/login'];

const allRoles: AppRole[] = [
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
  'MANAGER',
  'DIRECTOR',
  'ACCOUNTANT',
  'HR_MANAGER',
  'SYSTEM_ADMIN',
  'STEWARD',
  'HOUSEKEEPING',
  'STORE_MANAGER',
  'STORE_ATTENDANT',
];

const decodeRole = (token: string): AppRole | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { role?: string };
    const role = payload.role;

    if (typeof role === 'string' && allRoles.includes(role as AppRole)) {
      return role as AppRole;
    }
  } catch {
    return null;
  }

  return null;
};

/** Read the `isDepartmentHead` marker claim from the JWT (marker model, 2026-09-03). */
const decodeIsDepartmentHead = (token: string): boolean => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return false;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { isDepartmentHead?: boolean };
    return payload.isDepartmentHead === true;
  } catch {
    return false;
  }
};

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('accessToken')?.value;
  const hasRefreshToken = request.cookies.has('refreshToken');

  if (pathname.startsWith('/app') && !token) {
    // If a refresh token exists, let the request through so the client-side
    // SessionBootstrap can silently obtain a new access token.
    if (hasRefreshToken) {
      return NextResponse.next();
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    if (token) {
      const role = decodeRole(token);
      if (role) {
        return NextResponse.redirect(new URL(roleHome[role], request.url));
      }
    }

    return NextResponse.next();
  }

  if (pathname.startsWith('/app') && token) {
    const role = decodeRole(token);
    if (!role) {
      // Token present but undecodable. If a refresh token exists, let the
      // client attempt a silent refresh instead of hard-redirecting to login.
      if (hasRefreshToken) {
        return NextResponse.next();
      }

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!isAllowedPath(pathname, role, decodeIsDepartmentHead(token))) {
      return NextResponse.redirect(new URL(roleHome[role], request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/app/:path*'],
};
