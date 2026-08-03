/**
 * End-to-end smoke test for the JD Lab portal, hitting a RUNNING server
 * (default http://localhost:3000). Exercises the runtime-sensitive paths we've
 * repeatedly debugged: auth + access scoping, status-change authorization,
 * message validation, attachment upload (presign fallback + base64 + size caps),
 * the notifications lifecycle (create → title = case title → read → clear),
 * status notifications, web-push subscribe/unsubscribe, the SSE stream, and the
 * client-error → telemetry flagging path.
 *
 * Run:  npm run smoke            (server must already be running)
 *       SMOKE_URL=https://…  npm run smoke
 *
 * It's read-mostly but DOES create a few messages/notifications on the dev DB
 * (then clears the notifications it made). Point it at a dev/staging box.
 */
import { readFile } from 'node:fs/promises'

const BASE = (process.env.SMOKE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const ADMIN_EMAIL = process.env.PORTAL_ADMIN_EMAIL ?? 'admin@jdlab.us'
const ADMIN_PASSWORD = process.env.PORTAL_ADMIN_PASSWORD ?? 'mgdnpass'
const DEMO_PASSWORD = 'demopass1234' // seed password for doctors + planner
const DEV_FILE = process.env.TELEMETRY_DEV_FILE ?? 'telemetry-dev.ndjson'
const FIREHOSE = process.env.TELEMETRY_FIREHOSE_STREAM

let pass = 0
let fail = 0
let skip = 0
const failed: string[] = []

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function check(name: string, fn: () => Promise<void | 'skip'>): Promise<void> {
  try {
    const r = await fn()
    if (r === 'skip') {
      skip++
      console.log(`  \u26a0\ufe0f  SKIP  ${name}`)
    } else {
      pass++
      console.log(`  \u2705 PASS  ${name}`)
    }
  } catch (e) {
    fail++
    failed.push(name)
    console.log(`  \u274c FAIL  ${name}\n            ${(e as Error).message}`)
  }
}

interface Res {
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any
  text: string
  headers: Headers
}

async function http(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string } = {}
): Promise<Res> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.cookie) headers['Cookie'] = opts.cookie
  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual',
  })
  const text = await res.text().catch(() => '')
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON body */
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, json: json as any, text, headers: res.headers }
}

async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(BASE + '/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })
  await res.text().catch(() => '')
  const setCookie = res.headers.get('set-cookie') ?? ''
  const m = /portal-session=([^;]+)/.exec(setCookie)
  return m ? `portal-session=${m[1]}` : null
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log(`\nJD Lab portal smoke test → ${BASE}\n`)

  // ---- Preflight -----------------------------------------------------------
  try {
    const ping = await http('/portal/login')
    assert(ping.status === 200, `server not reachable (login page ${ping.status})`)
  } catch (e) {
    console.error(`\nServer not reachable at ${BASE}. Start it (npm run dev) first.\n${(e as Error).message}`)
    process.exit(2)
  }

  // ---- Auth ----------------------------------------------------------------
  console.log('Auth')
  await check('login with valid planner credentials returns a session cookie', async () => {
    const c = await login('planner@jdlab.us', DEMO_PASSWORD)
    assert(c, 'no portal-session cookie returned')
  })
  await check('login with wrong password is rejected', async () => {
    const res = await http('/api/portal/login', { method: 'POST', body: { email: 'planner@jdlab.us', password: 'wrong-password' } })
    assert([400, 401].includes(res.status), `expected 400/401, got ${res.status}`)
  })

  const plannerCookie = await login('planner@jdlab.us', DEMO_PASSWORD)
  assert(plannerCookie, 'FATAL: cannot log in as planner — is the DB seeded? (npm run db:seed)')
  const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD)

  // Unauthenticated endpoints must all 401.
  console.log('\nUnauthenticated access (all should 401)')
  for (const [path, method, body] of [
    ['/api/portal/cases', 'GET', undefined],
    ['/api/portal/notifications', 'GET', undefined],
    ['/api/portal/notifications/read', 'POST', {}],
    ['/api/portal/notifications/clear', 'POST', {}],
    ['/api/portal/push/subscribe', 'POST', {}],
  ] as const) {
    await check(`${method} ${path} without auth → 401`, async () => {
      const res = await http(path, { method, body })
      assert(res.status === 401, `got ${res.status}`)
    })
  }

  // ---- Discover data -------------------------------------------------------
  const casesRes = await http('/api/portal/cases', { cookie: plannerCookie })
  const allCases: Array<{ id: string; doctorId: string; title: string; status: string; doctorName: string }> =
    casesRes.json?.cases ?? []
  assert(allCases.length > 0, 'FATAL: no cases returned for planner — seed the DB')

  // Log in as a seed doctor we can actually authenticate as, and use one of
  // THEIR own cases (the /api/portal/doctors endpoint is admin-only, so we don't
  // rely on it). Passwords are the seed default.
  const SEED_DOCTORS = [
    'dr.lindqvist@example.com', 'dr.chalak@example.com', 'dr.kuznetsov@example.com',
    'dr.salem@example.com', 'dr.mcvety@example.com', 'dr.sharma@example.com',
  ]
  let doctorCookie: string | null = null
  let doctorCase = allCases[0]
  for (const email of SEED_DOCTORS) {
    const c = await login(email, DEMO_PASSWORD)
    if (!c) continue
    const mine = await http('/api/portal/cases', { cookie: c })
    const list: typeof allCases = mine.json?.cases ?? []
    if (list.length > 0) {
      doctorCookie = c
      doctorCase = list[0]
      break
    }
  }

  // ---- Access scoping ------------------------------------------------------
  console.log('\nAccess scoping')
  await check('planner sees the full case list', async () => {
    assert(Array.isArray(allCases) && allCases.length > 0, 'no cases')
  })
  await check('admin-only /doctors: admin → 200, planner → 403', async () => {
    const asPlanner = await http('/api/portal/doctors', { cookie: plannerCookie })
    assert(asPlanner.status === 403, `planner expected 403, got ${asPlanner.status}`)
    if (!adminCookie) return 'skip'
    const asAdmin = await http('/api/portal/doctors', { cookie: adminCookie })
    assert(asAdmin.status === 200, `admin expected 200, got ${asAdmin.status}`)
  })
  await check('doctor sees only their own cases', async () => {
    if (!doctorCookie) return 'skip'
    const res = await http('/api/portal/cases', { cookie: doctorCookie })
    const list: Array<{ doctorId: string }> = res.json?.cases ?? []
    assert(res.status === 200, `status ${res.status}`)
    assert(list.every(c => String(c.doctorId) === String(doctorCase.doctorId)), 'doctor saw a case they do not own')
  })
  await check("doctor cannot open another doctor's case → 403", async () => {
    if (!doctorCookie) return 'skip'
    const other = allCases.find(c => String(c.doctorId) !== String(doctorCase.doctorId))
    if (!other) return 'skip'
    const res = await http(`/api/portal/cases/${other.id}`, { cookie: doctorCookie })
    assert(res.status === 403, `expected 403, got ${res.status}`)
  })

  // ---- Status-change authorization ----------------------------------------
  console.log('\nStatus-change authorization')
  await check('doctor cannot change case status → 403', async () => {
    if (!doctorCookie) return 'skip'
    const res = await http(`/api/portal/cases/${doctorCase.id}`, { method: 'PATCH', cookie: doctorCookie, body: { status: doctorCase.status } })
    assert(res.status === 403, `expected 403, got ${res.status}`)
  })
  await check('lab can change status (no-op to current) → 200', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}`, { method: 'PATCH', cookie: plannerCookie, body: { status: doctorCase.status } })
    assert(res.status === 200, `status ${res.status}: ${res.text}`)
  })
  await check('invalid status value → 400', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}`, { method: 'PATCH', cookie: plannerCookie, body: { status: '__not_a_status__' } })
    assert(res.status === 400, `expected 400, got ${res.status}`)
  })

  // ---- Message validation --------------------------------------------------
  console.log('\nMessage validation')
  await check('empty body + no attachment → 400', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: '   ' } })
    assert(res.status === 400, `got ${res.status}`)
  })
  await check('over-long body → 400', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'x'.repeat(6000) } })
    assert(res.status === 400, `got ${res.status}`)
  })
  await check('too many attachments (>6) → 400', async () => {
    const atts = Array.from({ length: 7 }, (_, i) => ({ name: `f${i}.txt`, mimeType: 'text/plain', size: 1, dataUrl: 'data:text/plain;base64,QQ==' }))
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'many', attachments: atts } })
    assert(res.status === 400, `got ${res.status}`)
  })
  await check('attachment with no name → 400', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'x', attachments: [{ name: '', mimeType: 'text/plain', size: 1, dataUrl: 'data:text/plain;base64,QQ==' }] } })
    assert(res.status === 400, `got ${res.status}`)
  })
  await check('attachment that is neither dataUrl nor s3Key → 400', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'x', attachments: [{ name: 'x.txt', mimeType: 'text/plain', size: 1 }] } })
    assert(res.status === 400, `got ${res.status}`)
  })

  // ---- Uploads -------------------------------------------------------------
  console.log('\nUploads')
  await check('presign returns 501 when S3 is disabled (base64 fallback path)', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/attachments/presign`, { method: 'POST', cookie: plannerCookie, body: { name: 'test.log', mimeType: '', size: 18 } })
    if (res.status === 200) return 'skip' // S3 IS configured in this env — fallback not exercised
    assert(res.status === 501, `expected 501 (or 200 if S3 on), got ${res.status}`)
  })
  await check('base64 .log attachment (text/plain) → 201', async () => {
    const dataUrl = 'data:text/plain;base64,' + Buffer.from('log line one\nlog line two').toString('base64')
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'log upload', attachments: [{ name: 'test.log', mimeType: 'text/plain', size: 24, dataUrl }] } })
    assert(res.status === 201, `status ${res.status}: ${res.text}`)
  })
  await check('base64 attachment with EMPTY mime type (as a browser sends .log) → 201', async () => {
    const dataUrl = 'data:application/octet-stream;base64,' + Buffer.from('opaque').toString('base64')
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'empty-mime log', attachments: [{ name: 'test.log', mimeType: '', size: 6, dataUrl }] } })
    assert(res.status === 201, `status ${res.status}: ${res.text}`)
  })
  await check('base64 attachment declared > 8MB → 413', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'big', attachments: [{ name: 'big.log', mimeType: 'text/plain', size: 9 * 1024 * 1024, dataUrl: 'data:text/plain;base64,QQ==' }] } })
    assert(res.status === 413, `expected 413, got ${res.status}`)
  })

  // ---- Pins ----------------------------------------------------------------
  console.log('\nPins')
  await check('pin requires auth → 401', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'POST' })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })
  await check('pin a case → { pinned: true } and it shows pinned in the list', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'POST', cookie: plannerCookie })
    assert(res.status === 200, `status ${res.status}: ${res.text}`)
    assert(res.json?.pinned === true, `expected pinned:true, got ${JSON.stringify(res.json)}`)
    const list = await http('/api/portal/cases', { cookie: plannerCookie })
    const found = (list.json?.cases ?? []).find((c: { id: string }) => c.id === doctorCase.id)
    assert(found?.pinned === true, 'case is not flagged pinned in the case list after pinning')
    assert(typeof found?.pinnedAt === 'string' && found.pinnedAt.length > 0, 'pinned case is missing pinnedAt (stable spatial ordering key)')
  })
  await check('pin is idempotent (POST twice) → still pinned', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'POST', cookie: plannerCookie })
    assert(res.status === 200 && res.json?.pinned === true, `status ${res.status}: ${res.text}`)
  })
  await check('unpin a case → { pinned: false } and it no longer shows pinned', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'DELETE', cookie: plannerCookie })
    assert(res.status === 200, `status ${res.status}: ${res.text}`)
    assert(res.json?.pinned === false, `expected pinned:false, got ${JSON.stringify(res.json)}`)
    const list = await http('/api/portal/cases', { cookie: plannerCookie })
    const found = (list.json?.cases ?? []).find((c: { id: string }) => c.id === doctorCase.id)
    assert(!found?.pinned, 'case is still flagged pinned in the list after unpinning')
  })
  await check('unpin is idempotent (DELETE when not pinned) → 200', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'DELETE', cookie: plannerCookie })
    assert(res.status === 200 && res.json?.pinned === false, `status ${res.status}: ${res.text}`)
  })
  await check('pin a nonexistent case → 404', async () => {
    const res = await http('/api/portal/cases/ZZZZZZZ/pin', { method: 'POST', cookie: plannerCookie })
    assert(res.status === 404, `expected 404, got ${res.status}`)
  })
  await check("doctor cannot pin another doctor's case → 403", async () => {
    if (!doctorCookie) return 'skip'
    const other = allCases.find(c => String(c.doctorId) !== String(doctorCase.doctorId))
    if (!other) return 'skip'
    const res = await http(`/api/portal/cases/${other.id}/pin`, { method: 'POST', cookie: doctorCookie })
    assert(res.status === 403, `expected 403, got ${res.status}`)
  })
  await check('pins are per-user: planner pin does not change the doctor list', async () => {
    if (!doctorCookie) return 'skip'
    const doctorPinned = async () => {
      const r = await http('/api/portal/cases', { cookie: doctorCookie })
      return !!(r.json?.cases ?? []).find((c: { id: string; pinned?: boolean }) => c.id === doctorCase.id)?.pinned
    }
    const before = await doctorPinned()
    await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'POST', cookie: plannerCookie })
    const after = await doctorPinned()
    assert(after === before, "planner's pin changed the doctor's pin state (not per-user isolated)")
    // restore the planner's pin state to neutral for re-runs
    await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'DELETE', cookie: plannerCookie })
  })
  await check('case detail reports pin status (powers the message-view pin button)', async () => {
    await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'POST', cookie: plannerCookie })
    const on = await http(`/api/portal/cases/${doctorCase.id}`, { cookie: plannerCookie })
    assert(on.json?.case?.pinned === true, 'case detail did not report pinned:true after pin')
    await http(`/api/portal/cases/${doctorCase.id}/pin`, { method: 'DELETE', cookie: plannerCookie })
    const off = await http(`/api/portal/cases/${doctorCase.id}`, { cookie: plannerCookie })
    assert(!off.json?.case?.pinned, 'case detail still reported pinned after unpin')
  })

  // ---- 3D annotations (surface pins on a model attachment) -----------------
  console.log('\nAnnotations')
  let modelAttachmentId = ''
  let createdAnnotationId = ''
  await check('seed a model attachment to annotate → 201', async () => {
    const dataUrl = 'data:application/octet-stream;base64,' + Buffer.from('solid test\nendsolid test').toString('base64')
    const res = await http(`/api/portal/cases/${doctorCase.id}/messages`, {
      method: 'POST', cookie: plannerCookie,
      body: { body: 'scan', attachments: [{ name: 'annot-scan.stl', mimeType: '', size: 22, dataUrl }] },
    })
    assert(res.status === 201, `status ${res.status}: ${res.text}`)
    const msgs: Array<{ attachments?: Array<{ id: string; name: string }> }> = res.json?.messages ?? []
    for (const m of msgs) for (const a of m.attachments ?? []) if (a.name === 'annot-scan.stl') modelAttachmentId = a.id
    assert(modelAttachmentId, 'could not find the seeded .stl attachment id')
  })
  await check('annotation requires auth → 401', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/annotations`, { method: 'POST', body: { attachmentId: modelAttachmentId, x: 0, y: 0, z: 0, body: 'x' } })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  })
  await check('create a pin → 201 and it appears in the list with canDelete', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/annotations`, { method: 'POST', cookie: plannerCookie, body: { attachmentId: modelAttachmentId, x: 0.1, y: -0.2, z: 0.3, body: 'open this contact' } })
    assert(res.status === 201, `status ${res.status}: ${res.text}`)
    createdAnnotationId = res.json?.annotation?.id
    assert(createdAnnotationId, 'created annotation has no id')
    assert(res.json?.annotation?.canDelete === true, 'author should be able to delete their own pin')
    const list = await http(`/api/portal/cases/${doctorCase.id}/annotations`, { cookie: plannerCookie })
    const found = (list.json?.annotations ?? []).find((a: { id: string }) => a.id === createdAnnotationId)
    assert(found?.attachmentId === modelAttachmentId, 'pin not returned for its attachment')
    assert(found?.body === 'open this contact', 'pin note not persisted')
  })
  await check('pin without a note → 400', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/annotations`, { method: 'POST', cookie: plannerCookie, body: { attachmentId: modelAttachmentId, x: 0, y: 0, z: 0, body: '   ' } })
    assert(res.status === 400, `expected 400, got ${res.status}`)
  })
  await check('pin without a surface point → 400', async () => {
    const res = await http(`/api/portal/cases/${doctorCase.id}/annotations`, { method: 'POST', cookie: plannerCookie, body: { attachmentId: modelAttachmentId, body: 'no point' } })
    assert(res.status === 400, `expected 400, got ${res.status}`)
  })
  await check('pin on an attachment not in this case → 404', async () => {
    const other = allCases.find(c => c.id !== doctorCase.id)
    if (!other) return 'skip'
    const res = await http(`/api/portal/cases/${other.id}/annotations`, { method: 'POST', cookie: plannerCookie, body: { attachmentId: modelAttachmentId, x: 0, y: 0, z: 0, body: 'wrong case' } })
    assert(res.status === 404, `expected 404, got ${res.status}`)
  })
  await check("doctor cannot annotate another doctor's case → 403", async () => {
    if (!doctorCookie) return 'skip'
    const other = allCases.find(c => String(c.doctorId) !== String(doctorCase.doctorId))
    if (!other) return 'skip'
    const res = await http(`/api/portal/cases/${other.id}/annotations`, { method: 'POST', cookie: doctorCookie, body: { attachmentId: modelAttachmentId, x: 0, y: 0, z: 0, body: 'nope' } })
    assert(res.status === 403, `expected 403, got ${res.status}`)
  })
  await check('delete a pin → 200 and it is gone; deleting again → 404', async () => {
    if (!createdAnnotationId) return 'skip'
    const del = await http(`/api/portal/cases/${doctorCase.id}/annotations/${createdAnnotationId}`, { method: 'DELETE', cookie: plannerCookie })
    assert(del.status === 200, `status ${del.status}: ${del.text}`)
    const list = await http(`/api/portal/cases/${doctorCase.id}/annotations`, { cookie: plannerCookie })
    const gone = !(list.json?.annotations ?? []).some((a: { id: string }) => a.id === createdAnnotationId)
    assert(gone, 'pin still present after delete')
    const again = await http(`/api/portal/cases/${doctorCase.id}/annotations/${createdAnnotationId}`, { method: 'DELETE', cookie: plannerCookie })
    assert(again.status === 404, `expected 404 on second delete, got ${again.status}`)
  })

  // ---- Notifications lifecycle --------------------------------------------
  console.log('\nNotifications')
  await check('lab message notifies the doctor; title = CASE TITLE (not DL-####)', async () => {
    if (!doctorCookie) return 'skip'
    const before = await http('/api/portal/notifications', { cookie: doctorCookie })
    const beforeCount = before.json?.unreadCount ?? 0
    const post = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: plannerCookie, body: { body: 'smoke: planner → doctor' } })
    assert(post.status === 201, `message post ${post.status}`)
    await delay(500)
    const after = await http('/api/portal/notifications', { cookie: doctorCookie })
    const items: Array<{ title: string; body: string; read: boolean; id: number }> = after.json?.items ?? []
    assert((after.json?.unreadCount ?? 0) > beforeCount, `unread did not increase (${beforeCount} → ${after.json?.unreadCount})`)
    assert(items[0]?.title === doctorCase.title, `title was "${items[0]?.title}", expected case title "${doctorCase.title}"`)
    assert(!/^DL-\d+/.test(items[0]?.title ?? ''), 'title still leads with the DL-#### code')
  })
  await check('doctor message notifies the lab team (planner)', async () => {
    if (!doctorCookie) return 'skip'
    const before = await http('/api/portal/notifications', { cookie: plannerCookie })
    const beforeCount = before.json?.unreadCount ?? 0
    const post = await http(`/api/portal/cases/${doctorCase.id}/messages`, { method: 'POST', cookie: doctorCookie, body: { body: 'smoke: doctor → lab' } })
    assert(post.status === 201, `message post ${post.status}`)
    await delay(500)
    const after = await http('/api/portal/notifications', { cookie: plannerCookie })
    assert((after.json?.unreadCount ?? 0) > beforeCount, 'planner unread did not increase after doctor message')
  })
  await check('status change notifies the doctor with a "Status:" body', async () => {
    if (!doctorCookie) return 'skip'
    await http(`/api/portal/cases/${doctorCase.id}`, { method: 'PATCH', cookie: plannerCookie, body: { status: doctorCase.status } })
    await delay(500)
    const after = await http('/api/portal/notifications', { cookie: doctorCookie })
    const items: Array<{ body: string; type?: string }> = after.json?.items ?? []
    assert(items.some(i => /^Status:/.test(i.body)), 'no "Status:" notification found for the doctor')
  })
  await check('mark one notification read decrements unread', async () => {
    if (!doctorCookie) return 'skip'
    const list = await http('/api/portal/notifications', { cookie: doctorCookie })
    const unread = (list.json?.items ?? []).find((i: { read: boolean }) => !i.read)
    if (!unread) return 'skip'
    const before = list.json?.unreadCount ?? 0
    const res = await http('/api/portal/notifications/read', { method: 'POST', cookie: doctorCookie, body: { id: unread.id } })
    assert(res.status === 200, `read ${res.status}`)
    await delay(200)
    const after = await http('/api/portal/notifications', { cookie: doctorCookie })
    assert((after.json?.unreadCount ?? 0) < before, 'unread did not decrease')
  })
  await check('mark all read → unreadCount 0', async () => {
    if (!doctorCookie) return 'skip'
    await http('/api/portal/notifications/read', { method: 'POST', cookie: doctorCookie, body: {} })
    await delay(200)
    const after = await http('/api/portal/notifications', { cookie: doctorCookie })
    assert((after.json?.unreadCount ?? 0) === 0, `unread is ${after.json?.unreadCount}, expected 0`)
  })
  await check('clear all → no items remain', async () => {
    if (!doctorCookie) return 'skip'
    await http('/api/portal/notifications/clear', { method: 'POST', cookie: doctorCookie })
    await delay(200)
    const after = await http('/api/portal/notifications', { cookie: doctorCookie })
    assert((after.json?.items ?? []).length === 0, `still ${after.json?.items?.length} item(s) after clear`)
  })

  // ---- Web push ------------------------------------------------------------
  console.log('\nWeb push')
  await check('subscribe with a malformed body → 400 (push enabled)', async () => {
    const res = await http('/api/portal/push/subscribe', { method: 'POST', cookie: plannerCookie, body: {} })
    if (res.status === 501) return 'skip' // push not configured in this env
    assert(res.status === 400, `expected 400, got ${res.status}`)
  })
  await check('subscribe + unsubscribe a (fake) subscription → 200 / 200', async () => {
    const endpoint = `https://smoke.example/ep-${Date.now()}`
    const sub = { endpoint, keys: { p256dh: 'BOguzZ_smoke_key_p256dh_placeholder', auth: 'c21va2VfYXV0aA' } }
    const res = await http('/api/portal/push/subscribe', { method: 'POST', cookie: plannerCookie, body: sub })
    if (res.status === 501) return 'skip'
    assert(res.status === 200, `subscribe ${res.status}`)
    const un = await http('/api/portal/push/unsubscribe', { method: 'POST', cookie: plannerCookie, body: { endpoint } })
    assert(un.status === 200, `unsubscribe ${un.status}`)
  })

  // ---- SSE stream ----------------------------------------------------------
  console.log('\nSSE stream')
  await check('stream requires auth → 401', async () => {
    const res = await fetch(BASE + '/api/portal/stream')
    await res.body?.cancel().catch(() => {})
    assert(res.status === 401, `got ${res.status}`)
  })
  await check('stream connects with auth as text/event-stream', async () => {
    const res = await fetch(BASE + '/api/portal/stream', { headers: { Cookie: plannerCookie } })
    const ct = res.headers.get('content-type') ?? ''
    await res.body?.cancel().catch(() => {})
    assert(res.status === 200, `status ${res.status}`)
    assert(ct.includes('text/event-stream'), `content-type "${ct}"`)
  })
  await check('status change is delivered as an SSE "update" event (powers the live sidebar/thread)', async () => {
    if (!doctorCookie) return 'skip'
    // Open the OWNER's stream (a doctor only receives events for their own cases,
    // so this also exercises the role scoping). Then change the status as the
    // PLANNER — the cross-user path the live progress bar relies on.
    const controller = new AbortController()
    const res = await fetch(BASE + '/api/portal/stream', { headers: { Cookie: doctorCookie }, signal: controller.signal })
    assert(res.status === 200 && !!res.body, `stream status ${res.status}`)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    const killer = setTimeout(() => controller.abort(), 6000)
    // Fire the status change once we're listening (a no-op to the current status
    // still emits an update event). Fire-and-forget so we can read concurrently.
    setTimeout(() => {
      void http(`/api/portal/cases/${doctorCase.id}`, { method: 'PATCH', cookie: plannerCookie, body: { status: doctorCase.status } })
    }, 300)
    let buf = ''
    let got = false
    try {
      while (!got) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        got = buf.includes('event: update') && buf.includes(`"caseId":"${doctorCase.id}"`)
      }
    } catch {
      /* reader aborted on timeout */
    }
    clearTimeout(killer)
    controller.abort()
    await reader.cancel().catch(() => {})
    assert(got, `no SSE "update" for case ${doctorCase.id} within 6s`)
  })

  // ---- Error flagging (client_error → telemetry, flagged kind:error) -------
  console.log('\nError flagging')
  await check('client_error event is accepted and flagged kind:"error" in the sink', async () => {
    if (FIREHOSE) return 'skip' // ships to Firehose, not the local file
    const marker = `SMOKE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const res = await http('/api/portal/telemetry', {
      method: 'POST',
      cookie: plannerCookie,
      body: { events: [{ sid: 'smoke', ev: 'client_error', t: Date.now(), url: '/portal', props: { marker, message: 'smoke synthetic error' } }] },
    })
    assert(res.status === 204, `telemetry ingest ${res.status}`)
    // The sink appends asynchronously — poll the dev NDJSON file for our marker.
    let hit: string | undefined
    for (let i = 0; i < 15 && !hit; i++) {
      await delay(200)
      const content = await readFile(DEV_FILE, 'utf8').catch(() => '')
      hit = content.split('\n').reverse().find(l => l.includes(marker))
    }
    assert(hit, `no telemetry line with marker ${marker} within ~3s`)
    assert(/"kind":"error"/.test(hit) && /"ev":"client_error"/.test(hit), `record not flagged as error: ${hit}`)
  })

  // ---- Summary -------------------------------------------------------------
  console.log(`\n${'-'.repeat(48)}`)
  console.log(`  ${pass} passed   ${fail} failed   ${skip} skipped`)
  if (fail > 0) console.log(`  failing: ${failed.join(', ')}`)
  console.log('')
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('smoke runner crashed:', e)
  process.exit(2)
})
