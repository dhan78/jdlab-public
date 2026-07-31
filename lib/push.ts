import webpush from 'web-push'
import { eq, inArray } from 'drizzle-orm'
import { db } from './db'
import { pushSubscriptions } from './db/schema'

/**
 * Web Push (VAPID) delivery. Self-hosted — no third-party service. The browser
 * vendor push gateways (FCM / Mozilla / Apple) are free; we only sign requests
 * with our VAPID keypair so the gateway trusts us.
 *
 * Configuration (env, see .env.local):
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   the keypair (generate once)
 *   VAPID_SUBJECT                          mailto: contact for the gateway
 *
 * Push is best-effort: if keys are missing (local/demo) everything no-ops.
 */

const PUBLIC = process.env.VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:info@jdlab.us'

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!PUBLIC || !PRIVATE) return false
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE)
  configured = true
  return true
}

export function isPushEnabled(): boolean {
  return !!(PUBLIC && PRIVATE)
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

/** Persist a browser's push subscription (idempotent on endpoint). */
export async function savePushSubscription(
  userId: number,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    })
}

/** Remove a subscription (on unsubscribe, or when the gateway reports it gone). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
}

/**
 * Send a push to every device of a set of users. Best-effort and fire-and-forget
 * friendly: stale subscriptions (gateway 404/410) are pruned automatically.
 */
export async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  if (!ensureConfigured() || userIds.length === 0) return

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArrayOrSingle(userIds))

  if (subs.length === 0) return
  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410 = the subscription expired or was revoked → drop it.
        if (status === 404 || status === 410) {
          await deletePushSubscription(s.endpoint).catch(() => {})
        }
      }
    })
  )
}

// Small helper so a single-id call still uses an efficient IN clause.
function inArrayOrSingle(userIds: number[]) {
  return userIds.length === 1
    ? eq(pushSubscriptions.userId, userIds[0])
    : inArray(pushSubscriptions.userId, userIds)
}
