import { NextRequest, NextResponse } from 'next/server'
import { verifyResetToken, hashPassword } from '@/lib/portal-auth'
import { findValidResetToken, markResetTokenUsed, updateDoctorPassword } from '@/lib/portal-store'

export async function POST(request: NextRequest) {
  let body: { token?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  if (password.length > 128) {
    return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
  }

  // Verify JWT signature and expiry
  const jwtPayload = await verifyResetToken(token)
  if (!jwtPayload) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 }
    )
  }

  // Check that token exists in store and hasn't been used
  const storedToken = await findValidResetToken(token)
  if (!storedToken) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)
  const updated = await updateDoctorPassword(jwtPayload.sub, passwordHash)

  if (!updated) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 }
    )
  }

  await markResetTokenUsed(token)

  return NextResponse.json({
    success: true,
    message: 'Password has been reset successfully. You can now log in.',
  })
}
