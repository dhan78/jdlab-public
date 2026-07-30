import { db } from './db'
import { notifications, users } from './db/schema'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { encodeCaseId } from './case-code'

/**
 * Per-user activity notifications powering the header bell. Rows are written by
 * the dispatch helper (lib/notify-dispatch.ts) at the same points that emit a
 * live case update, so the bell and the thread stay in sync.
 */

export type NotificationType = 'message' | 'status' | 'approval'

export interface NotificationItem {
  id: number
  type: NotificationType
  title: string
  body: string
  caseToken: string | null // opaque URL token (encoded case id)
  read: boolean
  createdAt: string
}

// Ids of the lab team (planners + admins) — the recipients when a doctor posts.
export async function getLabUserIds(): Promise<number[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ['planner', 'admin']))
  return rows.map(r => r.id)
}

export interface NewNotification {
  userId: number
  caseId: number | null
  type: NotificationType
  title: string
  body: string
}

/** Bulk-insert notification rows (one per recipient). No-op on empty input. */
export async function createNotifications(rows: NewNotification[]): Promise<void> {
  if (rows.length === 0) return
  await db.insert(notifications).values(rows)
}

/** Recent notifications for a user + how many are unread. */
export async function listNotifications(
  userId: number,
  limit = 20
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return {
    items: rows.map(r => ({
      id: r.id,
      type: r.type as NotificationType,
      title: r.title,
      body: r.body,
      caseToken: r.caseId != null ? encodeCaseId(r.caseId) : null,
      read: r.readAt != null,
      createdAt: r.createdAt.toISOString(),
    })),
    unreadCount: count ?? 0,
  }
}

/** Mark one notification (by id) or all of a user's notifications as read. */
export async function markNotificationsRead(
  userId: number,
  id?: number
): Promise<void> {
  const where =
    id != null
      ? and(eq(notifications.userId, userId), eq(notifications.id, id))
      : and(eq(notifications.userId, userId), isNull(notifications.readAt))
  await db.update(notifications).set({ readAt: new Date() }).where(where)
}

/** Delete all of a user's notifications (the "Clear all" action). */
export async function clearNotifications(userId: number): Promise<void> {
  await db.delete(notifications).where(eq(notifications.userId, userId))
}
