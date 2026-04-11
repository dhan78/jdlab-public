import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie')
  const token = getSessionFromCookies(cookieHeader)

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const session = await verifySessionToken(token)
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  })
}
