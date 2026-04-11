import { NextRequest, NextResponse } from 'next/server'
import { findDoctorByEmail } from '@/lib/portal-store'
import { verifyPassword, createSessionToken } from '@/lib/portal-auth'

// In-memory rate limiter: 5 attempts per IP per minute
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (record.count >= 5) return false

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429 }
    )
  }

  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const doctor = findDoctorByEmail(email)
  if (!doctor) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await verifyPassword(password, doctor.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: doctor.id,
    email: doctor.email,
    name: doctor.name,
    role: doctor.role,
  })

  const isProduction = process.env.NODE_ENV === 'production'
  const response = NextResponse.json({
    success: true,
    user: { id: doctor.id, name: doctor.name, email: doctor.email, role: doctor.role },
  })

  response.cookies.set('portal-session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })

  return response
}
