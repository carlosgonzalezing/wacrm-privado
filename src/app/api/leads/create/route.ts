// ============================================================
// POST /api/leads/create — Crear lead desde flujo conversacional
// 
// Este endpoint es llamado por el flujo conversacional cuando
// se completa la captura de información del lead
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { ok, fail } from '@/lib/api/v1/respond';

interface CreateLeadRequest {
  producto_interes: string;
  tipologia_negocio: string;
  contacto_nombre: string;
  contacto_telefono: string;
  conversation_id?: string;
  campaign_id?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = (await request.json().catch(() => null)) as CreateLeadRequest | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    // Validar campos requeridos
    if (!body.producto_interes || !body.tipologia_negocio || !body.contacto_nombre || !body.contacto_telefono) {
      return fail('bad_request', 'Missing required fields: producto_interes, tipologia_negocio, contacto_nombre, contacto_telefono', 400);
    }

    // Obtener user_id y contact_id de la conversación si existe
    let userId = null;
    let contactId = null;

    if (body.conversation_id) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('user_id, contact_id')
        .eq('id', body.conversation_id)
        .single();

      if (conversation) {
        userId = conversation.user_id;
        contactId = conversation.contact_id;
      }
    }

    // Si no hay conversación, buscar contacto por teléfono
    if (!contactId && body.contacto_telefono) {
      const normalizedPhone = body.contacto_telefono.replace(/[\s\-\(\)]/g, '');
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, user_id')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (contact) {
        contactId = contact.id;
        userId = contact.user_id;
      }
    }

    // Si aún no hay user_id, usar el primero disponible (para desarrollo)
    if (!userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .limit(1)
        .single();

      if (profile) {
        userId = profile.user_id;
      }
    }

    if (!userId) {
      return fail('internal', 'Could not determine user_id', 500);
    }

    // Crear lead
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        user_id: userId,
        contact_id: contactId,
        conversation_id: body.conversation_id,
        campaign_id: body.campaign_id,
        producto_interes: body.producto_interes,
        tipologia_negocio: body.tipologia_negocio,
        contacto_nombre: body.contacto_nombre,
        contacto_telefono: body.contacto_telefono,
        status: 'new',
        priority: 'medium',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[api/leads/create] Failed to create lead:', insertError);
      return fail('internal', 'Failed to create lead', 500);
    }

    return ok(lead, 201);
  } catch (err) {
    console.error('[api/leads/create] Error:', err);
    return fail('internal', 'Internal server error', 500);
  }
}
