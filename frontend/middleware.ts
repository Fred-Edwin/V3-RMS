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
  'SYSTEM_ADMIN',
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

  if (pathname.startsWith('/app')) {
    return role === 'WAITER' || role === 'CHEF' || role === 'BARISTA';
  }

  return true;
};

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('accessToken')?.value;

  if (pathname.startsWith('/app') && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (PUBLIC_PATHS.includes(pathname) && token) {
    const role = decodeRole(token);
    if (!role) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL(roleHome[role], request.url));
  }

  if (pathname.startsWith('/app') && token) {
    const role = decodeRole(token);
    if (!role) {
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
