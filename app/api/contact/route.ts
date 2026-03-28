import { NextRequest, NextResponse } from 'next/server'
import { sendContactNotification } from '@/lib/email'

interface ContactRequest {
  name: string
  email: string
  phone?: string
  service: string
  message: string
}

// Simple in-memory storage for demo (in production, use a database)
const contactRequests: ContactRequest[] = []

export async function POST(request: NextRequest) {
  try {
    const body: ContactRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.email || !body.service || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const sanitized = {
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone?.trim(),
      service: body.service.trim(),
      message: body.message.trim(),
    }

    // Store the contact request
    contactRequests.push(sanitized)

    const requestId = `REQ-${Date.now()}`

    // Send email notifications (team + customer confirmation)
    try {
      await sendContactNotification({ ...sanitized, requestId })
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Don't fail the request if email fails — the submission is still recorded
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for your inquiry. We will be in touch soon.',
        requestId,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to process your request' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // For demo purposes only - in production, add authentication
  return NextResponse.json({
    total: contactRequests.length,
    requests: contactRequests
  })
}
