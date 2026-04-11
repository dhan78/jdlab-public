import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { findDoctorById, removeDoctorById } from '@/lib/portal-store'

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

  const doctor = findDoctorById(id)
  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  removeDoctorById(id)

  return NextResponse.json({ success: true, message: 'Doctor account removed' })
}
