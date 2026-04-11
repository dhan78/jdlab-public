import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'

const SENDER = 'info@jdlab.us'

function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,
    process.env.AZURE_CLIENT_ID!,
    process.env.AZURE_CLIENT_SECRET!,
  )

  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await credential.getToken('https://graph.microsoft.com/.default')
        done(null, token.token)
      } catch (err) {
        done(err as Error, null)
      }
    },
  })
}

interface ContactEmailParams {
  name: string
  email: string
  phone?: string
  service: string
  message: string
  requestId: string
}

async function sendMail(to: string, subject: string, htmlBody: string, replyTo?: string) {
  const client = getGraphClient()

  const message: Record<string, unknown> = {
    subject,
    body: { contentType: 'HTML', content: htmlBody },
    toRecipients: [{ emailAddress: { address: to } }],
  }

  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo } }]
  }

  await client.api(`/users/${SENDER}/sendMail`).post({ message })
}

interface PasswordResetEmailParams {
  name: string
  email: string
  token: string
}

export async function sendPasswordResetEmail({ name, email, token }: PasswordResetEmailParams) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://jdlab.us'
  const resetUrl = `${baseUrl}/portal/reset-password?token=${encodeURIComponent(token)}`

  // Escape user-supplied values before interpolation
  const safeName = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeEmail = email.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  await sendMail(
    email,
    'Reset your JD Lab Portal password',
    `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0066cc;">Password Reset Request</h2>
        <p>Hello ${safeName},</p>
        <p>We received a request to reset the password for <strong>${safeEmail}</strong>.</p>
        <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <p style="margin:32px 0;">
          <a href="${resetUrl}" style="background:#0066cc;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Reset Password
          </a>
        </p>
        <p style="color:#666;font-size:14px;">If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#666;font-size:14px;">JD Dental Lab &mdash; Precision Digital Dentistry</p>
      </div>
    `,
  )
}

export async function sendContactNotification(params: ContactEmailParams) {
  const { name, email, phone, service, message, requestId } = params

  // Notification to the team
  await sendMail(
    SENDER,
    `New Contact Request [${requestId}] - ${service}`,
    `
      <h2>New Contact Form Submission</h2>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;font-weight:bold;">Request ID</td><td style="padding:8px;">${requestId}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Name</td><td style="padding:8px;">${name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${email}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Phone</td><td style="padding:8px;">${phone || 'N/A'}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Service</td><td style="padding:8px;">${service}</td></tr>
        <tr style="background:#f5f5f5;"><td style="padding:8px;font-weight:bold;">Message</td><td style="padding:8px;">${message}</td></tr>
      </table>
    `,
    email,
  )

  // Confirmation to the customer
  await sendMail(
    email,
    `We received your inquiry - JD Dental Lab [${requestId}]`,
    `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0066cc;">Thank you, ${name}!</h2>
        <p>We have received your inquiry regarding <strong>${service}</strong> and will get back to you within 1 business day.</p>
        <p>Your reference number is <strong>${requestId}</strong>.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#666;font-size:14px;">JD Dental Lab &mdash; Precision Digital Dentistry</p>
      </div>
    `,
  )
}
