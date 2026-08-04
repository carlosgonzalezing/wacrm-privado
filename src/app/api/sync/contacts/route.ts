// ============================================================
// POST /api/sync/contacts — Sincronización masiva desde Excel (n8n)
// 
// Este endpoint permite a n8n sincronizar contactos desde Excel
// Realiza upsert (insert/update) basado en phone
// Usa solo campos estándar del CRM: name, phone, email, company, tags, created_at
// ============================================================

import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';

interface ExcelContact {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  created_at?: string;
}

interface SyncRequest {
  contacts: ExcelContact[];
  sync_type?: 'full' | 'incremental';
}

interface SyncResponse {
  success: boolean;
  summary: {
    processed: number;
    created: number;
    updated: number;
    failed: number;
  };
  errors?: Array<{ row: number; error: string }>;
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');

    const body = (await request.json().catch(() => null)) as SyncRequest | null;
    if (!body || !Array.isArray(body.contacts)) {
      return fail('bad_request', 'Request body must contain contacts array', 400);
    }

    const syncType = body.sync_type || 'incremental';
    const contacts = body.contacts;
    
    // Crear log de sincronización
    const { data: logData, error: logError } = await ctx.supabase
      .from('excel_sync_logs')
      .insert({
        user_id: ctx.accountId,
        sync_type: syncType,
        records_processed: contacts.length,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[api/sync/contacts] Failed to create sync log:', logError);
    }

    const logId = logData?.id;
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Procesar cada contacto
    for (let i = 0; i < contacts.length; i++) {
      const excelContact = contacts[i];
      
      try {
        // Validar campos requeridos
        if (!excelContact.name || !excelContact.phone) {
          failed++;
          errors.push({ row: i, error: 'Missing required fields: name or phone' });
          continue;
        }

        // Normalizar teléfono (quitar espacios, guiones, etc.)
        const normalizedPhone = excelContact.phone.replace(/[\s\-\(\)]/g, '');

        // Buscar contacto existente por phone
        const { data: existingContact } = await ctx.supabase
          .from('contacts')
          .select('id')
          .eq('phone', normalizedPhone)
          .eq('account_id', ctx.accountId)
          .maybeSingle();

        const contactData = {
          account_id: ctx.accountId,
          phone: normalizedPhone,
          name: excelContact.name,
          email: excelContact.email || null,
          company: excelContact.company || null,
          created_at: excelContact.created_at ? new Date(excelContact.created_at).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (existingContact) {
          // Actualizar contacto existente
          const { error: updateError } = await ctx.supabase
            .from('contacts')
            .update(contactData)
            .eq('id', existingContact.id);

          if (updateError) {
            failed++;
            errors.push({ row: i, error: updateError.message });
            continue;
          }
          updated++;
        } else {
          // Crear nuevo contacto
          const { error: insertError } = await ctx.supabase
            .from('contacts')
            .insert(contactData);

          if (insertError) {
            failed++;
            errors.push({ row: i, error: insertError.message });
            continue;
          }
          created++;

          // Si hay tags, crearlos y asociarlos al contacto
          if (excelContact.tags && Array.isArray(excelContact.tags) && excelContact.tags.length > 0) {
            const { data: newContact } = await ctx.supabase
              .from('contacts')
              .select('id')
              .eq('phone', normalizedPhone)
              .eq('account_id', ctx.accountId)
              .single();

            if (newContact) {
              for (const tagName of excelContact.tags) {
                // Buscar o crear tag
                const { data: existingTag } = await ctx.supabase
                  .from('tags')
                  .select('id')
                  .eq('name', tagName)
                  .eq('user_id', ctx.accountId)
                  .maybeSingle();

                let tagId = existingTag?.id;
                if (!tagId) {
                  const { data: newTag } = await ctx.supabase
                    .from('tags')
                    .insert({
                      user_id: ctx.accountId,
                      name: tagName,
                      color: '#3b82f6',
                    })
                    .select('id')
                    .single();
                  tagId = newTag?.id;
                }

                // Asociar tag al contacto
                if (tagId) {
                  await ctx.supabase
                    .from('contact_tags')
                    .insert({
                      contact_id: newContact.id,
                      tag_id: tagId,
                    })
                    .onConflict('contact_id,tag_id')
                    .ignore();
                }
              }
            }
          }
        }
      } catch (err) {
        failed++;
        errors.push({ row: i, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    // Actualizar log de sincronización
    if (logId) {
      await ctx.supabase
        .from('excel_sync_logs')
        .update({
          records_created: created,
          records_updated: updated,
          records_failed: failed,
          error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }

    const response: SyncResponse = {
      success: true,
      summary: {
        processed: contacts.length,
        created,
        updated,
        failed,
      },
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    return ok(response, 200);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

// GET /api/sync/contacts — Obtener logs de sincronización
export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:read');
    
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    const { data: logs, error } = await ctx.supabase
      .from('excel_sync_logs')
      .select('*')
      .eq('user_id', ctx.accountId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[api/sync/contacts] Failed to fetch logs:', error);
      return fail('internal', 'Failed to fetch sync logs', 500);
    }

    return ok(logs || [], 200);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
