import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { roleHome } from '@/lib/role-home';
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

const isAllowedPath = (pathname: string, role: AppRole): boolean => {
  if (pathname.startsWith('/app/profile')) {
    return true;
  }

  if (pathname === '/app/admin/menu' || pathname.startsWith('/app/admin/menu/')) {
    return role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';
  }

  if (pathname === '/app/admin/discounts' || pathname.startsWith('/app/admin/discounts/')) {
    return role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';
  }

  if (pathname === '/app/manage/my-tab') {
    return role === 'MANAGER' || role === 'DIRECTOR';
  }
  if (pathname === '/app/manage/settings' || pathname.startsWith('/app/manage/settings/')) {
    return false; // Directors use /app/director/settings; managers no longer have access
  }
  if (pathname.startsWith('/app/manage')) {
    return role === 'MANAGER';
  }
  if (pathname.startsWith('/app/director')) {
    return role === 'DIRECTOR';
  }
  if (pathname.startsWith('/app/admin')) {
    return role === 'SYSTEM_ADMIN';
  }
  if (pathname.startsWith('/app/kitchen')) {
    return role === 'KITCHEN_DISPLAY' || role === 'CHEF';
  }
  if (pathname.startsWith('/app/barista')) {
    return role === 'BARISTA_DISPLAY' || role === 'BARISTA';
  }

  if (pathname.startsWith('/app/orders')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'MANAGER';
  }

  if (pathname.startsWith('/app/history')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN' || role === 'ACCOUNTANT' || role === 'HR_MANAGER';
  }

  if (pathname.startsWith('/app/other-income')) {
    return role === 'WAITER' || role === 'MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  if (pathname.startsWith('/app/inbox')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'MANAGER' || role === 'DIRECTOR' || role === 'ACCOUNTANT' || role === 'HR_MANAGER' || role === 'SYSTEM_ADMIN' || role === 'STEWARD' || role === 'HOUSEKEEPING' || role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT';
  }

  if (pathname.startsWith('/app/hr')) {
    // HR entry sheet and management: HR_MANAGER, DIRECTOR, SYSTEM_ADMIN only
    // my-leave: all human staff
    if (pathname === '/app/hr/my-leave') {
      return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA'
        || role === 'ACCOUNTANT' || role === 'MANAGER' || role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN' || role === 'STEWARD' || role === 'HOUSEKEEPING' || role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT';
    }
    return role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  }

  if (pathname.startsWith('/app/accountant')) {
    return role === 'ACCOUNTANT';
  }

  if (pathname.startsWith('/app/inventory')) {
    // Session 6 ships Attendant's mobile screens only; Manager's desktop/mobile
    // screens (Sessions 7/8) will extend this once built.
    return role === 'STORE_MANAGER' || role === 'STORE_ATTENDANT';
  }

  if (pathname === '/app/payslips' || pathname.startsWith('/app/payslips/')) {
    return role === 'WAITER'
      || role === 'CHEF'
      || role === 'BARISTA'
      || role === 'MANAGER'
      || role === 'HR_MANAGER'
      || role === 'DIRECTOR'
      || role === 'ACCOUNTANT'
      || role === 'SYSTEM_ADMIN'
      || role === 'STEWARD'
      || role === 'HOUSEKEEPING'
      || role === 'STORE_MANAGER'
      || role === 'STORE_ATTENDANT';
  }

  if (pathname.startsWith('/app')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' || role === 'STEWARD' || role === 'HOUSEKEEPING';
  }

  return true;
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

    if (!isAllowedPath(pathname, role)) {
      return NextResponse.redirect(new URL(roleHome[role], request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/app/:path*'],
};
