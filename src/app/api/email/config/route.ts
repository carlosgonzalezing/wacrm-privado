import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import type { EmailProvider } from '@/lib/email'

/**
 * Resolve the caller's account_id from their profile
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

// Lazy-initialised service-role client
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

/**
 * GET /api/email/config
 *
 * Returns the email configuration for the current account
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { configured: false, reason: 'no_account' },
        { status: 200 }
      )
    }

    const { data: config, error: configError } = await supabase
      .from('email_configs')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError) {
      console.error('Error fetching email_config:', configError)
      return NextResponse.json(
        { configured: false, reason: 'db_error' },
        { status: 200 }
      )
    }

    if (!config) {
      return NextResponse.json(
        { configured: false, reason: 'no_config' },
        { status: 200 }
      )
    }

    // Don't return the encrypted API key to the client
    const { api_key_encrypted, ...safeConfig } = config

    return NextResponse.json({
      configured: true,
      config: safeConfig,
    })
  } catch (error) {
    console.error('GET /api/email/config error:', error)
    return NextResponse.json(
      { configured: false, reason: 'server_error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/config
 *
 * Save or update email configuration
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

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'No account found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { provider, apiKey, fromName, fromEmail, replyToEmail } = body

    if (!provider || !apiKey || !fromName || !fromEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Encrypt the API key
    const encryptedKey = encrypt(apiKey)

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from('email_configs')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    if (existingConfig) {
      // Update existing config
      const { error: updateError } = await supabase
        .from('email_configs')
        .update({
          provider,
          api_key_encrypted: encryptedKey,
          from_name: fromName,
          from_email: fromEmail,
          reply_to_email: replyToEmail || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConfig.id)

      if (updateError) {
        console.error('Error updating email_config:', updateError)
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        )
      }
    } else {
      // Insert new config
      const { error: insertError } = await supabase
        .from('email_configs')
        .insert({
          account_id: accountId,
          provider,
          api_key_encrypted: encryptedKey,
          from_name: fromName,
          from_email: fromEmail,
          reply_to_email: replyToEmail || null,
          is_active: true,
        })

      if (insertError) {
        console.error('Error inserting email_config:', insertError)
        return NextResponse.json(
          { error: 'Failed to save configuration' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/email/config error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email/config
 *
 * Delete email configuration
 */
export async function DELETE() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'No account found' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('email_configs')
      .delete()
      .eq('account_id', accountId)

    if (deleteError) {
      console.error('Error deleting email_config:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/email/config error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
