import { createNotifications, type NotificationType } from './notifications'
import { sendPushToUsers } from './push'

/**
 * One call to notify a set of users about a case event: persists a bell
 * notification per recipient AND sends a web push to their devices. Designed to
 * be invoked fire-and-forget from API routes (wrap in `void (async () => {})()`)
 * so it never blocks or fails the request.
 */
export async function dispatchNotification(opts: {
  recipientIds: number[]
  caseId: number | null
  caseToken: string
  type: NotificationType
  title: string
  body: string
}): Promise<void> {
  const { recipientIds, caseId, caseToken, type, title, body } = opts
  const ids = [...new Set(recipientIds.filter(n => Number.isInteger(n)))]
  if (ids.length === 0) return

  await createNotifications(ids.map(userId => ({ userId, caseId, type, title, body })))
  await sendPushToUsers(ids, {
    title,
    body,
    url: `/portal/cases/${caseToken}`,
    tag: caseToken,
  })
}
