import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that require admin role
const adminOnlyRoutes = [
  '/users',
  '/api/users',
  '/api/smtp',
];

// Routes that are public (no authentication required)
const publicPaths = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for authentication token
  const token = await getToken({
    req: request,
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  });

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check for admin-only routes
  const isAdminRoute = adminOnlyRoutes.some(route => pathname.startsWith(route));
  
  if (isAdminRoute && token.role !== 'admin') {
    // For API routes, return 403 Forbidden
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }
    
    // For page routes, redirect to dashboard with error
    const dashboardUrl = new URL('/', request.url);
    dashboardUrl.searchParams.set('error', 'access_denied');
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
