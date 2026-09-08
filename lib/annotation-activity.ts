import type { AnnotationActivityMeta } from './case-store'

// Pure builders for the thread "annotation activity" entry — no auth/DB, so the
// summary/meta logic is unit-testable in isolation (the route just wires session
// + addMessage around this).

const NOTE_CAP = 500 // matches an annotation body cap
const MAX_ITEMS = 200

export type ActivityKind = 'pin' | 'measure' | 'mixed'

export interface AnnotationActivityInput {
  attachmentId?: string | null
  previewKey?: string | null
  modelName?: string
  annotationIds: string[]
  notes?: string[]
  kind?: string
}

export interface AnnotationActivity {
  summary: string
  meta: AnnotationActivityMeta
}

export function normalizeKind(kind: unknown): ActivityKind {
  return kind === 'measure' ? 'measure' : kind === 'mixed' ? 'mixed' : 'pin'
}

export function nounFor(kind: ActivityKind): string {
  return kind === 'measure' ? 'measurement' : kind === 'mixed' ? 'annotation' : 'pin'
}

// Build the thread summary line + deep-link meta for a batch of annotations.
// Single pin with a note → the note is quoted inline in the fallback body; the
// thread renders the full note list from meta.notes.
export function buildAnnotationActivity(input: AnnotationActivityInput): AnnotationActivity {
  const kind = normalizeKind(input.kind)
  const modelName =
    typeof input.modelName === 'string' && input.modelName.trim()
      ? input.modelName.slice(0, 200)
      : 'the scan'
  const annotationIds = (input.annotationIds ?? [])
    .filter((x): x is string => typeof x === 'string')
    .slice(0, MAX_ITEMS)
  const notes = (input.notes ?? [])
    .filter((x): x is string => typeof x === 'string')
    .map(s => s.trim().slice(0, NOTE_CAP))
    .filter(Boolean)
    .slice(0, MAX_ITEMS)

  const count = annotationIds.length
  const noun = nounFor(kind)
  const label = count === 1 ? noun : `${noun}s`
  const summary =
    count === 1
      ? notes[0]
        ? `Added a ${noun} to ${modelName}: “${notes[0]}”`
        : `Added a ${noun} to ${modelName}`
      : `Added ${count} ${label} to ${modelName}`

  return {
    summary,
    meta: {
      attachmentId: input.attachmentId ?? null,
      previewKey: input.previewKey ?? null,
      modelName,
      annotationIds,
      notes,
      count,
      kind,
    },
  }
}
