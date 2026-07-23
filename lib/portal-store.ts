import { db } from './db'
import { users, passwordResetTokens, practiceAddresses } from './db/schema'
import { and, asc, desc, eq, gt } from 'drizzle-orm'

export interface Doctor {
  id: string
  name: string
  email: string
  passwordHash: string
  role: 'doctor' | 'planner' | 'admin'
  createdAt: string
  practiceName?: string
  practiceAddress?: string
  phone?: string
}

export interface PracticeAddress {
  id: string
  userId: string
  label?: string
  address: string
  isPreferred: boolean
  createdAt: string
}

export interface PasswordResetToken {
  token: string
  doctorId: string
  expiresAt: string
  used: boolean
}

type UserRow = typeof users.$inferSelect

// Parse a stringified id back to the integer PK; NaN-safe (returns -1 so it
// simply matches nothing rather than throwing).
function toIntId(v: string | number): number {
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isInteger(n) ? n : -1
}

function toDoctor(row: UserRow): Doctor {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as Doctor['role'],
    createdAt: row.createdAt.toISOString(),
    practiceName: row.practiceName ?? undefined,
    practiceAddress: row.practiceAddress ?? undefined,
    phone: row.phone ?? undefined,
  }
}

// --- Doctor / user helpers ---

export async function addDoctor(doctor: Omit<Doctor, 'id' | 'createdAt'>): Promise<Doctor> {
  const [row] = await db
    .insert(users)
    .values({
      name: doctor.name,
      email: doctor.email.trim().toLowerCase(),
      passwordHash: doctor.passwordHash,
      role: doctor.role,
      practiceName: doctor.practiceName ?? null,
      practiceAddress: doctor.practiceAddress ?? null,
      phone: doctor.phone ?? null,
    })
    .returning()
  // Seed the addresses table with the initial address as the preferred one.
  if (doctor.practiceAddress && doctor.practiceAddress.trim()) {
    await addPracticeAddress({ userId: String(row.id), address: doctor.practiceAddress, isPreferred: true })
  }
  return toDoctor(row)
}

export async function findDoctorByEmail(email: string): Promise<Doctor | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)
  return row ? toDoctor(row) : undefined
}

export async function findDoctorById(id: string): Promise<Doctor | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, toIntId(id))).limit(1)
  return row ? toDoctor(row) : undefined
}

export async function removeDoctorById(id: string): Promise<boolean> {
  const rows = await db.delete(users).where(eq(users.id, toIntId(id))).returning({ id: users.id })
  return rows.length > 0
}

export async function listDoctors(): Promise<Doctor[]> {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt))
  return rows.map(toDoctor)
}

export async function updateDoctorPassword(id: string, passwordHash: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, toIntId(id)))
    .returning({ id: users.id })
  return rows.length > 0
}

// Update editable profile fields (and optionally the password hash). Only keys
// present in `fields` are changed; empty strings clear the optional columns.
export async function updateDoctor(
  id: string,
  fields: Partial<
    Pick<
      Doctor,
      'name' | 'email' | 'role' | 'practiceName' | 'practiceAddress' | 'phone' | 'passwordHash'
    >
  >
): Promise<Doctor | undefined> {
  const set: Partial<typeof users.$inferInsert> = {}
  if (fields.name !== undefined) set.name = fields.name
  if (fields.email !== undefined) set.email = fields.email.trim().toLowerCase()
  if (fields.role !== undefined) set.role = fields.role
  if (fields.practiceName !== undefined) set.practiceName = fields.practiceName || null
  if (fields.practiceAddress !== undefined) set.practiceAddress = fields.practiceAddress || null
  if (fields.phone !== undefined) set.phone = fields.phone || null
  if (fields.passwordHash !== undefined) set.passwordHash = fields.passwordHash

  if (Object.keys(set).length === 0) return findDoctorById(id)

  const [row] = await db.update(users).set(set).where(eq(users.id, toIntId(id))).returning()
  return row ? toDoctor(row) : undefined
}

// --- Practice addresses (multiple per doctor; exactly one preferred) ---

type PracticeAddressRow = typeof practiceAddresses.$inferSelect

function toPracticeAddress(row: PracticeAddressRow): PracticeAddress {
  return {
    id: String(row.id),
    userId: String(row.userId),
    label: row.label ?? undefined,
    address: row.address,
    isPreferred: row.isPreferred,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listPracticeAddresses(userId: string): Promise<PracticeAddress[]> {
  const rows = await db
    .select()
    .from(practiceAddresses)
    .where(eq(practiceAddresses.userId, toIntId(userId)))
    .orderBy(desc(practiceAddresses.isPreferred), asc(practiceAddresses.id))
  return rows.map(toPracticeAddress)
}

// Mirror the preferred address text onto users.practice_address so existing
// single-address reads (admin list, case sidebar) stay correct.
async function syncPreferredMirror(userId: string): Promise<void> {
  const [pref] = await db
    .select({ address: practiceAddresses.address })
    .from(practiceAddresses)
    .where(and(eq(practiceAddresses.userId, toIntId(userId)), eq(practiceAddresses.isPreferred, true)))
    .limit(1)
  await db
    .update(users)
    .set({ practiceAddress: pref?.address ?? null })
    .where(eq(users.id, toIntId(userId)))
}

export async function addPracticeAddress(input: {
  userId: string
  address: string
  label?: string
  isPreferred?: boolean
}): Promise<PracticeAddress> {
  const uid = toIntId(input.userId)
  // First address for a doctor is always preferred.
  const existing = await db
    .select({ id: practiceAddresses.id })
    .from(practiceAddresses)
    .where(eq(practiceAddresses.userId, uid))
  const makePreferred = input.isPreferred || existing.length === 0

  if (makePreferred) {
    await db
      .update(practiceAddresses)
      .set({ isPreferred: false })
      .where(eq(practiceAddresses.userId, uid))
  }

  const [row] = await db
    .insert(practiceAddresses)
    .values({
      userId: uid,
      address: input.address.trim(),
      label: input.label?.trim() || null,
      isPreferred: makePreferred,
    })
    .returning()

  await syncPreferredMirror(input.userId)
  return toPracticeAddress(row)
}

export async function updatePracticeAddress(
  userId: string,
  addressId: string,
  fields: { address?: string; label?: string; isPreferred?: boolean }
): Promise<PracticeAddress | undefined> {
  const uid = toIntId(userId)
  const aid = toIntId(addressId)

  const set: Partial<typeof practiceAddresses.$inferInsert> = {}
  if (fields.address !== undefined) set.address = fields.address.trim()
  if (fields.label !== undefined) set.label = fields.label.trim() || null

  if (Object.keys(set).length > 0) {
    await db
      .update(practiceAddresses)
      .set(set)
      .where(and(eq(practiceAddresses.id, aid), eq(practiceAddresses.userId, uid)))
  }

  // Promoting to preferred clears the flag on siblings.
  if (fields.isPreferred === true) {
    await db
      .update(practiceAddresses)
      .set({ isPreferred: false })
      .where(eq(practiceAddresses.userId, uid))
    await db
      .update(practiceAddresses)
      .set({ isPreferred: true })
      .where(and(eq(practiceAddresses.id, aid), eq(practiceAddresses.userId, uid)))
  }

  await syncPreferredMirror(userId)

  const [row] = await db
    .select()
    .from(practiceAddresses)
    .where(and(eq(practiceAddresses.id, aid), eq(practiceAddresses.userId, uid)))
    .limit(1)
  return row ? toPracticeAddress(row) : undefined
}

export async function removePracticeAddress(userId: string, addressId: string): Promise<boolean> {
  const uid = toIntId(userId)
  const aid = toIntId(addressId)

  const [removed] = await db
    .delete(practiceAddresses)
    .where(and(eq(practiceAddresses.id, aid), eq(practiceAddresses.userId, uid)))
    .returning({ id: practiceAddresses.id, wasPreferred: practiceAddresses.isPreferred })
  if (!removed) return false

  // If we deleted the preferred one, promote the oldest remaining address.
  if (removed.wasPreferred) {
    const [next] = await db
      .select({ id: practiceAddresses.id })
      .from(practiceAddresses)
      .where(eq(practiceAddresses.userId, uid))
      .orderBy(asc(practiceAddresses.id))
      .limit(1)
    if (next) {
      await db
        .update(practiceAddresses)
        .set({ isPreferred: true })
        .where(eq(practiceAddresses.id, next.id))
    }
  }

  await syncPreferredMirror(userId)
  return true
}

// --- Password reset tokens ---

export async function addResetToken(token: PasswordResetToken): Promise<void> {
  await invalidateResetTokensForDoctor(token.doctorId)
  await db.insert(passwordResetTokens).values({
    userId: toIntId(token.doctorId),
    token: token.token,
    expiresAt: new Date(token.expiresAt),
    used: token.used,
  })
}

export async function findValidResetToken(
  token: string
): Promise<PasswordResetToken | undefined> {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1)
  if (!row) return undefined
  return {
    token: row.token,
    doctorId: String(row.userId),
    expiresAt: row.expiresAt.toISOString(),
    used: row.used,
  }
}

export async function invalidateResetTokensForDoctor(doctorId: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.userId, toIntId(doctorId)))
}

export async function markResetTokenUsed(token: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.token, token))
}
