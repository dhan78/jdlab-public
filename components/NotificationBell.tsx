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
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
    setPushState('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setPushState('off')
        return
      }
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
      setPushState(res.ok ? 'on' : 'off')
    } catch {
      setPushState('off')
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg ring-1 ring-black/5 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button type="button" onClick={markAllRead} className="text-xs text-primary hover:underline">
                    Mark all read
                  </button>
                )}
                {items.length > 0 && (
                  <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-red-600 hover:underline">
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
              ) : (
                items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
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

            {pushState !== 'unsupported' && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                {pushState === 'on' ? (
                  <button type="button" onClick={disablePush} className="text-xs text-slate-500 hover:text-slate-700">
                    🔔 Push notifications on — turn off
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={enablePush}
                    disabled={pushState === 'busy'}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {pushState === 'busy' ? 'Enabling…' : 'Enable push notifications on this device'}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
