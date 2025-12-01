import { NextRequest, NextResponse } from 'next/server'

interface CaseTracking {
  caseId: string
  status: 'received' | 'designing' | 'manufacturing' | 'qa' | 'shipped' | 'delivered'
  progress: number
  estimatedDelivery: string
}

// Demo case tracking data
const activeCases: Record<string, CaseTracking> = {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      )
    }

    // Generate tracking info for demo
    const caseStatus: CaseTracking = {
      caseId: body.caseId,
      status: body.status || 'received',
      progress: body.progress || Math.floor(Math.random() * 100),
      estimatedDelivery: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    }

    activeCases[body.caseId] = caseStatus

    return NextResponse.json(caseStatus, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const caseId = searchParams.get('caseId')

  if (caseId && activeCases[caseId]) {
    return NextResponse.json(activeCases[caseId])
  }

  if (!caseId) {
    return NextResponse.json({
      cases: Object.values(activeCases)
    })
  }

  return NextResponse.json(
    { error: 'Case not found' },
    { status: 404 }
  )
}
