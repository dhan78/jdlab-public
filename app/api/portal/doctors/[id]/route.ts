import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken, hashPassword } from '@/lib/portal-auth'
import { findDoctorById, findDoctorByEmail, removeDoctorById, updateDoctor } from '@/lib/portal-store'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function requireAdmin(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie')
  const token = getSessionFromCookies(cookieHeader)
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  if (session.role !== 'admin') return null
  return session
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const cookieHeader = request.headers.get('cookie')
  const token = getSessionFromCookies(cookieHeader)
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const session = await verifySessionToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Prevent self-deletion
  if (session.sub === id) {
    return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 403 })
  }

  const doctor = await findDoctorById(id)
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  await removeDoctorById(id)

  return NextResponse.json({ success: true, message: 'Doctor account removed' })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await requireAdmin(request)
  if (!session) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const target = await findDoctorById(id)
  if (!target) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Admin accounts cannot be edited here' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const fields: {
    name?: string
    email?: string
    role?: 'doctor' | 'planner'
    practiceName?: string
    practiceAddress?: string
    phone?: string
    passwordHash?: string
  } = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (name.length > 200) return NextResponse.json({ error: 'Name must be 200 characters or fewer' }, { status: 400 })
    fields.name = name
  }

  if (body.email !== undefined) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    const existing = await findDoctorByEmail(email)
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'A doctor with this email already exists' }, { status: 409 })
    }
    fields.email = email
  }

  if (body.role !== undefined) {
    fields.role = body.role === 'planner' ? 'planner' : 'doctor'
  }

  if (body.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (phone.length > 30) return NextResponse.json({ error: 'Phone is too long' }, { status: 400 })
    fields.phone = phone
  }

  if (body.practiceName !== undefined) {
    const practiceName = typeof body.practiceName === 'string' ? body.practiceName.trim() : ''
    if (practiceName.length > 200) return NextResponse.json({ error: 'Practice name is too long' }, { status: 400 })
    fields.practiceName = practiceName
  }

  if (body.practiceAddress !== undefined) {
    const practiceAddress = typeof body.practiceAddress === 'string' ? body.practiceAddress.trim() : ''
    if (practiceAddress.length > 400) return NextResponse.json({ error: 'Practice address is too long' }, { status: 400 })
    fields.practiceAddress = practiceAddress
  }

  if (typeof body.password === 'string' && body.password !== '') {
    if (body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (body.password.length > 128) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
    }
    fields.passwordHash = await hashPassword(body.password)
  }

  const updated = await updateDoctor(id, fields)
  if (!updated) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    doctor: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      practiceName: updated.practiceName,
      practiceAddress: updated.practiceAddress,
      phone: updated.phone,
    },
  })
}
