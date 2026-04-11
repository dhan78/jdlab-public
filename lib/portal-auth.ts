import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

// Validate PORTAL_JWT_SECRET at module load time
const secret = process.env.PORTAL_JWT_SECRET
if (!secret) {
  throw new Error('[portal-auth] PORTAL_JWT_SECRET environment variable is required but not set. Set it in .env.local before starting the server.')
}

const JWT_SECRET = new TextEncoder().encode(secret)

export interface SessionPayload {
  sub: string
  email: string
  name: string
  role: 'doctor' | 'admin'
}

export interface ResetTokenPayload {
  sub: string  // doctorId
  purpose: 'password-reset'
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Session JWT utilities (8h expiry)
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as 'doctor' | 'admin',
    }
  } catch {
    return null
  }
}

// Reset token JWT utilities (1h expiry)
export async function createResetToken(doctorId: string): Promise<string> {
  return new SignJWT({ purpose: 'password-reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(doctorId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET)
}

export async function verifyResetToken(token: string): Promise<ResetTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    if (payload.purpose !== 'password-reset') return null
    return {
      sub: payload.sub as string,
      purpose: 'password-reset',
    }
  } catch {
    return null
  }
}

// Cookie helper — reads portal-session from a cookie header string
export function getSessionFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)portal-session=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

// HTML escape helper for safe email template interpolation
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
