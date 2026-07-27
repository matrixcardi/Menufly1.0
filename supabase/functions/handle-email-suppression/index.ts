import { createClient } from 'npm:@supabase/supabase-js@2'
import { Webhook } from 'npm:svix@1'

// Webhook event sent by Resend (signed in the Svix format) when an email
// bounces or the recipient marks it as spam.
interface ResendWebhookEvent {
  type: string
  created_at?: string
  data: {
    email_id?: string
    to?: string[]
    subject?: string
    bounce?: { type?: string }
  }
}

// Internal shape consumed by the suppression upsert below.
interface SuppressionPayload {
  email: string
  reason: 'bounce' | 'complaint' | 'unsubscribe'
  message_id?: string
  metadata?: Record<string, unknown>
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Verify the Svix signature Resend attaches to every webhook delivery
  const body = await req.text()
  let event: ResendWebhookEvent
  try {
    event = new Webhook(webhookSecret).verify(body, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }) as ResendWebhookEvent
  } catch {
    console.error('Invalid webhook signature')
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  const recipient = event.data?.to?.[0]
  if (!recipient) {
    console.error('Webhook event missing recipient', { type: event.type })
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  let payload: SuppressionPayload
  if (event.type === 'email.bounced') {
    // Only permanent bounces suppress the address; transient ones may recover
    if (event.data.bounce?.type && event.data.bounce.type !== 'Permanent') {
      console.log('Ignoring transient bounce', { bounce_type: event.data.bounce.type })
      return jsonResponse({ ignored: true, reason: 'transient_bounce' })
    }
    payload = {
      email: recipient,
      reason: 'bounce',
      metadata: {
        email_id: event.data.email_id,
        subject: event.data.subject,
        bounce_type: event.data.bounce?.type,
      },
    }
  } else if (event.type === 'email.complained') {
    payload = {
      email: recipient,
      reason: 'complaint',
      metadata: {
        email_id: event.data.email_id,
        subject: event.data.subject,
      },
    }
  } else {
    return jsonResponse({ ignored: true, type: event.type })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason: payload.reason,
        metadata: payload.metadata ?? null,
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const sendLogStatus = mapReasonToStatus(payload.reason)
  const sendLogMessage = mapReasonToMessage(payload.reason)

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: payload.message_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: payload.metadata ?? null,
    })

  if (insertError) {
    // Non-fatal — log and continue. The suppression was already recorded.
    console.warn('Failed to insert email_send_log', {
      error: insertError,
    })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason: payload.reason,
    event_type: event.type,
    has_message_id: !!payload.message_id,
  })

  return jsonResponse({ success: true })
})

function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe':
      return 'Recipient unsubscribed'
    default:
      return 'Email suppressed'
  }
}
