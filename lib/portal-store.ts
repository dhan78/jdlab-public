import { hashPassword } from './portal-auth'

export interface Doctor {
  id: string
  name: string
  email: string
  passwordHash: string
  role: 'doctor' | 'admin'
  createdAt: string
  practiceName?: string
  practiceAddress?: string
  phone?: string
}

export interface PasswordResetToken {
  token: string
  doctorId: string
  expiresAt: string
  used: boolean
}

const doctors: Doctor[] = []
const resetTokens: PasswordResetToken[] = []

// Seed admin account on module load
async function seedAdmin() {
  const email = process.env.PORTAL_ADMIN_EMAIL
  const password = process.env.PORTAL_ADMIN_PASSWORD
  const name = process.env.PORTAL_ADMIN_NAME

  if (!email || !password || !name) return

  const existing = doctors.find(d => d.email.toLowerCase() === email.toLowerCase())
  if (existing) return

  const passwordHash = await hashPassword(password)
  doctors.push({
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  })
}

// Trigger seed (fire-and-forget; module-level side effect)
seedAdmin().catch(() => {/* ignore seed errors to avoid blocking module load */})

// Doctor CRUD helpers
export function addDoctor(doctor: Omit<Doctor, 'id' | 'createdAt'>): Doctor {
  const newDoctor: Doctor = {
    ...doctor,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  doctors.push(newDoctor)
  return newDoctor
}

export function findDoctorByEmail(email: string): Doctor | undefined {
  return doctors.find(d => d.email.toLowerCase() === email.toLowerCase())
}

export function findDoctorById(id: string): Doctor | undefined {
  return doctors.find(d => d.id === id)
}

export function removeDoctorById(id: string): boolean {
  const index = doctors.findIndex(d => d.id === id)
  if (index === -1) return false
  doctors.splice(index, 1)
  return true
}

export function listDoctors(): Doctor[] {
  return [...doctors]
}

export function updateDoctorPassword(id: string, passwordHash: string): boolean {
  const doctor = doctors.find(d => d.id === id)
  if (!doctor) return false
  doctor.passwordHash = passwordHash
  return true
}

// Reset token helpers
export function addResetToken(token: PasswordResetToken): void {
  // Invalidate all previous tokens for this doctor
  invalidateResetTokensForDoctor(token.doctorId)
  resetTokens.push(token)
}

export function findValidResetToken(token: string): PasswordResetToken | undefined {
  return resetTokens.find(
    t => t.token === token && !t.used && new Date(t.expiresAt) > new Date()
  )
}

export function invalidateResetTokensForDoctor(doctorId: string): void {
  resetTokens
    .filter(t => t.doctorId === doctorId)
    .forEach(t => { t.used = true })
}

export function markResetTokenUsed(token: string): void {
  const t = resetTokens.find(t => t.token === token)
  if (t) t.used = true
}
