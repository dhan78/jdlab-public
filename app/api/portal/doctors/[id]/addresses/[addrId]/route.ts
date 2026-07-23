import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import { removePracticeAddress, updatePracticeAddress } from '@/lib/portal-store'

async function authorize(request: NextRequest, id: string) {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  if (session.role === 'admin' || session.sub === id) return session
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addrId: string }> }
) {
  const { id, addrId } = await params
  const session = await authorize(request, id)
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const fields: { address?: string; label?: string; isPreferred?: boolean } = {}

  if (body.address !== undefined) {
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    if (address.length > 400) return NextResponse.json({ error: 'Address is too long' }, { status: 400 })
    fields.address = address
  }

  if (body.label !== undefined) {
    const label = typeof body.label === 'string' ? body.label.trim() : ''
    if (label.length > 100) return NextResponse.json({ error: 'Label is too long' }, { status: 400 })
    fields.label = label
  }

  if (body.isPreferred === true) {
    fields.isPreferred = true
  }

  const updated = await updatePracticeAddress(id, addrId, fields)
  if (!updated) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, address: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addrId: string }> }
) {
  const { id, addrId } = await params
  const session = await authorize(request, id)
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const removed = await removePracticeAddress(id, addrId)
  if (!removed) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
