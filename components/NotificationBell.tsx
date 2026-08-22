'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeCaseEvents } from '@/lib/portal-stream'

interface NotificationItem {
  id: number
  type: 'message' | 'status' | 'approval'
  title: string
  body: string
  caseToken: string | null
  read: boolean
  createdAt: string
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

// VAPID public key (base64url) → Uint8Array for PushManager.subscribe.
function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export default function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [pushState, setPushState] = useState<'unsupported' | 'off' | 'on' | 'busy'>('off')
  const [pushMsg, setPushMsg] = useState('')
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape. We can't rely on a `fixed inset-0`
  // backdrop: the portal header uses `backdrop-blur`, which establishes a
  // containing block for fixed descendants, so the backdrop would only cover
  // the header, not the page below it.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { items: NotificationItem[]; unreadCount: number }
      setItems(data.items)
      setUnread(data.unreadCount)
    } catch {
      /* offline / transient — keep last known */
    }
  }, [])

  // Initial load + refetch on any live case update (debounced).
  useEffect(() => {
    load()
    const unsub = subscribeCaseEvents(e => {
      if (e.event !== 'update') return
      clearTimeout(refetchTimer.current)
      refetchTimer.current = setTimeout(load, 400)
    })
    return () => {
      unsub()
      clearTimeout(refetchTimer.current)
    }
  }, [load])

  // Detect push support + current subscription state.
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      setPushState('unsupported')
      return
    }
    navigator.serviceWorker
      .getRegistration()
      .then(reg => reg?.pushManager.getSubscription())
      .then(sub => setPushState(sub ? 'on' : 'off'))
      .catch(() => setPushState('off'))
  }, [])

  const enablePush = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return
    // Already blocked at the browser level — requestPermission() resolves
    // 'denied' instantly, so tell the user how to fix it instead of silently
    // snapping the toggle back to grey.
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setPushMsg('Notifications are blocked for this site — allow them in the browser site settings (the icon left of the URL), then try again.')
      return
    }
    setPushMsg('')
    setPushState('busy')
    // Guard against environments where the permission prompt / subscription
    // never resolves (e.g. embedded browsers) so we never hang in 'busy'.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    )
    try {
      await Promise.race([
        (async () => {
          const perm = await Notification.requestPermission()
          if (perm !== 'granted') throw new Error('denied')
          const reg = await navigator.serviceWorker.register('/sw.js')
          await navigator.serviceWorker.ready
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          })
          const res = await fetch('/api/portal/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          })
          if (!res.ok) throw new Error('save')
        })(),
        timeout,
      ])
      setPushState('on')
    } catch (e) {
      setPushState('off')
      const m = (e as Error).message
      setPushMsg(
        m === 'denied'
          ? 'Permission denied — allow notifications for this site to enable push.'
          : m === 'timeout'
            ? 'Could not enable here — use a normal Chrome/Edge window (not an embedded browser).'
            : 'Could not enable push on this device.'
      )
    }
  }, [])

  const disablePush = useCallback(async () => {
    setPushState('busy')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/portal/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushState('off')
    } catch {
      setPushState('on')
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setItems(prev => prev.map(i => ({ ...i, read: true })))
    setUnread(0)
    await fetch('/api/portal/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {})
  }, [])

  const clearAll = useCallback(async () => {
    setItems([])
    setUnread(0)
    await fetch('/api/portal/notifications/clear', { method: 'POST' }).catch(() => {})
  }, [])

  const openItem = useCallback(
    async (item: NotificationItem) => {
      setOpen(false)
      if (!item.read) {
        setItems(prev => prev.map(i => (i.id === item.id ? { ...i, read: true } : i)))
        setUnread(u => Math.max(0, u - 1))
        fetch('/api/portal/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        }).catch(() => {})
      }
      if (item.caseToken) router.push(`/portal/cases/${item.caseToken}`)
    },
    [router]
  )

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        data-intent="notifications_toggle"
        className="relative p-2 rounded-lg text-slate-600 hover:text-primary hover:bg-slate-100 transition-colors"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M10 3a4 4 0 0 0-4 4c0 3-1.5 4.5-2 5h12c-.5-.5-2-2-2-5a4 4 0 0 0-4-4Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 16a1.5 1.5 0 0 0 3 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[11px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button type="button" onClick={markAllRead} data-intent="notifications_mark_all_read" className="text-xs text-primary hover:underline">
                    Mark all read
                  </button>
                )}
                {items.length > 0 && (
                  <button type="button" onClick={clearAll} data-intent="notifications_clear" className="text-xs text-slate-500 hover:text-red-600 hover:underline">
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {pushState !== 'unsupported' && (
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M10 3a4 4 0 0 0-4 4c0 3-1.5 4.5-2 5h12c-.5-.5-2-2-2-5a4 4 0 0 0-4-4Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8.5 16a1.5 1.5 0 0 0 3 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm text-slate-700">
                      {pushState === 'busy' ? 'Enabling…' : 'Push notifications on this device'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={pushState === 'on'}
                    aria-label="Toggle push notifications on this device"
                    onClick={pushState === 'on' ? disablePush : enablePush}
                    data-intent="push_toggle"
                    disabled={pushState === 'busy'}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${pushState === 'on' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pushState === 'on' ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
                {pushMsg && <p className="mt-1.5 text-xs text-amber-600">{pushMsg}</p>}
              </div>
            )}

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
              ) : (
                items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    data-intent="notification_open"
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${item.read ? '' : 'bg-primary/5'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" aria-hidden="true" />}
                      <div className={`min-w-0 ${item.read ? 'pl-4' : ''}`}>
                        <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                        <p className="text-sm text-slate-500 truncate">{item.body}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{timeAgo(item.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
      )}
    </div>
  )
}
