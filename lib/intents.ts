/**
 * Governed catalog of UI interaction intents.
 *
 * Every `data-intent="…"` attribute in the app MUST use a key from this
 * registry. The global click/tap listener in components/TelemetryProvider.tsx
 * reads that attribute and emits a `ui_click` telemetry event tagged with the
 * intent — so this file is the single source of truth for the interaction
 * taxonomy (the "event dictionary" a mature analytics setup keeps in a schema
 * registry like Segment Protocols / Avo / Snowplow).
 *
 * Convention: intents are `noun_verb` (or `noun_noun_verb`), lower_snake_case,
 * describing the USER'S INTENT — never element text or any patient data.
 *
 * Governance: in development, TelemetryProvider warns (once) if it sees a
 * `data-intent` value that isn't listed here, so typos / unregistered intents
 * surface immediately instead of silently polluting the warehouse.
 */

export const INTENTS = {
  // --- Global navigation / chrome ---
  nav_cases: 'Open the cases home from the portal header',
  nav_admin: 'Open the admin area',
  nav_profile: 'Open the profile page',
  logout: 'Sign out',
  rail_toggle: 'Show/hide the case sidebar rail',
  recent_drawer_open: 'Open the mobile recent-cases drawer',
  recent_drawer_close: 'Close the mobile recent-cases drawer',

  // --- Notifications ---
  notifications_toggle: 'Open/close the notification bell menu',
  notifications_mark_all_read: 'Mark all notifications read',
  notifications_clear: 'Clear all notifications',
  notification_open: 'Open a single notification',
  push_toggle: 'Enable/disable web push',

  // --- Case list / dashboard ---
  case_open: 'Open a case thread',
  new_case_toggle: 'Show/hide the new-case form',
  case_create: 'Submit the new-case form',
  filter_unread_toggle: 'Toggle the unread-only filter',
  filter_clear: 'Clear list filters',
  page_prev: 'Previous page of the case list',
  page_next: 'Next page of the case list',
  segment_select: 'Choose a segmented-control option (status/type filter, etc.)',

  // --- Case thread ---
  message_send: 'Send a thread message',
  attach_files: 'Open the file picker to attach files',
  attach_remove: 'Remove a pending attachment before send',
  design_approve: 'Approve the design',
  case_pin_toggle: 'Pin/unpin the case',
  case_read_toggle: 'Mark the case read/unread',
  case_details_open: 'Open the case-details editor',
  case_details_save: 'Save edited case details',
  scans_received_mark: 'Mark scans as received (starts the SLA clock)',
  status_change: 'Change the case status',
  case_delete: 'Admin: permanently delete a case and all its files',
  call_start: 'Start a live video call (placeholder)',

  // --- Attachments / viewers ---
  attachment_download: 'Download an attachment',
  image_open: 'Open an image in the lightbox',
  image_download: 'Download the lightboxed image',
  image_prev: 'Previous image in the lightbox',
  image_next: 'Next image in the lightbox',
  lightbox_close: 'Close the image lightbox',
  lightbox_zoom_in: 'Zoom in (lightbox)',
  lightbox_zoom_out: 'Zoom out (lightbox)',
  lightbox_zoom_reset: 'Reset zoom (lightbox)',
  viewer_maximize: 'Expand a 3D/HTML viewer to full window',
  viewer_close: 'Close the full-window viewer',

  // --- 3D annotations ---
  annotation_addmode: 'Enter add-pin mode on a scan',
  annotation_addmode_cancel: 'Leave add-pin mode',
  annotation_open: 'Open a pin note',
  annotation_save: 'Save a new pin note',
  annotation_cancel: 'Cancel the draft pin',
  annotation_delete: 'Delete a pin',

  // --- 3D measure tool ---
  measure_toggle: 'Enter/leave measure mode on a scan',
  measure_point: 'Place a measurement point on the model surface',
  measure_clear: 'Clear the current measurement',
  measure_save: 'Save/share a measurement with a note',
  measure_cancel: 'Cancel the pending measurement',
  measure_open: 'Open a saved measurement note',
  measure_delete: 'Delete a saved measurement',
  view_reset: 'Reset the 3D camera to the default framing',

  // --- Admin: doctors ---
  admin_doctor_create: 'Create a doctor account',
  admin_doctor_edit_toggle: 'Start/cancel editing a doctor',
  admin_doctor_edit_save: 'Save doctor edits',
  admin_doctor_edit_cancel: 'Cancel doctor edits',
  admin_doctor_delete: 'Delete a doctor',

  // --- Admin: SLA ---
  sla_save: 'Save an SLA turnaround row',

  // --- Admin: public demo case ---
  demo_case_save: 'Save the public demo case id',
  demo_toggle: 'Turn the public demo on/off',

  // --- Admin: scan-ingestion practice routing ---
  practice_map_save: 'Add/update a practice -> doctor mapping',
  practice_map_delete: 'Remove a practice -> doctor mapping',

  // --- Admin: marketing images ---
  marketing_image_drop: 'Drop/choose marketing images to optimize + save',
  marketing_image_collection: 'Pick the collection for uploaded images',
  marketing_image_copy_path: 'Copy a marketing image path',
  marketing_image_delete: 'Remove a marketing image',

  // --- Admin: dashboard nav ---
  admin_nav: 'Switch admin dashboard section',

  // --- Admin: telemetry viewer ---
  telemetry_session_open: 'Open a telemetry session timeline',
  telemetry_copy_steps: 'Copy the session steps',

  // --- Addresses (profile) ---
  address_add: 'Add a practice address',
  address_edit_start: 'Start editing an address',
  address_edit_save: 'Save an address edit',
  address_edit_cancel: 'Cancel an address edit',
  address_set_preferred: 'Set an address as preferred',
  address_remove: 'Remove an address',

  // --- Auth forms ---
  login_submit: 'Submit the login form',
  forgot_password_submit: 'Submit the forgot-password form',
  reset_password_submit: 'Submit the reset-password form',
} as const

export type Intent = keyof typeof INTENTS

/** Fast membership check used by the dev-time governance warning. */
export const INTENT_SET: ReadonlySet<string> = new Set(Object.keys(INTENTS))

/** Whether a raw `data-intent` value is a registered intent. */
export function isKnownIntent(value: string): value is Intent {
  return INTENT_SET.has(value)
}
