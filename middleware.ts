import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// Public portal routes that don't require authentication
const PUBLIC_PORTAL_PATHS = [
  '/portal/login',
  '/portal/forgot-password',
  '/portal/reset-password',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only handle /portal/* routes
  if (!pathname.startsWith('/portal')) {
    return NextResponse.next()
  }

  // Allow public portal paths through
  if (PUBLIC_PORTAL_PATHS.some(p => pathname === p || pathname.startsWith(p + '?'))) {
    return NextResponse.next()
  }

  const cookieToken = request.cookies.get('portal-session')?.value

  // No token — redirect to login
  if (!cookieToken) {
    const loginUrl = new URL('/portal/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  const secret = process.env.PORTAL_JWT_SECRET
  if (!secret) {
    // Misconfiguration — redirect to login
    const loginUrl = new URL('/portal/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const { payload } = await jwtVerify(
      cookieToken,
      new TextEncoder().encode(secret)
    )

    // Admin-only routes require admin role
    if (pathname.startsWith('/portal/admin') && payload.role !== 'admin') {
      const loginUrl = new URL('/portal/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Token is valid — pass through
    return NextResponse.next()
  } catch (err: unknown) {
    // Distinguish expired vs. invalid token
    const loginUrl = new URL('/portal/login', request.url)
    const isExpired =
      err instanceof Error && err.message?.includes('exp')
    if (isExpired) {
      loginUrl.searchParams.set('expired', 'true')
    }
    const response = NextResponse.redirect(loginUrl)
    // Clear invalid cookie
    response.cookies.set('portal-session', '', { maxAge: 0, path: '/' })
    return response
  }
}

export const config = {
  matcher: ['/portal/:path*'],
}
