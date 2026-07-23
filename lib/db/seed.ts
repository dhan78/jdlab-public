/**
 * Database seed — realistic surgical-guide production data.
 *
 * Modeled on a real digital surgical-guide lab worklist: implant systems,
 * arches, RUSH surgery dates, guide renders, and "@Boston"-style coordination
 * threads (shipping instructions, delivery-by dates, sleeve-accessibility
 * questions). All patients are synthetic.
 *
 * Run with:  npm run db:seed   (uses tsx --env-file=.env.local)
 * Re-runnable: TRUNCATEs case data and restarts IDs at 1; users are preserved.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql, eq } from 'drizzle-orm'
import { db } from './index'
import {
  users,
  cases,
  caseMessages,
  messageAttachments,
  caseStatusHistory,
  practiceAddresses,
} from './schema'
import { hashPassword } from '../portal-auth'
import type { CaseStatus, CaseType } from '../case-store'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UserRow = typeof users.$inferSelect

const FIXTURES = join(process.cwd(), 'test-fixtures')

function ymd(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

/** Read a fixture and return a base64 data URL so it renders inline in the thread. */
function dataUrl(file: string, mime: string): { name: string; mimeType: string; sizeBytes: number; dataUrl: string } {
  const bytes = readFileSync(join(FIXTURES, file))
  return {
    name: file,
    mimeType: mime,
    sizeBytes: bytes.byteLength,
    dataUrl: `data:${mime};base64,${bytes.toString('base64')}`,
  }
}

async function getOrCreateUser(input: {
  name: string
  email: string
  password: string
  role: string
  practiceName?: string
}): Promise<UserRow> {
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1)
  if (existing[0]) return existing[0]
  const [row] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      practiceName: input.practiceName ?? null,
    })
    .returning()
  return row
}

// Seed a doctor's practice / ship-to addresses (idempotent: only when they have
// none yet, so re-running the seed won't duplicate or clobber admin edits).
// Also mirrors the preferred address onto users.practice_address.
async function seedAddresses(
  user: UserRow,
  addrs: { label?: string; address: string; preferred?: boolean }[]
): Promise<void> {
  const existing = await db
    .select({ id: practiceAddresses.id })
    .from(practiceAddresses)
    .where(eq(practiceAddresses.userId, user.id))
  if (existing.length > 0) return

  for (const a of addrs) {
    await db.insert(practiceAddresses).values({
      userId: user.id,
      label: a.label ?? null,
      address: a.address,
      isPreferred: a.preferred ?? false,
    })
  }
  const preferred = addrs.find(a => a.preferred) ?? addrs[0]
  if (preferred) {
    await db.update(users).set({ practiceAddress: preferred.address }).where(eq(users.id, user.id))
  }
}

// Per-case message sequence counter → message id "{caseId}-{n}".
const seqByCase = new Map<number, number>()

// Rotates the scan-received age across advanced cases for a varied SLA demo.
let advancedCaseSeq = 0

async function addCase(input: {
  doctor: UserRow
  title: string
  patientName: string
  surgeryInDays: number
  toothRef: string // arch / site, e.g. "Maxilla" or "#19"
  material: string // implant system / guide kit
  scannerBrand: string
  status: CaseStatus
  isRush?: boolean
  caseType?: CaseType
  specialInstructions?: string
  scanReceivedDaysAgo?: number
}): Promise<number> {
  // SLA clock: a case still "received" is awaiting scan (null). Once work has
  // started, the scans are in — stamp scanReceivedAt in the past, varied so the
  // demo shows a believable mix of on-track / due-today / overdue.
  let scanReceivedAt: Date | null = null
  if (input.scanReceivedDaysAgo != null) {
    scanReceivedAt = new Date(Date.now() - input.scanReceivedDaysAgo * 86_400_000)
  } else if (input.status !== 'received') {
    const spread = [0, 1, 2, 4, 6][advancedCaseSeq++ % 5]
    scanReceivedAt = new Date(Date.now() - spread * 86_400_000)
  }

  const [row] = await db
    .insert(cases)
    .values({
      doctorId: input.doctor.id,
      title: input.title,
      patientName: input.patientName,
      surgeryDate: ymd(input.surgeryInDays),
      toothRef: input.toothRef,
      material: input.material,
      scannerBrand: input.scannerBrand,
      isRush: input.isRush ?? false,
      caseType: input.caseType ?? 'guide',
      specialInstructions: input.specialInstructions ?? null,
      status: input.status,
      scanReceivedAt,
    })
    .returning({ id: cases.id })
  await db.insert(caseStatusHistory).values({
    caseId: row.id,
    fromStatus: null,
    toStatus: input.status,
    changedBy: input.doctor.id,
  })
  seqByCase.set(row.id, 0)
  return row.id
}

async function addMsg(
  caseId: number,
  author: UserRow,
  body: string,
  attachments: ReturnType<typeof dataUrl>[] = []
): Promise<void> {
  const n = (seqByCase.get(caseId) ?? 0) + 1
  seqByCase.set(caseId, n)
  const id = `${caseId}-${n}`
  await db.insert(caseMessages).values({
    id,
    caseId,
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    body,
  })
  for (const a of attachments) {
    await db.insert(messageAttachments).values({ messageId: id, ...a })
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding surgical-guide demo data…')

  // Fresh case data every run; keep users so logins survive.
  await db.execute(
    sql`TRUNCATE cases, case_messages, message_attachments, case_status_history RESTART IDENTITY CASCADE`
  )

  // --- Accounts ---
  const doctor = await getOrCreateUser({
    name: 'Dr. Erik Lindqvist',
    email: 'dr.lindqvist@example.com',
    password: 'demopass1234',
    role: 'doctor',
    practiceName: 'Lindqvist Implant & Oral Surgery',
  })
  const planner = await getOrCreateUser({
    name: 'Priya (Planning)',
    email: 'planner@jdlab.us',
    password: 'demopass1234',
    role: 'planner',
    practiceName: 'JD Dental Lab — Design',
  })
  await getOrCreateUser({
    name: 'Admin',
    email: process.env.PORTAL_ADMIN_EMAIL ?? 'admin@jdlab.us',
    password: process.env.PORTAL_ADMIN_PASSWORD ?? 'mgdnpass',
    role: 'admin',
  })

  // Extra doctors — case owners so the planner's queue looks realistically
  // multi-practice. They don't need to log in for the demo.
  const chalak = await getOrCreateUser({
    name: 'Dr. Amir Chalak',
    email: 'dr.chalak@example.com',
    password: 'demopass1234',
    role: 'doctor',
    practiceName: 'Coastal Full-Arch Center',
  })
  const kuznetsov = await getOrCreateUser({
    name: 'Dr. Sergei Kuznetsov',
    email: 'dr.kuznetsov@example.com',
    password: 'demopass1234',
    role: 'doctor',
    practiceName: 'Park Slope Dental Arts',
  })
  const salem = await getOrCreateUser({
    name: 'Dr. Teresa Salem',
    email: 'dr.salem@example.com',
    password: 'demopass1234',
    role: 'doctor',
    practiceName: 'Salem Family Dentistry',
  })
  const mcvety = await getOrCreateUser({
    name: 'Dr. Rob McVety',
    email: 'dr.mcvety@example.com',
    password: 'demopass1234',
    role: 'doctor',
    practiceName: 'Advanced Oral & Maxillofacial',
  })
  const sharma = await getOrCreateUser({
    name: 'Dr. Jaya Sharma',
    email: 'dr.sharma@example.com',
    password: 'demopass1234',
    role: 'doctor',
    practiceName: 'Divine Oral Care',
  })

  // --- Practice / ship-to addresses (valid US addresses; some multi-location) ---
  await seedAddresses(doctor, [
    { label: 'Main office', address: 'Lindqvist Implant & Oral Surgery, 2200 Post St, Suite 300, San Francisco, CA 94115', preferred: true },
    { label: 'Peninsula suite', address: '1720 El Camino Real, Suite 140, Burlingame, CA 94010' },
  ])
  await seedAddresses(chalak, [
    { label: 'Main office', address: 'Coastal Full-Arch Center, 3801 PGA Blvd, Suite 600, Palm Beach Gardens, FL 33410', preferred: true },
  ])
  await seedAddresses(kuznetsov, [
    { label: 'Main office', address: 'Park Slope Dental Arts, 250 5th Ave, Brooklyn, NY 11215', preferred: true },
  ])
  await seedAddresses(salem, [
    { label: 'Dallas', address: 'Salem Family Dentistry, 4514 Travis St, Suite 200, Dallas, TX 75205', preferred: true },
    { label: 'Plano', address: 'Salem Family Dentistry — Plano, 5805 Coit Rd, Suite 300, Plano, TX 75093' },
  ])
  await seedAddresses(mcvety, [
    { label: 'Main office', address: 'Advanced Oral & Maxillofacial Surgery, 1250 S Cedar Crest Blvd, Suite 200, Allentown, PA 18103', preferred: true },
  ])
  await seedAddresses(sharma, [
    { label: 'Main office', address: 'Divine Oral Care, 30 Montgomery St, Suite 1010, Jersey City, NJ 07302', preferred: true },
  ])

  // --- Fixtures ---
  const guideMaxilla = dataUrl('sample-guide-maxilla.svg', 'image/svg+xml')
  const guideMandible = dataUrl('sample-guide-mandible.svg', 'image/svg+xml')
  const guideFullArch = dataUrl('sample-guide-fullarch.svg', 'image/svg+xml')
  const cbct = dataUrl('sample-cbct-crosssection.svg', 'image/svg+xml')

  // --- Cases (Dr. Lindqvist — the demo doctor login) ---

  const c1 = await addCase({
    doctor,
    title: 'Surgical Guide — Maxilla (keyless)',
    patientName: 'Alexandre Figueiredo',
    surgeryInDays: 3,
    toothRef: 'Maxilla · #13',
    material: 'BioHorizons PRO Keyless — PROMCYL sleeve',
    scannerBrand: 'iTero',
    status: 'planning',
    isRush: true,
    specialInstructions: 'Deliver by the surgery date, on or before 8:00 AM (surgery time). Adult signature required on FedEx.',
  })
  await addMsg(
    c1,
    doctor,
    'Maxillary keyless guide, single implant at #13 (BioHorizons PRO). RUSH — @Boston please make sure the guide is delivered by the surgery date, on or before 8 am, as that is the surgery time. Render + scan attached.',
    [guideMaxilla]
  )
  await addMsg(
    c1,
    planner,
    'Received and flagged RUSH. Design approved (DES) and printing now. We will seat the sleeve (SLV) and fit-verify (FIT) on the printed model before packaging. One question — can you confirm sleeve accessibility for #13? The distal is tight against the erupting molar.'
  )

  const c2 = await addCase({
    doctor,
    title: 'Surgical Guide — Mandible',
    patientName: 'Luis Espino',
    surgeryInDays: 2,
    toothRef: 'Mandible · #30',
    material: 'Nobel 606-506-35L (RP)',
    scannerBrand: '3Shape TRIOS',
    status: 'received',
    isRush: true,
  })
  await addMsg(
    c2,
    doctor,
    'Mandibular guide, single Nobel 606-506-35L (RP) at #30. Rush if at all possible — patient is scheduled early this week.'
  )

  const c3 = await addCase({
    doctor,
    title: 'Surgical Guide — Mandible (VeloDrill)',
    patientName: 'Dennis Sproul',
    surgeryInDays: 5,
    toothRef: 'Mandible · #19',
    material: 'Straumann VeloDrill — self-locking sleeve',
    scannerBrand: 'Medit i700',
    status: 'production',
  })
  await addMsg(
    c3,
    doctor,
    'Mandibular Straumann VeloDrill, 5 mm self-locking sleeve at #19. Tooth-supported, adjacent teeth are solid.'
  )
  await addMsg(
    c3,
    planner,
    'Sleeve seated (SLV) and fit verified (FIT) on the printed model — render attached. Seats fully with a positive stop. Moving to final QC.',
    [guideMandible]
  )

  const c4 = await addCase({
    doctor,
    title: 'Surgical Guide — Maxilla (pilot)',
    patientName: 'Leon Harris',
    surgeryInDays: 8,
    toothRef: 'Maxilla · #8',
    material: '3DDX Straight Kit — pilot',
    scannerBrand: 'iTero',
    status: 'review',
  })
  await addMsg(
    c4,
    doctor,
    'Maxillary pilot guide, 3DDX Straight Kit at #8. Tooth-supported, esthetic zone — please keep the emergence in mind.'
  )
  await addMsg(
    c4,
    planner,
    'Design ready for your review (DES). Trajectory is palatal to the incisal edge for a screw-retained final. Approve to print?'
  )

  const c5 = await addCase({
    doctor,
    title: 'Surgical Guide — Mandible (ADIN)',
    patientName: 'George Johnston',
    surgeryInDays: -1,
    toothRef: 'Mandible · #20',
    material: 'ADIN Guided Kit',
    scannerBrand: 'Medit i700',
    status: 'shipped',
  })
  await addMsg(
    c5,
    doctor,
    '@Boston kindly make sure this one is delivered by the surgery date — Adult Signature Required on the FedEx label, please.'
  )
  await addMsg(
    c5,
    planner,
    'Packaged and shipped (SHP). FedEx tracking has been emailed to you, Adult Signature Required as requested. Thank you!'
  )

  const c6 = await addCase({
    doctor,
    title: 'Surgical Guide — Maxilla (Neodent)',
    patientName: 'Lauryn Kyne',
    surgeryInDays: 7,
    toothRef: 'Maxilla · #4, #6',
    material: 'Neodent EasyGuide',
    scannerBrand: '3Shape TRIOS',
    status: 'received',
    specialInstructions: 'Please color the MUA notches for chairside orientation. Ship with Adult Signature Required.',
  })
  await addMsg(
    c6,
    doctor,
    'Maxillary Neodent EasyGuide, two implants (#4, #6). @Boston please color the MUA notches so the assistant can orient them chairside. Ship to the practice with Adult Signature Required.'
  )

  // --- Cases (other practices — populate the planner queue) ---

  const c7 = await addCase({
    doctor: chalak,
    title: 'Full-arch Surgical Guide — Maxilla (All-on-6)',
    patientName: 'Ernest Karner',
    surgeryInDays: 9,
    toothRef: 'Maxilla · edentulous',
    material: '6 × Nobel + fixation pins',
    scannerBrand: 'CBCT + iTero',
    status: 'planning',
  })
  await addMsg(
    c7,
    chalak,
    'All-on-6 maxilla, 6 × Nobel with fixation pins. Low sinus on the right — I want to discuss tilting the posteriors. CBCT and intraoral scan attached.',
    [guideFullArch, cbct]
  )
  await addMsg(
    c7,
    planner,
    'Reviewed the CBCT — roughly 6 mm vertical bone at the posterior right. Recommend tilting the distal implants to ~30° to stay anterior to the sinus. Please check sleeve accessibility for the two tilted sites before we finalize the design.'
  )

  const c8 = await addCase({
    doctor: kuznetsov,
    title: 'Surgical Guide — Maxilla (RealGUIDE)',
    patientName: 'Vincent Allen',
    surgeryInDays: 8,
    toothRef: 'Maxilla · #14',
    material: 'RealGUIDE Z3D',
    scannerBrand: 'Medit i700',
    status: 'design',
  })
  await addMsg(
    c8,
    kuznetsov,
    'Maxillary RealGUIDE Z3D at #14. @Boston please ship all of my upcoming cases to Park Slope Dental Arts, 506 3rd St, Brooklyn NY 11215, until I say otherwise.'
  )
  await addMsg(
    c8,
    planner,
    'Ship-to noted and saved to your standing instructions. Design approved and printing.'
  )

  const c9 = await addCase({
    doctor: salem,
    title: 'Surgical Guide — Maxilla (Neodent)',
    patientName: 'Marisol Duarte',
    surgeryInDays: 6,
    toothRef: 'Maxilla · #7',
    material: 'Neodent EasyGuide',
    scannerBrand: 'iTero',
    status: 'review',
  })
  await addMsg(
    c9,
    salem,
    'Maxillary Neodent EasyGuide at #7. Please double-check the anterior sleeve angulation — I want to avoid the labial plate.'
  )
  await addMsg(
    c9,
    planner,
    'Angulation adjusted 4° palatal and fit verified on the model (FIT). Ready for your review.'
  )

  const c10 = await addCase({
    doctor: mcvety,
    title: 'Zygomatic Surgical Guide — Maxilla',
    patientName: 'Kirk Hill',
    surgeryInDays: 12,
    toothRef: 'Maxilla · zygoma',
    material: 'Zygomatic Nobel + fixation pins',
    scannerBrand: 'CBCT + iTero',
    status: 'planning',
  })
  await addMsg(
    c10,
    mcvety,
    'Zygomatic case, severely resorbed maxilla — Zygomatic Nobel with fixation pins. Complex angulation, please verify the sleeve trajectories carefully against the CBCT. Render attached.',
    [guideFullArch]
  )
  await addMsg(
    c10,
    planner,
    'Understood — zygomatic trajectories flagged for extra QC and a second reviewer. We will send the design for your approval shortly.'
  )

  // --- Crown / bridge cases (skip the Planning stage) ---

  const c11 = await addCase({
    doctor,
    title: 'Crown #14 (zirconia)',
    patientName: 'Harold Weiss',
    surgeryInDays: 6,
    toothRef: '#14',
    material: 'Monolithic zirconia — shade A2',
    scannerBrand: 'iTero',
    status: 'design',
    caseType: 'crown',
  })
  await addMsg(
    c11,
    doctor,
    'Single crown #14, monolithic zirconia, shade A2. Prep scan attached — please confirm the distal margin is captured, it was a little subgingival.'
  )
  await addMsg(
    c11,
    planner,
    'Margin reads clearly on the distal. Coping designed with a 40µm cement gap and 1.0 mm occlusal clearance — sending for your review before we mill.'
  )

  const c12 = await addCase({
    doctor: salem,
    title: '3-unit bridge #4–#6 (e.max)',
    patientName: 'Gloria Tan',
    surgeryInDays: 9,
    toothRef: '#4–#6',
    material: 'IPS e.max — shade B1',
    scannerBrand: '3Shape TRIOS',
    status: 'production',
    caseType: 'crown',
  })
  await addMsg(
    c12,
    salem,
    'Anterior 3-unit bridge #4–#6, e.max, shade B1. Please keep the pontic ovate and check the connector heights for strength.'
  )
  await addMsg(
    c12,
    planner,
    'Connectors set to 9 mm² on the anterior; pontic designed ovate with light tissue contact. Milling and glazing now — will ship once QC passes.'
  )

  // --- Bulk demo cases (spread of dates/statuses to exercise the sidebar:
  //     older shipped cases collapse out, recent ones linger, active ones sort
  //     by soonest surgery date). ~half owned by the demo doctor. ---
  const otherDocs = [chalak, kuznetsov, salem, mcvety]
  const extras: Array<{
    title: string
    patient: string
    days: number
    status: CaseStatus
    caseType?: CaseType
    material: string
    scanner: string
    toothRef: string
    rush?: boolean
    msg: string
  }> = [
    { title: 'Surgical Guide — Mandible (Hahn)', patient: 'Marvin Ott', days: -35, status: 'shipped', material: 'Hahn Guided Kit', scanner: 'iTero', toothRef: 'Mandible · #19', msg: 'Single Hahn implant at #19. Standard tooth-supported guide.' },
    { title: 'Crown #19 (zirconia)', patient: 'Della Hoeger', days: -28, status: 'shipped', caseType: 'crown', material: 'Monolithic zirconia — A3', scanner: '3Shape TRIOS', toothRef: '#19', msg: 'Molar crown #19, shade A3. Heavy occlusion — keep it robust.' },
    { title: 'Surgical Guide — Maxilla (MIS)', patient: 'Sim Reilly', days: -21, status: 'shipped', material: 'MIS MGUIDE', scanner: 'Medit i700', toothRef: 'Maxilla · #4', msg: 'MIS MGUIDE at #4, tooth-supported.' },
    { title: 'Full-arch Guide — Mandible (All-on-4)', patient: 'Cleo Bahringer', days: -14, status: 'shipped', material: '4 × Nobel + fixation', scanner: 'CBCT + iTero', toothRef: 'Mandible · edentulous', msg: 'All-on-4 mandible, fixation pins. CBCT reviewed with the team.' },
    { title: '2-unit bridge #12–#13 (e.max)', patient: 'Anahi Kunze', days: -9, status: 'shipped', caseType: 'crown', material: 'IPS e.max — B2', scanner: 'iTero', toothRef: '#12–#13', msg: 'Anterior 2-unit bridge, e.max, shade B2.' },
    { title: 'Surgical Guide — Maxilla (Hiossen)', patient: 'Roman Feeney', days: -5, status: 'shipped', material: 'Hiossen ET III', scanner: '3Shape TRIOS', toothRef: 'Maxilla · #13', msg: 'Hiossen ET III at #13.' },
    { title: 'Surgical Guide — Mandible (Camlog)', patient: 'Elta Kris', days: -1, status: 'shipped', material: 'Camlog Guide System', scanner: 'Medit i700', toothRef: 'Mandible · #30', msg: 'Camlog at #30 — please deliver before the surgery date.' },
    { title: 'Crown #30 (PFM)', patient: 'Jaron Boyle', days: 0, status: 'shipped', caseType: 'crown', material: 'PFM — A2', scanner: 'iTero', toothRef: '#30', msg: 'PFM crown #30, shade A2. Metal-ceramic, standard prep.' },
    { title: 'Surgical Guide — Maxilla (Megagen)', patient: 'Nikko Wilkinson', days: 1, status: 'production', material: 'Megagen AnyRidge', scanner: 'iTero', toothRef: 'Maxilla · #14', rush: true, msg: 'Megagen AnyRidge at #14. RUSH — surgery is tomorrow morning.' },
    { title: 'Surgical Guide — Mandible (Keystone)', patient: 'Aditya Rao', days: 2, status: 'review', material: 'Keystone PrimaConnex', scanner: 'Medit i700', toothRef: 'Mandible · #18', rush: true, msg: 'Keystone at #18. Please confirm the distal trajectory clears the nerve.' },
    { title: 'Crown #8 (zirconia)', patient: 'Bethany Cole', days: 3, status: 'design', caseType: 'crown', material: 'Layered zirconia — A1', scanner: '3Shape TRIOS', toothRef: '#8', msg: 'Central incisor #8, layered zirconia, shade A1 — esthetics critical.' },
    { title: 'Surgical Guide — Maxilla (Zest LOCATOR)', patient: 'Marcus Webb', days: 4, status: 'planning', material: 'Zest LOCATOR overdenture', scanner: 'CBCT + iTero', toothRef: 'Maxilla · edentulous', msg: 'Overdenture case, 4 LOCATOR abutments. Discuss AP spread.' },
    { title: 'Surgical Guide — Mandible (Neodent)', patient: 'Priyanka Shah', days: 6, status: 'production', material: 'Neodent EasyGuide', scanner: 'iTero', toothRef: 'Mandible · #20', msg: 'Neodent EasyGuide at #20.' },
    { title: '3-unit bridge #3–#5 (zirconia)', patient: 'Owen Frost', days: 8, status: 'received', caseType: 'crown', material: 'Monolithic zirconia — A3.5', scanner: 'Medit i700', toothRef: '#3–#5', msg: 'Posterior 3-unit bridge, monolithic zirconia.' },
    { title: 'Surgical Guide — Maxilla (DS PrimeTaper)', patient: 'Camila Reyes', days: 10, status: 'design', material: 'DS PrimeTaper', scanner: 'iTero', toothRef: 'Maxilla · #6', msg: 'DS PrimeTaper at #6, immediate placement planned.' },
    { title: 'Surgical Guide — Mandible (BioHorizons)', patient: 'Nadia Haddad', days: 12, status: 'review', material: 'BioHorizons Tapered Pro', scanner: '3Shape TRIOS', toothRef: 'Mandible · #29', msg: 'BioHorizons at #29 — please review the emergence.' },
    { title: 'Full-arch Guide — Maxilla (All-on-6)', patient: 'Felix Moreno', days: 15, status: 'planning', material: '6 × Straumann BLX', scanner: 'CBCT + iTero', toothRef: 'Maxilla · edentulous', msg: 'All-on-6 maxilla with Straumann BLX. Sinus grafting history — CBCT attached in follow-up.' },
    { title: 'Surgical Guide — Mandible (Straumann)', patient: 'Greta Lindholm', days: 20, status: 'received', material: 'Straumann VeloDrill', scanner: 'Medit i700', toothRef: 'Mandible · #31', msg: 'Straumann VeloDrill at #31, tooth-supported.' },
    { title: 'Surgical Guide — Maxilla (Nobel)', patient: 'Sasha Ivanov', days: 28, status: 'planning', material: 'Nobel Active RP', scanner: 'iTero', toothRef: 'Maxilla · #7', msg: 'Nobel Active RP at #7.' },
    { title: 'Crown #14 (e.max)', patient: 'Ivan Delgado', days: 35, status: 'received', caseType: 'crown', material: 'IPS e.max — A2', scanner: '3Shape TRIOS', toothRef: '#14', msg: 'Premolar crown #14, e.max, shade A2.' },
  ]

  for (let i = 0; i < extras.length; i++) {
    const e = extras[i]
    const owner = i % 2 === 0 ? doctor : otherDocs[Math.floor(i / 2) % otherDocs.length]
    const cid = await addCase({
      doctor: owner,
      title: e.title,
      patientName: e.patient,
      surgeryInDays: e.days,
      toothRef: e.toothRef,
      material: e.material,
      scannerBrand: e.scanner,
      status: e.status,
      caseType: e.caseType ?? 'guide',
      isRush: e.rush,
    })
    await addMsg(cid, owner, e.msg)
  }

  // --- Discipline showcase: fixed restorative + removable prosthetics, so all
  //     three lifecycles (guide / fixed / removable incl. Try-in & Finishing)
  //     are represented. ---
  const showcase: Array<{
    owner: UserRow
    title: string
    patient: string
    days: number
    status: CaseStatus
    caseType: CaseType
    material: string
    scanner: string
    toothRef: string
    msg: string
    reply?: string
  }> = [
    { owner: doctor, title: 'Veneers #7–#10 (e.max)', patient: 'Harper Nolan', days: 9, status: 'review', caseType: 'veneer', material: 'IPS e.max — BL2', scanner: 'iTero', toothRef: '#7–#10', msg: 'Four anterior veneers, e.max, shade BL2. Minimal prep — keep them thin and bright.', reply: 'Wax-up-driven design ready for your approval. BL2 with medium translucency and soft incisal halo.' },
    { owner: salem, title: 'Onlay #3 (zirconia)', patient: 'Dwight Considine', days: 7, status: 'design', caseType: 'inlay', material: 'Monolithic zirconia — A2', scanner: 'Medit i700', toothRef: '#3', msg: 'MOD onlay #3, zirconia, cusp coverage on the mesiolingual. Deep margin distally.', reply: 'Designing with a 60µm cement gap; distal margin captured. Will send for review.' },
    { owner: kuznetsov, title: 'Implant Crown #19 (screw-retained)', patient: 'Sylvia Braun', days: 5, status: 'production', caseType: 'implant_crown', material: 'Ti-base + zirconia — A3', scanner: 'iTero', toothRef: '#19', msg: 'Screw-retained implant crown #19 on a Ti-base. Access through the central fossa.', reply: 'Zirconia milled and bonded to the Ti-base; access channel set. Staining/glazing now.' },
    { owner: doctor, title: 'Full Upper Denture', patient: 'Owen Castellano', days: 14, status: 'tryin', caseType: 'denture', material: 'Acrylic — shade A2, mould T4', scanner: 'Physical impression', toothRef: 'Maxilla', msg: 'Full upper denture, shade A2, mould T4. Set up for a wax try-in.', reply: 'Wax try-in complete — shipping to your office for the patient try-in. Please check midline, OVD and lip support.' },
    { owner: salem, title: 'Upper Partial (cast metal)', patient: 'Bernadette Cole', days: 18, status: 'finishing', caseType: 'partial', material: 'Cobalt-chrome framework + acrylic', scanner: 'Physical impression', toothRef: 'Maxilla · Kennedy Class III', msg: 'Cast partial, Co-Cr framework, clasps on #6 and #11. Try-in was approved.', reply: 'Framework fit verified, teeth set, try-in approved — festooning and finishing now.' },
    { owner: doctor, title: 'Lower Partial (flexible)', patient: 'Rosa Whitfield', days: -1, status: 'shipped', caseType: 'partial', material: 'Flexible nylon (Valplast)', scanner: 'Physical impression', toothRef: 'Mandible · #19, #20', msg: 'Flexible lower partial replacing #19 and #20. Tissue-shade clasps.', reply: 'Finished and shipped — tissue-shade clasps as requested. Tracking emailed.' },
    { owner: mcvety, title: 'Full Lower Denture (immediate)', patient: 'Gene Marlowe', days: 21, status: 'design', caseType: 'denture', material: 'Acrylic — shade A3', scanner: 'Physical impression', toothRef: 'Mandible', msg: 'Immediate full lower denture, shade A3 — extractions on the day of delivery.', reply: 'Setting the teeth from the pre-extraction model; will festoon to a natural gum contour.' },
  ]

  for (const s of showcase) {
    const cid = await addCase({
      doctor: s.owner,
      title: s.title,
      patientName: s.patient,
      surgeryInDays: s.days,
      toothRef: s.toothRef,
      material: s.material,
      scannerBrand: s.scanner,
      status: s.status,
      caseType: s.caseType,
    })
    await addMsg(cid, s.owner, s.msg)
    if (s.reply) await addMsg(cid, planner, s.reply)
  }

  // --- Dr. Jaya Sharma (Divine Oral Care, Jersey City) — cases with a
  //     realistic clinical back-and-forth: her request, the lab's clarifying
  //     question, and her response. ---
  const sharmaCases: Array<{
    title: string
    patient: string
    days: number
    status: CaseStatus
    caseType?: CaseType
    material: string
    scanner: string
    toothRef: string
    rush?: boolean
    thread: Array<{ from: 'doctor' | 'planner'; body: string }>
  }> = [
    {
      title: 'Surgical Guide — Maxilla #8 (immediate)',
      patient: 'Devon Marsh',
      days: 5,
      status: 'planning',
      material: 'Nobel Active 3.5×13',
      scanner: 'CBCT + iTero',
      toothRef: 'Maxilla · #8',
      thread: [
        { from: 'doctor', body: 'Immediate implant at #8 after atraumatic extraction, Nobel Active 3.5×13. Please design a tooth-supported guide with a buccal window so I can verify the socket walls before drilling.' },
        { from: 'planner', body: 'Happy to add the inspection window. In the esthetic zone we usually palatalize the trajectory ~2 mm to preserve the buccal plate — do you want the emergence set up for a screw-retained provisional afterward, and can you confirm the CBCT was taken with the radiographic marker?' },
        { from: 'doctor', body: 'Palatal shift is fine, keep it screw-retained. The CBCT has the marker. Please leave at least 2 mm of safety from the incisive canal.' },
      ],
    },
    {
      title: 'Crown #30 (zirconia)',
      patient: 'Renata Villalobos',
      days: 7,
      status: 'production',
      caseType: 'crown',
      material: 'Monolithic zirconia — A3',
      scanner: '3Shape TRIOS',
      toothRef: '#30',
      thread: [
        { from: 'doctor', body: 'Molar crown #30, monolithic zirconia, shade A3. Patient is a heavy bruxer — please keep the occlusal thickness robust and mark the heavy contacts.' },
        { from: 'planner', body: 'Designing to a 1.5 mm occlusal minimum. Your prep shows a fairly short clinical crown (~3.5 mm) — do you want us to add two axial retention grooves, or are you bonding with resin cement?' },
        { from: 'doctor', body: 'Resin cement (Panavia). Please add the two axial grooves for extra retention — thanks.' },
      ],
    },
    {
      title: '3-unit bridge #19–#21 (zirconia)',
      patient: 'Malik Osei',
      days: 9,
      status: 'design',
      caseType: 'bridge',
      material: 'Monolithic zirconia — B1',
      scanner: 'Medit i700',
      toothRef: '#19–#21',
      thread: [
        { from: 'doctor', body: 'Posterior 3-unit bridge #19–#21, monolithic zirconia, shade B1, pontic at #20.' },
        { from: 'planner', body: 'The connector at the #20 pontic reads a bit thin on your scan — for posterior zirconia we like ≥ 12 mm² for strength. May we deepen the gingival embrasure slightly to hit that, or would you rather keep your current contour?' },
        { from: 'doctor', body: 'Deepen it to reach 12 mm² — hygiene access matters more than embrasure esthetics on a lower molar bridge.' },
      ],
    },
    {
      title: 'Full-arch Guide — Mandible (All-on-4)',
      patient: 'Cora Whitmore',
      days: 4,
      status: 'planning',
      material: '4 × Straumann BLX + fixation',
      scanner: 'CBCT + iTero',
      toothRef: 'Mandible · edentulous',
      rush: true,
      thread: [
        { from: 'doctor', body: 'All-on-4 mandible, 4× Straumann BLX with fixation pins. Please plan the AP spread to allow a cantilever to the first molar. RUSH — surgery in four days.' },
        { from: 'planner', body: 'Reviewed the CBCT: distal bone is adequate, but the left mental foramen sits close to the tilted implant. Would you prefer we reduce that tilt to 25°, or drop to a 10 mm implant on the left to keep clearance?' },
        { from: 'doctor', body: 'Shorten to 10 mm on the left and keep the 30° tilt. Maintain a 5 mm safety margin from the foramen.' },
      ],
    },
    {
      title: 'Implant Crown #14 (screw-retained)',
      patient: 'Theo Bianchi',
      days: 6,
      status: 'production',
      caseType: 'implant_crown',
      material: 'Ti-base + zirconia — A2',
      scanner: 'iTero',
      toothRef: '#14',
      thread: [
        { from: 'doctor', body: 'Screw-retained implant crown #14 on a Ti-base, shade A2. Access through the central fossa if the angulation allows.' },
        { from: 'planner', body: 'The implant angulation puts the access hole on the mesiobuccal cusp incline — outside the fossa. We can use an angled screw channel (up to 25°) to bring it lingual. OK to proceed with the ASC?' },
        { from: 'doctor', body: 'Yes, use the angled channel to move the access lingual. That works well.' },
      ],
    },
    {
      title: 'Full Upper Denture',
      patient: 'Adelina Kovač',
      days: 12,
      status: 'tryin',
      caseType: 'denture',
      material: 'Acrylic — shade A2, mould T4',
      scanner: 'Physical impression',
      toothRef: 'Maxilla',
      thread: [
        { from: 'doctor', body: 'Full upper denture, shade A2, mould T4. Set up for a wax try-in — the patient would like slightly fuller lip support.' },
        { from: 'planner', body: 'Noted — we\'ll add bulk to the labial flange. Your bite registration shows a slightly canted occlusal plane; should we level it to the interpupillary line, or preserve the patient\'s existing smile line?' },
        { from: 'doctor', body: 'Level it to the interpupillary line. Please send the try-in to my Jersey City office.' },
      ],
    },
    {
      title: 'Crown #9 (layered zirconia)',
      patient: 'Priya Nair',
      days: -3,
      status: 'shipped',
      caseType: 'crown',
      material: 'Layered zirconia — A1',
      scanner: 'iTero',
      toothRef: '#9',
      thread: [
        { from: 'doctor', body: 'Central incisor #9 crown, layered zirconia, shade A1. Please match the adjacent natural #8 — mamelon detail and incisal translucency are important.' },
        { from: 'planner', body: 'We\'ll layer to A1 with subtle mamelons and a translucent incisal third. Do you have a photo of #8 with a shade tab for characterization? It really helps us match the incisal halo.' },
        { from: 'doctor', body: 'Photo with the shade tab is attached to the case. Please match the incisal halo on #8 as closely as you can.' },
      ],
    },
  ]

  for (const sc of sharmaCases) {
    const cid = await addCase({
      doctor: sharma,
      title: sc.title,
      patientName: sc.patient,
      surgeryInDays: sc.days,
      toothRef: sc.toothRef,
      material: sc.material,
      scannerBrand: sc.scanner,
      status: sc.status,
      caseType: sc.caseType ?? 'guide',
      isRush: sc.rush,
    })
    for (const m of sc.thread) {
      await addMsg(cid, m.from === 'doctor' ? sharma : planner, m.body)
    }
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(cases)
  console.log(`Done. ${count} cases seeded across ${7} practices.`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
