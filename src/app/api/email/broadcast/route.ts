import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendBatchEmails } from '@/lib/email'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'

interface EmailBroadcastResult {
  email: string
  status: 'sent' | 'failed'
  message_id?: string
  error?: string
}

interface EmailRecipient {
  to_email: string
  to_name?: string
  variables?: Record<string, string>
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Per-user broadcast budget
    const limit = checkRateLimit(`email-broadcast:${user.id}`, RATE_LIMITS.broadcast)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    // Resolve account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      recipients,
      recipient_ids,
      subject,
      html_content,
      text_content,
      from_name,
      from_email,
      broadcast_id,
      channels,
    } = body

    if (!recipients && !recipient_ids) {
      return NextResponse.json(
        { error: 'Provide either recipients or recipient_ids' },
        { status: 400 }
      )
    }

    if (!subject || !html_content) {
      return NextResponse.json(
        { error: 'subject and html_content are required' },
        { status: 400 }
      )
    }

    // Get email config
    const { data: config, error: configError } = await supabase
      .from('email_configs')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Email not configured. Please set up your email integration first.' },
        { status: 400 }
      )
    }

    // Decrypt API key
    let apiKey: string
    try {
      apiKey = decrypt(config.api_key_encrypted)
    } catch (decryptError) {
      console.error('Failed to decrypt API key:', decryptError)
      return NextResponse.json(
        { error: 'Failed to decrypt API key. Please re-enter your API key.' },
        { status: 500 }
      )
    }

    // Resolve recipients
    let emailRecipients: EmailRecipient[] = []

    if (Array.isArray(recipients) && recipients.length > 0) {
      emailRecipients = recipients
    } else if (Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      // Fetch contacts and get their emails
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, email, name')
        .in('id', recipient_ids)
        .eq('user_id', user.id)

      if (!contacts) {
        return NextResponse.json(
          { error: 'No contacts found' },
          { status: 404 }
        )
      }

      emailRecipients = contacts
        .filter((contact: any) => contact.email)
        .map((contact: any) => ({
          to_email: contact.email,
          to_name: contact.name,
        }))
    }

    if (emailRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid email recipients found' },
        { status: 400 }
      )
    }

    // Send emails
    const results = await sendBatchEmails({
      provider: config.provider as any,
      apiKey,
      data: {
        subject,
        from_name: from_name || config.from_name,
        from_email: from_email || config.from_email,
        html_content,
        text_content: text_content || '',
      },
      recipients: emailRecipients,
    })

    // Update broadcast_recipients if broadcast_id is provided
    if (broadcast_id) {
      const updatePromises = results.map((result, index) => {
        const recipient = emailRecipients[index]
        return supabase
          .from('broadcast_recipients')
          .update({
            status: result.success ? 'sent' : 'failed',
            sent_at: result.success ? new Date().toISOString() : null,
            error_message: result.error,
          })
          .eq('broadcast_id', broadcast_id)
          .eq('contact_id', recipient_ids?.[index])
      })

      await Promise.all(updatePromises)
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      total: results.length,
      sent: successCount,
      failed: failCount,
      results: results.map((result, index) => ({
        email: emailRecipients[index].to_email,
        status: result.success ? 'sent' : 'failed',
        message_id: result.message_id,
        error: result.error,
      })),
    })
  } catch (error) {
    console.error('POST /api/email/broadcast error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
