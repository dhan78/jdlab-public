import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  })

  response.cookies.set('portal-session', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })

  return response
}
