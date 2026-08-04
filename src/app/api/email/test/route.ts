import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendEmail } from '@/lib/email'

/**
 * POST /api/email/test
 *
 * Send a test email to verify email configuration
 */
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

    // Get account_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.account_id) {
      return NextResponse.json(
        { error: 'No account found' },
        { status: 400 }
      )
    }

    // Get email config
    const { data: config, error: configError } = await supabase
      .from('email_configs')
      .select('*')
      .eq('account_id', profile.account_id)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Email configuration not found' },
        { status: 404 }
      )
    }

    // Decrypt API key
    const apiKey = decrypt(config.api_key_encrypted)

    // Get user's email for test
    const testEmail = user.email

    if (!testEmail) {
      return NextResponse.json(
        { error: 'No email address found for user' },
        { status: 400 }
      )
    }

    // Send test email
    const result = await sendEmail({
      provider: config.provider as any,
      apiKey,
      data: {
        subject: 'Test Email from CRM',
        from_name: config.from_name,
        from_email: config.from_email,
        html_content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Test Email</h2>
            <p style="color: #666;">This is a test email from your CRM. Your email configuration is working correctly!</p>
            <p style="color: #666;">If you received this email, your SendGrid integration is properly configured.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">Sent from CRM Email System</p>
          </div>
        `,
        text_content: 'Test Email from CRM\n\nThis is a test email from your CRM. Your email configuration is working correctly!\n\nIf you received this email, your SendGrid integration is properly configured.',
      },
      recipient: {
        to_email: testEmail,
        to_name: user.user_metadata?.full_name || 'User',
      },
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        message_id: result.message_id,
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send test email' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('POST /api/email/test error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
