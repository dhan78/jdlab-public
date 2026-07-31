'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface UserRow {
  uid: string
  name: string | null
  role: string | null
  lastT: number | null
  sessions: number
  events: number
}
interface SessionRow {
  sid: string
  startT: number | null
  endT: number | null
  count: number
  ua: string | null
  viewport?: { w?: number; h?: number }
}
interface EventRow {
  sid: string | null
  ev: string
  kind?: string | null
  req_id?: string | null
  message?: string | null
  name?: string | null
  client_t: number | null
  ingest_t?: number
  url: string | null
  props?: Record<string, unknown>
}

const API = '/api/portal/admin/telemetry'

function fmtTime(t: number | null): string {
  if (!t) return '—'
  return new Date(t).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
function fmtDuration(a: number | null, b: number | null): string {
  if (!a || !b || b < a) return '—'
  const s = Math.round((b - a) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}
function browserOf(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Browser'
}

// Human label + icon for each instrumented event (metadata only — no PHI).
function describe(e: EventRow): { icon: string; label: string; detail?: string } {
  const p = e.props ?? {}
  switch (e.ev) {
    case 'session_start': return { icon: '●', label: 'Session started', detail: p.w && p.h ? `${p.w}×${p.h}` : undefined }
    case 'page_view': return { icon: '▸', label: 'Viewed page', detail: String(p.path ?? e.url ?? '') }
    case 'case_open': {
      const from =
        p.from === 'recent' ? 'Recently viewed (rail)'
        : p.from === 'keyboard' ? 'keyboard nav'
        : p.from === 'list' ? 'Case list (middle)'
        : p.from ? String(p.from) : ''
      return { icon: '📂', label: `Opened case ${p.caseId ?? ''}`, detail: from ? `from ${from}` : undefined }
    }
    case 'composer_focus': return { icon: '✎', label: 'Focused message composer', detail: p.caseId ? `case ${p.caseId}` : undefined }
    case 'message_send': return { icon: '➤', label: 'Sent a message', detail: `${p.len ?? 0} chars${p.attachments ? ` · ${p.attachments} file(s)` : ''}` }
    case 'status_change': return { icon: '⇪', label: `Status → ${p.status ?? ''}`, detail: p.caseId ? `case ${p.caseId}` : undefined }
    case 'scan_received': return { icon: '📥', label: p.received ? 'Marked scans received' : 'Cleared scans received', detail: p.caseId ? `case ${p.caseId}` : undefined }
    case 'filter_unread': return { icon: '🔴', label: `Unread filter ${p.on ? 'on' : 'off'}` }
    case 'filter_rush': return { icon: '⚡', label: `Rush filter ${p.on ? 'on' : 'off'}` }
    case 'search': return { icon: '🔍', label: 'Searched', detail: `${p.len ?? 0} chars` }
    case 'scope_change': return { icon: '⇄', label: `Scope → ${p.scope ?? ''}` }
    case 'sort_change': return { icon: '↕', label: `Sort → ${p.sort ?? ''}` }
    case 'new_case_toggle': return { icon: '＋', label: `New-case form ${p.open ? 'opened' : 'closed'}` }
    case 'rail_toggle': return { icon: '◧', label: `Recently-viewed ${p.open ? 'shown' : 'hidden'}` }
    case 'client_error':
    case 'app_error': {
      const raw = e.message ?? (typeof p.message === 'string' ? p.message : '')
      const msg = raw || 'Error'
      return { icon: '⛔', label: `Error: ${msg}`, detail: e.name ?? (e.ev === 'client_error' ? 'browser' : undefined) }
    }
    default: return { icon: '•', label: e.ev, detail: Object.keys(p).length ? JSON.stringify(p) : undefined }
  }
}

export default function TelemetryViewer() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [source, setSource] = useState<string>('')
  const [uid, setUid] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sid, setSid] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(API)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => { setUsers(d.users ?? []); setSource(d.source ?? '') })
      .catch(e => setErr(String(e.message)))
  }, [])

  const loadSessions = useCallback((nextUid: string) => {
    setUid(nextUid); setSid(''); setEvents([]); setSessions([])
    if (!nextUid) return
    setLoading(true)
    fetch(`${API}?uid=${encodeURIComponent(nextUid)}`)
      .then(r => r.json())
      .then(d => setSessions(d.sessions ?? []))
      .catch(e => setErr(String(e.message)))
      .finally(() => setLoading(false))
  }, [])

  const loadEvents = useCallback((nextSid: string) => {
    setSid(nextSid); setEvents([])
    if (!uid || !nextSid) return
    setLoading(true)
    fetch(`${API}?uid=${encodeURIComponent(uid)}&sid=${encodeURIComponent(nextSid)}`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(e => setErr(String(e.message)))
      .finally(() => setLoading(false))
  }, [uid])

  const userLabel = (u: UserRow) => `${u.name ?? `${u.role ?? 'user'} ${u.uid}`} — ${u.role ?? '?'} (id ${u.uid})`

  const copySteps = () => {
    const lines = events.map(e => {
      const d = describe(e)
      return `${fmtTime(e.client_t ?? e.ingest_t ?? null)}  ${d.label}${d.detail ? ` — ${d.detail}` : ''}`
    })
    void navigator.clipboard?.writeText(lines.join('\n'))
  }

  // Render events with idle-gap dividers (> 30s).
  const timeline = useMemo(() => {
    const rows: Array<{ kind: 'gap'; ms: number } | { kind: 'ev'; e: EventRow }> = []
    let prev: number | null = null
    for (const e of events) {
      const t = e.client_t ?? e.ingest_t ?? null
      if (prev != null && t != null && t - prev > 30_000) rows.push({ kind: 'gap', ms: t - prev })
      rows.push({ kind: 'ev', e })
      if (t != null) prev = t
    }
    return rows
  }, [events])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Left: user picker + sessions */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">User</label>
          <select
            value={uid}
            onChange={e => loadSessions(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select a user…</option>
            {users.map(u => (
              <option key={u.uid} value={u.uid}>{userLabel(u)}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            {users.length} user(s) with activity · source: {source || '—'}
          </p>
        </div>

        {uid && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sessions ({sessions.length})
            </div>
            {sessions.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">{loading ? 'Loading…' : 'No sessions.'}</p>
            ) : (
              <ul className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
                {sessions.map(s => (
                  <li key={s.sid}>
                    <button
                      onClick={() => loadEvents(s.sid)}
                      className={`w-full text-left px-4 py-3 transition-colors ${sid === s.sid ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-slate-50 border-l-2 border-transparent'}`}
                    >
                      <div className="text-sm font-medium text-slate-800">{fmtTime(s.startT)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {fmtDuration(s.startT, s.endT)} · {s.count} events · {browserOf(s.ua)}
                        {s.viewport?.w ? ` · ${s.viewport.w}×${s.viewport.h}` : ''}
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 truncate">{s.sid}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Right: timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white min-h-[50vh]">
        {err && <p className="p-4 text-sm text-red-600">Error: {err}</p>}
        {!sid ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400 text-xl">⧗</div>
            <h2 className="text-base font-semibold text-slate-700">Select a session</h2>
            <p className="mt-1 text-sm text-slate-500 max-w-xs">Pick a user, then a session to replay the ordered interaction steps.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">Session {sid.slice(0, 8)}…</div>
                <div className="text-xs text-slate-500">{events.length} events</div>
              </div>
              <button onClick={copySteps} className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50">
                Copy steps
              </button>
            </div>
            <ol className="p-5 space-y-1">
              {timeline.map((row, i) =>
                row.kind === 'gap' ? (
                  <li key={`gap-${i}`} className="flex items-center gap-2 py-1 pl-1 text-[11px] text-slate-400">
                    <span className="flex-1 border-t border-dashed border-slate-200" />
                    ·· {fmtDuration(0, row.ms)} idle ··
                    <span className="flex-1 border-t border-dashed border-slate-200" />
                  </li>
                ) : (() => {
                  const e = row.e
                  const d = describe(e)
                  const isErr = e.kind === 'error' || e.ev === 'client_error' || e.ev === 'app_error'
                  const t = e.client_t ?? e.ingest_t ?? null
                  return (
                  <li key={i} className={`flex items-start gap-3 py-1 ${isErr ? 'bg-red-50 -mx-2 px-2 rounded' : ''}`}>
                    <span className="w-16 shrink-0 text-[11px] tabular-nums text-slate-400 pt-0.5">
                      {t ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                    </span>
                    <span className={`w-5 shrink-0 text-center ${isErr ? 'text-red-500' : 'text-slate-500'}`}>{d.icon}</span>
                    <span className="min-w-0">
                      <span className={`text-sm ${isErr ? 'text-red-700 font-medium' : 'text-slate-800'}`}>{d.label}</span>
                      {d.detail && <span className="text-xs text-slate-500 ml-2">{d.detail}</span>}
                    </span>
                  </li>
                  )
                })()
              )}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
