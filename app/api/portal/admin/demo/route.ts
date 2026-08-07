import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, verifySessionToken } from '@/lib/portal-auth'
import type { SessionPayload } from '@/lib/portal-auth'
import { getDemoConfig, setDemoEnabled, setDemoCaseId } from '@/lib/demo-config'
import { findCaseById } from '@/lib/case-store'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/rate-limit'

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionFromCookies(request.headers.get('cookie'))
  if (!token) return null
  return verifySessionToken(token)
}

// GET: current public-demo config (admin only).
export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  return NextResponse.json(await getDemoConfig())
}

// PUT: enable/disable the public demo and/or set the demo case id (admin only).
// Enabling requires a valid, existing case id so `/demo` never 404s once "on".
export async function PUT(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  let body: { enabled?: unknown; caseId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Update the target case id first (if provided), validating it exists.
  if (body.caseId !== undefined) {
    const caseId = String(body.caseId ?? '').trim()
    if (caseId) {
      const exists = await findCaseById(caseId)
      if (!exists) {
        return NextResponse.json({ error: `Case ${caseId} not found` }, { status: 400 })
      }
    }
    await setDemoCaseId(caseId)
  }

  if (body.enabled !== undefined) {
    const enabled = body.enabled === true || body.enabled === 'true'
    // Don't allow turning the demo ON without a valid target case.
    if (enabled) {
      const cfg = await getDemoConfig()
      const target = cfg.caseId
      if (!target || !(await findCaseById(target))) {
        return NextResponse.json(
          { error: 'Set a valid demo case id before enabling the public demo.' },
          { status: 400 },
        )
      }
    }
    await setDemoEnabled(enabled)
    await recordAudit({
      actorId: session.sub,
      actorRole: session.role,
      action: 'demo.toggle',
      detail: enabled ? 'enabled' : 'disabled',
      ip: clientIp(request),
    })
  }

  return NextResponse.json(await getDemoConfig())
}
