import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken, hashPassword } from '@/lib/portal-auth'
import { listDoctors, addDoctor, findDoctorByEmail } from '@/lib/portal-store'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function requireAdmin(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie')
  const token = getSessionFromCookies(cookieHeader)
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  return session
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const doctors = listDoctors().map(({ id, name, email, role, createdAt, practiceName, practiceAddress, phone }) => ({
    id, name, email, role, createdAt, practiceName, practiceAddress, phone,
  }))

  return NextResponse.json({ doctors, total: doctors.length })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  let body: { name?: unknown; email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const practiceName = typeof (body as Record<string, unknown>).practiceName === 'string' ? ((body as Record<string, unknown>).practiceName as string).trim() : undefined
  const practiceAddress = typeof (body as Record<string, unknown>).practiceAddress === 'string' ? ((body as Record<string, unknown>).practiceAddress as string).trim() : undefined
  const phone = typeof (body as Record<string, unknown>).phone === 'string' ? ((body as Record<string, unknown>).phone as string).trim() : undefined

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  if (name.length > 200) {
    return NextResponse.json({ error: 'Name must be 200 characters or fewer' }, { status: 400 })
  }

  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  if (password.length > 128) {
    return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
  }

  if (findDoctorByEmail(email)) {
    return NextResponse.json({ error: 'A doctor with this email already exists' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const doctor = addDoctor({ name, email, passwordHash, role: 'doctor', practiceName: practiceName || undefined, practiceAddress: practiceAddress || undefined, phone: phone || undefined })

  return NextResponse.json(
    {
      success: true,
      doctor: { id: doctor.id, name: doctor.name, email: doctor.email, role: doctor.role, createdAt: doctor.createdAt, practiceName: doctor.practiceName, practiceAddress: doctor.practiceAddress, phone: doctor.phone },
    },
    { status: 201 }
  )
}
