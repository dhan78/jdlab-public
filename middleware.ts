import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

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
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(cookieToken, key)

    // Admin-only routes require admin role
    if (pathname.startsWith('/portal/admin') && payload.role !== 'admin') {
      const loginUrl = new URL('/portal/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Token is valid — pass through.
    const response = NextResponse.next()

    // Sliding refresh: re-issue the session with a fresh 7-day window when the
    // current token is older than the refresh interval, so a doctor who visits
    // even once a week effectively stays logged in. Throttled to at most once
    // per hour of activity to avoid re-signing on every navigation.
    const nowSec = Math.floor(Date.now() / 1000)
    const iat = typeof payload.iat === 'number' ? payload.iat : 0
    const REFRESH_AFTER_SEC = 60 * 60 // 1 hour
    if (nowSec - iat > REFRESH_AFTER_SEC) {
      const fresh = await new SignJWT({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(key)
      response.cookies.set('portal-session', fresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })
    }
    return response
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
