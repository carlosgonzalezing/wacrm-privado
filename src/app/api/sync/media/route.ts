// ============================================================
// POST /api/sync/media — Sincronización multimedia desde OneDrive (n8n)
// 
// Este endpoint permite a n8n sincronizar archivos multimedia desde OneDrive
// Realiza upsert (insert/update) basado en onedrive_id
// ============================================================

import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';

interface MediaFile {
  filename: string;
  file_type: 'video' | 'image' | 'document' | 'audio';
  file_url: string;
  file_size?: number;
  mime_type?: string;
  title?: string;
  description?: string;
  category?: string;
  segment?: string;
  onedrive_id: string;
  onedrive_path?: string;
}

interface SyncMediaRequest {
  files: MediaFile[];
}

interface SyncMediaResponse {
  success: boolean;
  summary: {
    processed: number;
    created: number;
    updated: number;
    failed: number;
  };
  errors?: Array<{ file: string; error: string }>;
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:write');

    const body = (await request.json().catch(() => null)) as SyncMediaRequest | null;
    if (!body || !Array.isArray(body.files)) {
      return fail('bad_request', 'Request body must contain files array', 400);
    }

    const files = body.files;
    
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ file: string; error: string }> = [];

    // Procesar cada archivo
    for (const file of files) {
      try {
        // Validar campos requeridos
        if (!file.filename || !file.file_url || !file.onedrive_id) {
          failed++;
          errors.push({ file: file.filename, error: 'Missing required fields: filename, file_url, or onedrive_id' });
          continue;
        }

        // Buscar archivo existente por onedrive_id
        const { data: existingFile } = await ctx.supabase
          .from('media_library')
          .select('id')
          .eq('onedrive_id', file.onedrive_id)
          .eq('user_id', ctx.accountId)
          .maybeSingle();

        const mediaData = {
          user_id: ctx.accountId,
          filename: file.filename,
          file_type: file.file_type,
          file_url: file.file_url,
          file_size: file.file_size || null,
          mime_type: file.mime_type || null,
          title: file.title || file.filename,
          description: file.description || null,
          category: file.category || null,
          segment: file.segment || 'Horeca Regional Costa',
          onedrive_id: file.onedrive_id,
          onedrive_path: file.onedrive_path || null,
          onedrive_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (existingFile) {
          // Actualizar archivo existente
          const { error: updateError } = await ctx.supabase
            .from('media_library')
            .update(mediaData)
            .eq('id', existingFile.id);

          if (updateError) {
            failed++;
            errors.push({ file: file.filename, error: updateError.message });
            continue;
          }
          updated++;
        } else {
          // Crear nuevo archivo
          const { error: insertError } = await ctx.supabase
            .from('media_library')
            .insert(mediaData);

          if (insertError) {
            failed++;
            errors.push({ file: file.filename, error: insertError.message });
            continue;
          }
          created++;
        }
      } catch (err) {
        failed++;
        errors.push({ file: file.filename, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const response: SyncMediaResponse = {
      success: true,
      summary: {
        processed: files.length,
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

// GET /api/sync/media — Obtener biblioteca multimedia
export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'contacts:read');
    
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const file_type = url.searchParams.get('file_type');
    const category = url.searchParams.get('category');
    
    let query = ctx.supabase
      .from('media_library')
      .select('*')
      .eq('user_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (file_type) {
      query = query.eq('file_type', file_type);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: files, error } = await query;

    if (error) {
      console.error('[api/sync/media] Failed to fetch media:', error);
      return fail('internal', 'Failed to fetch media library', 500);
    }

    return ok(files || [], 200);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
