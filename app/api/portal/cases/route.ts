import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import {
  addCase,
  listAllCases,
  listCasesForDoctor,
  messageCountsByCase,
  getUnreadCounts,
  getLastViewedMap,
  CASE_TYPES,
  type CaseType,
} from '@/lib/case-store'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'
import { getSlaConfigMap } from '@/lib/sla-config'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

// GET: role-scoped case list.
//   doctor          -> only their own cases
//   planner / admin -> all cases (the shared work queue)
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rows =
    session.role === 'doctor'
      ? await listCasesForDoctor(session.sub)
      : await listAllCases()

  const counts = await messageCountsByCase(rows.map(c => c.id))
  const unread = await getUnreadCounts(session.sub, session.role)
  const lastViewed = await getLastViewedMap(session.sub)
  const cases = rows.map(c => ({
    ...c,
    messageCount: counts[c.id] ?? 0,
    unreadCount: unread[c.id] ?? 0,
    lastViewedAt: lastViewed[c.id],
  }))

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)
  const slaConfig = await getSlaConfigMap()
  return NextResponse.json({ cases, total: cases.length, role: session.role, totalUnread, slaConfig })
}

// POST: create a new case. Cases originate from doctors only.
export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (session.role !== 'doctor') {
    return NextResponse.json(
      { error: 'Only doctors can create cases' },
      { status: 403 }
    )
  }

  let body: { title?: unknown; patientName?: unknown; surgeryDate?: unknown; toothRef?: unknown; material?: unknown; scannerBrand?: unknown; scanCaseId?: unknown; scanLink?: unknown; isRush?: unknown; caseType?: unknown; specialInstructions?: unknown; shipToAddress?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A case title is required' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const patientName = typeof body.patientName === 'string' ? body.patientName.trim() : undefined
  const surgeryDate = typeof body.surgeryDate === 'string' ? body.surgeryDate.trim() : undefined
  const toothRef = typeof body.toothRef === 'string' ? body.toothRef.trim() : undefined
  const material = typeof body.material === 'string' ? body.material.trim() : undefined
  const scannerBrand = typeof body.scannerBrand === 'string' ? body.scannerBrand.trim() : undefined
  const scanCaseId = typeof body.scanCaseId === 'string' ? body.scanCaseId.trim() : undefined
  const scanLink = typeof body.scanLink === 'string' ? body.scanLink.trim() : undefined
  const specialInstructions =
    typeof body.specialInstructions === 'string' ? body.specialInstructions.trim().slice(0, 2000) : undefined
  const shipToAddress =
    typeof body.shipToAddress === 'string' ? body.shipToAddress.trim().slice(0, 400) : undefined
  const isRush = body.isRush === true
  const caseType: CaseType = CASE_TYPES.includes(body.caseType as CaseType)
    ? (body.caseType as CaseType)
    : 'guide'

  if (!title) {
    return NextResponse.json({ error: 'A case title is required' }, { status: 400 })
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'Title must be 200 characters or fewer' }, { status: 400 })
  }
  if (patientName && patientName.length > 200) {
    return NextResponse.json({ error: 'Patient name must be 200 characters or fewer' }, { status: 400 })
  }
  // surgeryDate, when provided, must be an ISO date (YYYY-MM-DD).
  if (surgeryDate && !/^\d{4}-\d{2}-\d{2}$/.test(surgeryDate)) {
    return NextResponse.json({ error: 'Surgery date must be a valid date' }, { status: 400 })
  }
  // scanLink, when provided, must be a valid http(s) URL.
  if (scanLink) {
    try {
      const u = new URL(scanLink)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol')
    } catch {
      return NextResponse.json({ error: 'Scan link must be a valid URL' }, { status: 400 })
    }
  }

  const created = await addCase({
    doctorId: session.sub,
    doctorName: session.name,
    title,
    patientName: patientName || undefined,
    surgeryDate: surgeryDate || undefined,
    toothRef: toothRef || undefined,
    material: material || undefined,
    scannerBrand: scannerBrand || undefined,
    scanCaseId: scanCaseId || undefined,
    scanLink: scanLink || undefined,
    specialInstructions: specialInstructions || undefined,
    shipToAddress: shipToAddress || undefined,
    isRush,
    caseType,
  })

  await recordAudit({
    actorId: session.sub,
    actorRole: session.role,
    action: 'case.create',
    caseToken: created.id,
    detail: caseType,
    ip: clientIp(request),
  })

  return NextResponse.json({ success: true, case: created }, { status: 201 })
}
