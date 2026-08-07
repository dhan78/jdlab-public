import { notFound } from 'next/navigation'
import DemoCaseView, { type DemoModel } from '@/components/DemoCaseView'
import type { ScanAnnotation } from '@/components/ScanViewer'
import { isDemoEnabled, getDemoCaseId } from '@/lib/demo-config'
import {
  findCaseById,
  listMessagesForCase,
  listCaseAnnotations,
  CASE_STATUS_LABELS,
  type CaseStatus,
} from '@/lib/case-store'
import { CASE_TYPE_LABELS, type CaseType } from '@/lib/case-meta'

export const metadata = {
  title: 'Live sample case — JD Dental Lab',
  description: 'Explore a real dental case in 3D — spin, zoom, and see the lab’s margins and measurements marked right on the scan.',
  robots: { index: false, follow: false },
}

// Read the runtime kill-switch on every request (no static caching) so an admin
// can turn the demo off instantly.
export const dynamic = 'force-dynamic'

const isModel = (name: string) => /\.(stl|ply|glb)$/i.test(name)

export default async function DemoPage() {
  // Runtime kill-switch: off by default; 404 when disabled so there's nothing
  // for a bad actor to probe.
  if (!(await isDemoEnabled())) notFound()

  const caseId = await getDemoCaseId()
  if (!caseId) notFound()

  const caseRow = await findCaseById(caseId)
  if (!caseRow) notFound()

  const [messages, annotations] = await Promise.all([
    listMessagesForCase(caseId),
    listCaseAnnotations(caseId),
  ])

  // Group the lab's annotations by the attachment they belong to.
  const annByAttachment = new Map<string, ScanAnnotation[]>()
  for (const a of annotations) {
    const mapped: ScanAnnotation = {
      id: a.id,
      kind: a.kind,
      x: a.x,
      y: a.y,
      z: a.z,
      bx: a.bx,
      by: a.by,
      bz: a.bz,
      body: a.body,
      authorName: a.authorName,
      authorRole: a.authorRole,
      createdAt: a.createdAt,
      canDelete: false,
    }
    const list = annByAttachment.get(a.attachmentId) ?? []
    list.push(mapped)
    annByAttachment.set(a.attachmentId, list)
  }

  // Collect every 3D model attachment across the thread.
  const models: DemoModel[] = []
  for (const m of messages) {
    for (const att of m.attachments) {
      if (!isModel(att.name)) continue
      models.push({
        id: att.id,
        name: att.name,
        dataUrl: att.dataUrl,
        annotations: annByAttachment.get(att.id) ?? [],
      })
    }
  }

  return (
    <DemoCaseView
      title={caseRow.title}
      caseType={CASE_TYPE_LABELS[caseRow.caseType as CaseType] ?? caseRow.caseType}
      status={CASE_STATUS_LABELS[caseRow.status as CaseStatus] ?? caseRow.status}
      toothRef={caseRow.toothRef}
      material={caseRow.material}
      turnaround={caseRow.isRush ? 'Rush' : undefined}
      models={models}
    />
  )
}
