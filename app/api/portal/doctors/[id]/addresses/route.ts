import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { addPracticeAddress, findDoctorById, listPracticeAddresses } from '@/lib/portal-store'

// Allowed if the caller is an admin, or the doctor acting on their own record.
async function authorize(request: NextRequest, id: string) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  if (session.role === 'admin' || session.sub === id) return session
  return null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await authorize(request, id)
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const doctor = await findDoctorById(id)
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  const addresses = await listPracticeAddresses(id)
  return NextResponse.json({ addresses })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await authorize(request, id)
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const doctor = await findDoctorById(id)
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const address = typeof body.address === 'string' ? body.address.trim() : ''
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }
  if (address.length > 400) {
    return NextResponse.json({ error: 'Address is too long' }, { status: 400 })
  }

  const label = typeof body.label === 'string' ? body.label.trim() : undefined
  if (label && label.length > 100) {
    return NextResponse.json({ error: 'Label is too long' }, { status: 400 })
  }

  const isPreferred = body.isPreferred === true

  const created = await addPracticeAddress({ userId: id, address, label, isPreferred })
  return NextResponse.json({ success: true, address: created }, { status: 201 })
}
