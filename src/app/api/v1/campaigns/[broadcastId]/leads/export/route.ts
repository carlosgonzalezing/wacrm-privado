import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  const { broadcastId } = await params

  // Get auth header for account context
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const apiKey = authHeader.substring(7)

  // Get query params for filtering
  const { searchParams } = new URL(request.url)
  const interestLevelFilter = searchParams.get('interest_level')

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify API key and get account_id
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('account_id')
      .eq('key_hash', apiKey)
      .maybeSingle()

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const accountId = keyData.account_id

    // Fetch broadcast details
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .eq('account_id', accountId)
      .maybeSingle()

    if (broadcastError || !broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    // Build query with optional interest level filter
    let leadsQuery = supabase
      .from('campaign_leads')
      .select(`
        *,
        contacts (
          id,
          name,
          phone,
          email,
          company,
          city,
          sector
        ),
        profiles:advisor_id (
          full_name,
          email
        )
      `)
      .eq('broadcast_id', broadcastId)
      .eq('account_id', accountId)

    // Apply interest level filter if provided
    if (interestLevelFilter && ['low', 'medium', 'high', 'very_high'].includes(interestLevelFilter)) {
      leadsQuery = leadsQuery.eq('interest_level', interestLevelFilter)
    }

    const { data: leads, error: leadsError } = await leadsQuery

    if (leadsError) {
      console.error('Error fetching leads:', leadsError)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }

    // Generate CSV content
    const csvHeaders = [
      'Lead ID',
      'Contact Name',
      'Phone',
      'Email',
      'Company',
      'City',
      'Sector',
      'Classification',
      'Interest Level',
      'AI Summary',
      'Status',
      'Assigned Advisor',
      'Advisor Email',
      'First Response',
      'Last Activity',
      'Created At'
    ]

    const csvRows = leads.map((lead: any) => {
      const contact = lead.contacts || {}
      const advisor = lead.profiles || {}

      return [
        lead.id,
        contact.name || '',
        contact.phone || '',
        contact.email || '',
        contact.company || '',
        contact.city || '',
        contact.sector || '',
        lead.classification || '',
        lead.interest_level || '',
        `"${(lead.ai_summary || '').replace(/"/g, '""')}"`,
        lead.status || '',
        advisor.full_name || '',
        advisor.email || '',
        lead.first_response_at || '',
        lead.last_activity_at || '',
        lead.created_at || ''
      ].join(',')
    })

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n')

    // Generate filename with broadcast name, date, and filter
    const safeName = broadcast.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const date = new Date().toISOString().split('T')[0]
    const filterSuffix = interestLevelFilter ? `_interest_${interestLevelFilter}` : ''
    const filename = `leads_${safeName}_${date}${filterSuffix}.csv`

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
