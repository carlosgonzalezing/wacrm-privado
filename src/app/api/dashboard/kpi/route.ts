// ============================================================
// GET /api/dashboard/kpi — Obtener KPIs del dashboard
// 
// Retorna las métricas clave para el negocio:
// - Campañas enviadas
// - Leads generados
// - Tasa de conversión
// - Tiempo promedio de respuesta
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { ok, fail } from '@/lib/api/v1/respond';

interface KpiResponse {
  campaigns_sent: number;
  leads_generated: number;
  conversion_rate: number;
  avg_response_time_hours: number;
  period: {
    start: string;
    end: string;
  };
}

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return fail('bad_request', 'user_id is required', 400);
    }

    // Calcular período
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Campañas enviadas
    const { count: campaignsSent, error: campaignsError } = await supabase
      .from('marketing_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (campaignsError) {
      console.error('[api/dashboard/kpi] Failed to fetch campaigns:', campaignsError);
    }

    // 2. Leads generados
    const { count: leadsGenerated, error: leadsError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (leadsError) {
      console.error('[api/dashboard/kpi] Failed to fetch leads:', leadsError);
    }

    // 3. Total de contactos que recibieron campañas (para tasa de conversión)
    const { count: totalContacts, error: contactsError } = await supabase
      .from('broadcast_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', startDate.toISOString())
      .lte('sent_at', endDate.toISOString());

    if (contactsError) {
      console.error('[api/dashboard/kpi] Failed to fetch contacts:', contactsError);
    }

    // 4. Tiempo promedio de respuesta (diferencia entre mensaje recibido y primera respuesta)
    const { data: responseTimes, error: timeError } = await supabase
      .from('messages')
      .select('created_at, conversation_id')
      .eq('sender_type', 'agent')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    let avgResponseTimeHours = 0;
    if (!timeError && responseTimes && responseTimes.length > 0) {
      // Para cada respuesta de agente, encontrar el mensaje anterior del cliente
      let totalResponseTime = 0;
      let validResponses = 0;

      for (const agentMessage of responseTimes) {
        const { data: previousMessage } = await supabase
          .from('messages')
          .select('created_at')
          .eq('conversation_id', agentMessage.conversation_id)
          .eq('sender_type', 'customer')
          .lt('created_at', agentMessage.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (previousMessage) {
          const responseTime = new Date(agentMessage.created_at).getTime() - new Date(previousMessage.created_at).getTime();
          totalResponseTime += responseTime;
          validResponses++;
        }
      }

      if (validResponses > 0) {
        avgResponseTimeHours = (totalResponseTime / validResponses) / (1000 * 60 * 60); // Convertir a horas
      }
    }

    // Calcular tasa de conversión
    const conversionRate = totalContacts && totalContacts > 0 
      ? (leadsGenerated || 0) / totalContacts * 100 
      : 0;

    const response: KpiResponse = {
      campaigns_sent: campaignsSent || 0,
      leads_generated: leadsGenerated || 0,
      conversion_rate: Math.round(conversionRate * 100) / 100, // 2 decimales
      avg_response_time_hours: Math.round(avgResponseTimeHours * 100) / 100, // 2 decimales
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    return ok(response, 200);
  } catch (err) {
    console.error('[api/dashboard/kpi] Error:', err);
    return fail('internal', 'Internal server error', 500);
  }
}
