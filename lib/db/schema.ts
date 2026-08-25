import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

// Sequential integer / readable IDs (not UUIDs) so the data is easy to browse.
// Trade-off: IDs/URLs are enumerable — access control is enforced in the API.

// Users: doctors, planners (offshore lab), and admins — one table, `role` column.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('doctor'), // 'doctor' | 'planner' | 'admin'
  practiceName: text('practice_name'),
  practiceAddress: text('practice_address'),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// A doctor can have several practice / ship-to addresses; exactly one is the
// preferred (default) address. `users.practice_address` is kept in sync with
// the preferred one so existing single-address reads keep working.
export const practiceAddresses = pgTable(
  'practice_addresses',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'), // optional friendly name, e.g. "Downtown office"
    address: text('address').notNull(),
    isPreferred: boolean('is_preferred').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    userIdx: index('practice_addresses_user_idx').on(t.userId),
  })
)

// Cases (orders). id is the sequential case number; the UI shows it as DL-0001.
export const cases = pgTable(
  'cases',
  {
    id: serial('id').primaryKey(),
    doctorId: integer('doctor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    patientName: text('patient_name'),
    surgeryDate: date('surgery_date'), // YYYY-MM-DD
    toothRef: text('tooth_ref'),
    material: text('material'),
    shade: text('shade'), // VITA shade (e.g. A2) — esthetic color match
    scannerBrand: text('scanner_brand'),
    scanCaseId: text('scan_case_id'),
    scanLink: text('scan_link'),
    specialInstructions: text('special_instructions'),
    shipToAddress: text('ship_to_address'), // snapshot of chosen practice address
    caseType: text('case_type').notNull().default('guide'), // 'guide' | 'crown'
    isRush: boolean('is_rush').notNull().default(false),
    status: text('status').notNull().default('received'),
    // When the lab received the scan files — starts the turnaround SLA clock.
    // Null = "awaiting scan" (clock not running). Set manually by a planner.
    scanReceivedAt: timestamp('scan_received_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    doctorIdx: index('cases_doctor_idx').on(t.doctorId),
    updatedIdx: index('cases_updated_idx').on(t.updatedAt),
  })
)

// Case thread messages. id is "{caseId}-{n}" (e.g. "1-3") so it indicates the
// case and order. Append-only (audit trail); author name/role are a snapshot.
export const caseMessages = pgTable(
  'case_messages',
  {
    id: text('id').primaryKey(), // "{caseId}-{seq}"
    caseId: integer('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    authorRole: text('author_role').notNull(),
    body: text('body').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    caseCreatedIdx: index('case_messages_case_created_idx').on(t.caseId, t.createdAt),
  })
)

// Attachment metadata. Either stored in S3 (`storageKey`) or, for local dev
// without S3, inline base64 in `dataUrl`.
export const messageAttachments = pgTable('message_attachments', {
  id: serial('id').primaryKey(),
  messageId: text('message_id')
    .notNull()
    .references(() => caseMessages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull().default(''),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  storageKey: text('storage_key'), // S3 object key (preferred)
  dataUrl: text('data_url'), // base64 fallback for local dev
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// 3D surface annotations: pins a doctor or planner drops on a specific model
// attachment to point at an exact spot on the scan ("open this contact",
// "margin short here"). Coordinates are stored in the centered-geometry local
// space so they re-anchor to the same surface point every time the model loads.
export const caseAnnotations = pgTable(
  'case_annotations',
  {
    id: serial('id').primaryKey(),
    caseId: integer('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    // Anchor: either a real model attachment (integer id) OR an auto-generated
    // GLB preview (its S3 key). Exactly one is set (enforced in app code).
    attachmentId: integer('attachment_id').references(() => messageAttachments.id, {
      onDelete: 'cascade',
    }),
    previewKey: text('preview_key'),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    z: doublePrecision('z').notNull(),
    // A measurement ('measure') stores a second point (bx,by,bz); a pin ('pin')
    // leaves them null. The distance is derived from the two points at render.
    kind: text('kind').notNull().default('pin'),
    bx: doublePrecision('bx'),
    by: doublePrecision('by'),
    bz: doublePrecision('bz'),
    body: text('body').notNull().default(''),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    authorRole: text('author_role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    caseIdx: index('case_annotations_case_idx').on(t.caseId),
    attachmentIdx: index('case_annotations_attachment_idx').on(t.attachmentId),
  })
)

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
})

// Per-user read state per case: the last time a user viewed a case thread.
// Unread = messages authored by someone else with created_at > last_read_at.
export const caseReads = pgTable(
  'case_reads',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caseId: integer('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
    // Manual "flag for follow-up": marks the case unread regardless of message
    // authorship, so a doctor can re-surface their own case with no lab reply yet.
    flagged: boolean('flagged').notNull().default(false),
    // Manual "pin": keeps the case in the recently-viewed rail until unpinned,
    // independent of view recency. NULL = not pinned; timestamp = pinned-at.
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
  },
  t => ({
    pk: primaryKey({ columns: [t.userId, t.caseId] }),
  })
)

// Optional audit trail of status transitions (powers a real timeline).
export const caseStatusHistory = pgTable('case_status_history', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: integer('changed_by').references(() => users.id, { onDelete: 'set null' }),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
})

// Security/compliance audit trail: who did what, when, from where. Actor and
// case are nullable so the row survives even if the referenced record is gone.
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    caseId: integer('case_id').references(() => cases.id, { onDelete: 'set null' }),
    detail: text('detail'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    actorIdx: index('audit_actor_idx').on(t.actorId),
    createdIdx: index('audit_created_idx').on(t.createdAt),
  })
)

// Configurable SLA turnaround per case type (business days). Admin-editable;
// falls back to code defaults (lib/sla.ts) for any type not present.
export const slaConfig = pgTable('sla_config', {
  caseType: text('case_type').primaryKey(), // matches CaseType
  standardDays: integer('standard_days').notNull(),
  rushDays: integer('rush_days').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Generic runtime key/value settings, admin-editable WITHOUT a redeploy. Used
// as the live kill-switch + target for the public read-only demo case
// (keys: 'demo.enabled', 'demo.caseId'). Kept intentionally tiny/opaque so it
// can hold future runtime flags too.
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Per-user activity notifications (powers the header bell + web push). A row is
// written for each recipient when a case changes (new message, status change).
// Snapshots title/body so the bell renders without extra joins; caseId links
// back to the case (nullable so the row survives if the case is deleted).
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caseId: integer('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'message' | 'status' | 'approval'
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    readAt: timestamp('read_at', { withTimezone: true }), // null = unread
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    userReadIdx: index('notifications_user_read_idx').on(t.userId, t.readAt),
    userCreatedIdx: index('notifications_user_created_idx').on(t.userId, t.createdAt),
  })
)

// Web Push subscriptions (one per browser/device). Endpoint is unique; the two
// keys (p256dh + auth) are needed to encrypt the push payload for that device.
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    userIdx: index('push_subscriptions_user_idx').on(t.userId),
  })
)

// A manufacturing job: an approved case file queued for a machine (mill/printer)
// and pulled by the on-prem lab agent (see /lab-agent) into the CAM/slicer hot
// folder. Lifecycle: queued -> dropped (agent placed it) -> done | error.
export const manufacturingJobs = pgTable(
  'manufacturing_jobs',
  {
    id: serial('id').primaryKey(),
    caseId: integer('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    // Provenance link to the approved design attachment (nullable so the job
    // survives if the message/attachment is later removed).
    attachmentId: integer('attachment_id').references(() => messageAttachments.id, {
      onDelete: 'set null',
    }),
    storageKey: text('storage_key').notNull(), // S3 object the agent downloads
    fileName: text('file_name').notNull(), // name to write into the hot folder
    machine: text('machine'), // optional routing hint: 'mill' | 'printer' | free text
    status: text('status').notNull().default('queued'), // queued|dropped|done|error
    detail: text('detail'), // last status detail (e.g. an error message)
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => ({
    statusIdx: index('manufacturing_jobs_status_idx').on(t.status),
    caseIdx: index('manufacturing_jobs_case_idx').on(t.caseId),
  })
)
