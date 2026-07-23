import { NextRequest, NextResponse } from 'next/server'
import { findDoctorByEmail } from '@/lib/portal-store'
import { createResetToken } from '@/lib/portal-auth'
import { addResetToken } from '@/lib/portal-store'
import { sendPasswordResetEmail } from '@/lib/email'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'

// In-memory rate limiting: 3 requests per email per hour
const resetAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const key = email.toLowerCase()
  const record = resetAttempts.get(key)

  if (!record || now > record.resetAt) {
    resetAttempts.set(key, { count: 1, resetAt: now + 3_600_000 })
    return true
  }

  if (record.count >= 3) return false

  record.count++
  return true
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SUCCESS_RESPONSE = {
  success: true,
  message: 'If an account with that email exists, a reset link has been sent.',
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    // Still return success to prevent enumeration
    return NextResponse.json(SUCCESS_RESPONSE)
  }

  // Rate limit check (after validation but before DB lookup)
  if (!checkRateLimit(email)) {
    // Still return success to prevent enumeration
    return NextResponse.json(SUCCESS_RESPONSE)
  }

  const doctor = await findDoctorByEmail(email)
  if (!doctor) {
    return NextResponse.json(SUCCESS_RESPONSE)
  }

  const token = await createResetToken(doctor.id)
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()

  await addResetToken({ token, doctorId: doctor.id, expiresAt, used: false })

  await recordAudit({ actorId: doctor.id, actorRole: doctor.role, action: 'password.reset_request', ip: clientIp(request) })

  // Send email (fire-and-forget — don't reveal errors to client)
  sendPasswordResetEmail({
    name: doctor.name,
    email: doctor.email,
    token,
  }).catch(() => {/* log silently */})

  return NextResponse.json(SUCCESS_RESPONSE)
}
