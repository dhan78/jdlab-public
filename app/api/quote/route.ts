import { NextRequest, NextResponse } from 'next/server'

interface Quote {
  service: string
  quantity: number
  material?: string
  rush?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: Quote = await request.json()

    if (!body.service || !body.quantity) {
      return NextResponse.json(
        { error: 'Service and quantity are required' },
        { status: 400 }
      )
    }

    // Base pricing (demo)
    const basePrices: Record<string, number> = {
      'crowns': 85,
      'implants': 120,
      'cad-cam': 150,
      '3d-printing': 50,
      'dentures': 200,
      'medical': 300
    }

    const basePrice = basePrices[body.service] || 100
    let total = basePrice * body.quantity

    // Material surcharge
    if (body.material === 'zirconia') {
      total *= 1.2
    } else if (body.material === 'titanium') {
      total *= 1.5
    }

    // Rush fee
    if (body.rush) {
      total *= 1.35
    }

    return NextResponse.json({
      success: true,
      quoteId: `QUOTE-${Date.now()}`,
      service: body.service,
      quantity: body.quantity,
      unitPrice: basePrice,
      totalPrice: Math.round(total),
      estimatedTurnaround: body.rush ? '24 hours' : '48 hours',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate quote' },
      { status: 500 }
    )
  }
}
