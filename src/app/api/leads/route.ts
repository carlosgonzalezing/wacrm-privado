// ============================================================
// GET /api/leads — Listar leads con filtros
// POST /api/leads/export — Exportar leads a CSV
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { ok, fail } from '@/lib/api/v1/respond';

// GET /api/leads — Listar leads
export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!userId) {
      return fail('bad_request', 'user_id is required', 400);
    }

    let query = supabase
      .from('leads')
      .select(`
        *,
        contacts:contact_id (
          name,
          phone,
          email,
          company
        ),
        conversations:conversation_id (
          id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error('[api/leads] Failed to fetch leads:', error);
      return fail('internal', 'Failed to fetch leads', 500);
    }

    return ok(leads || [], 200);
  } catch (err) {
    console.error('[api/leads] Error:', err);
    return fail('internal', 'Internal server error', 500);
  }
}

// POST /api/leads/export — Exportar leads a CSV
export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = (await request.json().catch(() => null)) as {
      user_id: string;
      status?: string;
      priority?: string;
      start_date?: string;
      end_date?: string;
    } | null;

    if (!body || !body.user_id) {
      return fail('bad_request', 'user_id is required', 400);
    }

    let query = supabase
      .from('leads')
      .select(`
        *,
        contacts:contact_id (
          name,
          phone,
          email,
          company,
          ciudad_operacion,
          sector
        )
      `)
      .eq('user_id', body.user_id)
      .order('created_at', { ascending: false });

    if (body.status) {
      query = query.eq('status', body.status);
    }

    if (body.priority) {
      query = query.eq('priority', body.priority);
    }

    if (body.start_date) {
      query = query.gte('created_at', body.start_date);
    }

    if (body.end_date) {
      query = query.lte('created_at', body.end_date);
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error('[api/leads/export] Failed to fetch leads:', error);
      return fail('internal', 'Failed to fetch leads for export', 500);
    }

    if (!leads || leads.length === 0) {
      return fail('not_found', 'No leads found to export', 404);
    }

    // Generar CSV
    const headers = [
      'ID',
      'Fecha Creación',
      'Estado',
      'Prioridad',
      'Producto Interés',
      'Tipología Negocio',
      'Nombre Contacto',
      'Teléfono Contacto',
      'Nombre Empresa',
      'Teléfono Empresa',
      'Email Empresa',
      'Ciudad',
      'Sector',
      'Score IA',
      'Resumen IA',
      'Intención IA',
      'Notas',
      'Exportado'
    ];

    const rows = leads.map(lead => [
      lead.id,
      new Date(lead.created_at).toLocaleDateString('es-CO'),
      lead.status,
      lead.priority,
      lead.producto_interes || '',
      lead.tipologia_negocio || '',
      lead.contacto_nombre || '',
      lead.contacto_telefono || '',
      lead.contacts?.name || '',
      lead.contacts?.phone || '',
      lead.contacts?.email || '',
      lead.contacts?.ciudad_operacion || '',
      lead.contacts?.sector || '',
      lead.ia_score || 0,
      lead.ia_resumen || '',
      lead.ia_intencion || '',
      lead.notes || '',
      lead.exported_to_sales ? 'Sí' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Marcar leads como exportados
    const leadIds = leads.map(l => l.id);
    await supabase
      .from('leads')
      .update({
        exported_to_sales: true,
        exported_at: new Date().toISOString()
      })
      .in('id', leadIds);

    // Retornar CSV
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leads_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (err) {
    console.error('[api/leads/export] Error:', err);
    return fail('internal', 'Internal server error', 500);
  }
}
