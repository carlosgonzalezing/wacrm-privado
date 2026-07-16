// ============================================================
// POST /api/leads/qualify — Calificar lead usando IA
// 
// Este endpoint analiza la conversación del lead y genera:
// - Resumen ejecutivo
// - Score de interés (0-100)
// - Intención del cliente
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { generateReply } from '@/lib/ai/generate';
import { loadAiConfig } from '@/lib/ai/config';
import { ok, fail } from '@/lib/api/v1/respond';

interface QualifyLeadRequest {
  lead_id: string;
}

interface QualifyLeadResponse {
  success: boolean;
  lead_id: string;
  ia_score: number;
  ia_resumen: string;
  ia_intencion: string;
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = (await request.json().catch(() => null)) as QualifyLeadRequest | null;
    if (!body || !body.lead_id) {
      return fail('bad_request', 'lead_id is required', 400);
    }

    // Obtener información del lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', body.lead_id)
      .single();

    if (leadError || !lead) {
      return fail('not_found', 'Lead not found', 404);
    }

    // Obtener conversación si existe
    let conversationText = '';
    if (lead.conversation_id) {
      const { data: messages } = await supabase
        .from('messages')
        .select('content_text, sender_type, created_at')
        .eq('conversation_id', lead.conversation_id)
        .order('created_at', { ascending: true });

      if (messages) {
        conversationText = messages
          .map(m => `[${m.sender_type}]: ${m.content_text}`)
          .join('\n');
      }
    }

    // Cargar configuración de IA
    const aiConfig = await loadAiConfig(supabase, lead.user_id);
    if (!aiConfig || !aiConfig.isActive) {
      return fail('bad_request', 'AI is not configured for this account', 400);
    }

    // Construir prompt para calificación
    const systemPrompt = `Eres un asistente de ventas especializado en analizar conversaciones de clientes del sector Horeca (hoteles, restaurantes, cafeterías, casinos).

Tu tarea es analizar la conversación y proporcionar:
1. Un RESUMEN EJECUTIVO conciso (máximo 3 líneas) que capture la esencia del interés del cliente
2. Un SCORE de interés del 0 al 100, donde:
   - 0-20: Sin interés real
   - 21-40: Interés bajo, requiere seguimiento
   - 41-60: Interés moderado, potencial viable
   - 61-80: Interés alto, oportunidad caliente
   - 81-100: Interés muy alto, cierre inminente
3. La INTENCIÓN principal del cliente (una palabra o frase corta)

Responde EXACTAMENTE en este formato JSON:
{
  "resumen": "texto del resumen",
  "score": número,
  "intencion": "texto de intención"
}`;

    // Construir mensajes para la IA
    const messages = [
      {
        role: 'user' as const,
        content: `INFORMACIÓN DEL LEAD:
- Producto de interés: ${lead.producto_interes}
- Tipología de negocio: ${lead.tipologia_negocio}
- Nombre: ${lead.contacto_nombre}
- Teléfono: ${lead.contacto_telefono}

CONVERSACIÓN:
${conversationText || 'Sin conversación disponible'}

Analiza esta información y proporciona la calificación en el formato JSON solicitado.`
      }
    ];

    // Generar respuesta de IA
    const result = await generateReply({
      config: aiConfig,
      systemPrompt,
      messages,
    });

    // Parsear respuesta JSON
    let aiResponse;
    try {
      // Limpiar el texto para extraer JSON puro
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[api/leads/qualify] Failed to parse AI response:', result.text);
      // Fallback a valores por defecto
      aiResponse = {
        resumen: 'No se pudo generar resumen automático',
        score: 50,
        intencion: 'desconocida'
      };
    }

    // Actualizar lead con calificación
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        ia_score: aiResponse.score || 50,
        ia_resumen: aiResponse.resumen || '',
        ia_intencion: aiResponse.intencion || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.lead_id);

    if (updateError) {
      console.error('[api/leads/qualify] Failed to update lead:', updateError);
      return fail('internal', 'Failed to update lead with AI qualification', 500);
    }

    const response: QualifyLeadResponse = {
      success: true,
      lead_id: body.lead_id,
      ia_score: aiResponse.score || 50,
      ia_resumen: aiResponse.resumen || '',
      ia_intencion: aiResponse.intencion || '',
    };

    return ok(response, 200);
  } catch (err) {
    console.error('[api/leads/qualify] Error:', err);
    return fail('internal', 'Internal server error', 500);
  }
}
