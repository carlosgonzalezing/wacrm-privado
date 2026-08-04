import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendBatchEmails } from '@/lib/email'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  sanitizePhoneForMeta,
  isValidE164,
} from '@/lib/whatsapp/phone-utils'

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
    const limit = checkRateLimit(`broadcast:${user.id}`, RATE_LIMITS.broadcast)
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
      recipient_ids,
      channels = ['whatsapp'],
      // WhatsApp fields
      template_name,
      template_language,
      template_params,
      // Email fields
      subject,
      html_content,
      text_content,
      from_name,
      from_email,
    } = body

    if (!recipient_ids || recipient_ids.length === 0) {
      return NextResponse.json(
        { error: 'recipient_ids is required' },
        { status: 400 }
      )
    }

    if (!channels || channels.length === 0) {
      return NextResponse.json(
        { error: 'At least one channel is required' },
        { status: 400 }
      )
    }

    // Validate channels
    const validChannels = ['whatsapp', 'email']
    const invalidChannels = channels.filter((c: string) => !validChannels.includes(c))
    if (invalidChannels.length > 0) {
      return NextResponse.json(
        { error: `Invalid channels: ${invalidChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, phone, email, name')
      .in('id', recipient_ids)
      .eq('user_id', user.id)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found' },
        { status: 404 }
      )
    }

    const results = {
      whatsapp: { sent: 0, failed: 0, errors: [] as string[] },
      email: { sent: 0, failed: 0, errors: [] as string[] },
    }

    // Send WhatsApp messages if channel is selected
    if (channels.includes('whatsapp')) {
      if (!template_name) {
        return NextResponse.json(
          { error: 'template_name is required for WhatsApp channel' },
          { status: 400 }
        )
      }

      // Get WhatsApp config
      const { data: whatsappConfig, error: whatsappConfigError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle()

      if (whatsappConfigError || !whatsappConfig) {
        return NextResponse.json(
          { error: 'WhatsApp not configured' },
          { status: 400 }
        )
      }

      const accessToken = decrypt(whatsappConfig.access_token)

      // Send WhatsApp messages
      for (const contact of contacts) {
        if (!contact.phone) continue

        try {
          const sanitizedPhone = sanitizePhoneForMeta(contact.phone)
          if (!isValidE164(sanitizedPhone)) {
            results.whatsapp.failed++
            results.whatsapp.errors.push(`Invalid phone: ${contact.phone}`)
            continue
          }

          await sendTemplateMessage({
            phoneNumberId: whatsappConfig.phone_number_id,
            accessToken,
            to: sanitizedPhone,
            templateName: template_name,
            language: template_language || 'en_US',
            params: template_params,
          })

          results.whatsapp.sent++
        } catch (error) {
          results.whatsapp.failed++
          results.whatsapp.errors.push(`Failed to send to ${contact.phone}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Send emails if channel is selected
    if (channels.includes('email')) {
      if (!subject || !html_content) {
        return NextResponse.json(
          { error: 'subject and html_content are required for email channel' },
          { status: 400 }
        )
      }

      // Get email config
      const { data: emailConfig, error: emailConfigError } = await supabase
        .from('email_configs')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle()

      if (emailConfigError || !emailConfig) {
        return NextResponse.json(
          { error: 'Email not configured' },
          { status: 400 }
        )
      }

      let apiKey: string
      try {
        apiKey = decrypt(emailConfig.api_key_encrypted)
      } catch (decryptError) {
        return NextResponse.json(
          { error: 'Failed to decrypt email API key' },
          { status: 500 }
        )
      }

      // Prepare email recipients
      const emailRecipients = contacts
        .filter((contact: any) => contact.email)
        .map((contact: any) => ({
          to_email: contact.email,
          to_name: contact.name,
        }))

      if (emailRecipients.length > 0) {
        const emailResults = await sendBatchEmails({
          provider: emailConfig.provider as any,
          apiKey,
          data: {
            subject,
            from_name: from_name || emailConfig.from_name,
            from_email: from_email || emailConfig.from_email,
            html_content,
            text_content: text_content || '',
          },
          recipients: emailRecipients,
        })

        emailResults.forEach((result) => {
          if (result.success) {
            results.email.sent++
          } else {
            results.email.failed++
            results.email.errors.push(result.error || 'Unknown error')
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      total_contacts: contacts.length,
      channels,
      results,
    })
  } catch (error) {
    console.error('POST /api/broadcasts error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
