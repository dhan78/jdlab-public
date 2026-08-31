import { NextRequest, NextResponse } from 'next/server'
import { sendContactNotification, sendPilotNotification } from '@/lib/email'
import { db } from '@/lib/db'
import { contactRequests } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

interface ContactRequest {
  name: string
  email: string
  phone?: string
  service?: string
  message?: string
  // Pilot form (source === 'pilot') adds these:
  source?: 'contact' | 'pilot'
  practiceName?: string
  scannerBrand?: string
  monthlyVolume?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactRequest = await request.json()
    const source = body.source === 'pilot' ? 'pilot' : 'contact'

    // Always required
    if (!body.name || !body.email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    // Source-specific required fields
    if (source === 'pilot') {
      if (!body.practiceName || !body.scannerBrand) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
    } else if (!body.service || !body.message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const sanitized = {
      source,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim() || null,
      service: body.service?.trim() || null,
      message: body.message?.trim() || null,
      practiceName: body.practiceName?.trim() || null,
      scannerBrand: body.scannerBrand?.trim() || null,
      monthlyVolume: body.monthlyVolume?.trim() || null,
    }

    // Persist every lead — contact and pilot share one durable table.
    const [row] = await db
      .insert(contactRequests)
      .values(sanitized)
      .returning({ id: contactRequests.id })
    const requestId = `${source === 'pilot' ? 'PILOT' : 'REQ'}-${row.id}`

    try {
      if (source === 'pilot') {
        await sendPilotNotification({
          name: sanitized.name,
          practiceName: sanitized.practiceName!,
          email: sanitized.email,
          phone: sanitized.phone ?? undefined,
          scannerBrand: sanitized.scannerBrand!,
          monthlyVolume: sanitized.monthlyVolume ?? undefined,
          notes: sanitized.message ?? undefined,
          requestId,
        })
      } else {
        await sendContactNotification({
          name: sanitized.name,
          email: sanitized.email,
          phone: sanitized.phone ?? undefined,
          service: sanitized.service!,
          message: sanitized.message!,
          requestId,
        })
      }
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Don't fail the request if email fails — the lead is persisted in the DB.
    }

    return NextResponse.json(
      {
        success: true,
        message:
          source === 'pilot'
            ? 'Thanks! We will reach out within 1 business day.'
            : 'Thank you for your inquiry. We will be in touch soon.',
        requestId,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json({ error: 'Failed to process your request' }, { status: 500 })
  }
}

export async function GET() {
  // Demo listing only — add authentication before exposing in production.
  const rows = await db.select().from(contactRequests).orderBy(desc(contactRequests.createdAt))
  return NextResponse.json({ total: rows.length, requests: rows })
}
