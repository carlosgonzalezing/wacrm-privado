'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  Download,
  ChevronDown,
  ExternalLink,
  Users,
  Send,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface CampaignLead {
  id: string;
  classification: string;
  interest_level: string;
  ai_summary: string;
  status: string;
  conversation_id: string;
  created_at: string;
  last_activity_at: string;
  contacts: {
    id: string;
    name: string;
    phone: string;
    email: string;
    company: string;
  };
  broadcasts: {
    id: string;
    name: string;
    total_recipients: number;
    sent_count: number;
    replied_count: number;
    leads_count: number;
    not_interested_count: number;
    needs_info_count: number;
  };
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [selectedBroadcast, setSelectedBroadcast] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        // Fetch all broadcasts with stats
        const { data: broadcastsData } = await supabase
          .from('broadcasts')
          .select('id, name, total_recipients, sent_count, replied_count, leads_count, not_interested_count, needs_info_count')
          .order('created_at', { ascending: false });

        console.log('Broadcasts loaded:', broadcastsData);
        setBroadcasts(broadcastsData ?? []);

        // Select the most recent broadcast by default
        if (broadcastsData && broadcastsData.length > 0) {
          setSelectedBroadcast(broadcastsData[0].id);
        }

        // Fetch all campaign leads with contact and broadcast details
        const { data: leadsData, error: leadsError } = await supabase
          .from('campaign_leads')
          .select(`
            *,
            contacts (
              id,
              name,
              phone,
              email,
              company
            ),
            broadcasts (
              id,
              name,
              total_recipients,
              sent_count,
              replied_count,
              leads_count,
              not_interested_count,
              needs_info_count
            )
          `)
          .order('created_at', { ascending: false });

        if (leadsError) {
          console.warn('Campaign leads not available:', leadsError);
          setLeads([]);
        } else {
          setLeads(leadsData ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading leads');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredLeads = useMemo(() => {
    if (selectedBroadcast === 'all') {
      return leads;
    }
    return leads.filter((l) => l.broadcasts?.id === selectedBroadcast);
  }, [leads, selectedBroadcast]);

  const selectedBroadcastData = useMemo(() => {
    if (selectedBroadcast === 'all') {
      return {
        name: 'Todas las Campañas',
        total_recipients: leads.length,
        sent_count: leads.length,
        replied_count: leads.length,
        leads_count: leads.filter(l => l.classification === 'interested').length,
        not_interested_count: leads.filter(l => l.classification === 'not_interested').length,
        needs_info_count: leads.filter(l => l.classification === 'needs_info').length,
      };
    }
    return broadcasts.find(b => b.id === selectedBroadcast);
  }, [selectedBroadcast, broadcasts, leads]);

  function handleExport() {
    const csv = filteredLeads.map((l) => [
      l.contacts?.company || '',
      l.contacts?.name || '',
      l.classification || '',
      `"${(l.ai_summary || '').replace(/"/g, '""')}"`,
      l.last_activity_at || l.created_at || ''
    ]);
    
    const header = ['Empresa', 'Contacto', 'Estado', 'Resumen IA', 'Última respuesta'];
    const csvContent = [header.join(','), ...csv.map(row => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${filteredLeads.length} leads`);
  }

  function getClassificationEmoji(classification: string) {
    switch (classification) {
      case 'interested': return '🟢';
      case 'not_interested': return '🔴';
      case 'needs_info': return '🟡';
      case 'requesting_call': return '🟣';
      default: return '⚪';
    }
  }

  function getClassificationLabel(classification: string) {
    switch (classification) {
      case 'interested': return 'Interesado';
      case 'not_interested': return 'No interesado';
      case 'needs_info': return 'Requiere asesor';
      case 'requesting_call': return 'Solicita llamada';
      default: return 'Pendiente';
    }
  }

  function getTimeAgo(date: string) {
    if (!date) return '-';
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${diffDays} días`;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Campaign Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Leads IA</h1>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="min-w-[200px] justify-between">
                  {selectedBroadcastData?.name || 'Seleccionar campaña'}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent className="w-[300px] border-border bg-popover">
              <DropdownMenuItem onClick={() => setSelectedBroadcast('all')}>
                Todas las campañas
              </DropdownMenuItem>
              {broadcasts.map((b) => (
                <DropdownMenuItem key={b.id} onClick={() => setSelectedBroadcast(b.id)}>
                  {b.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={filteredLeads.length === 0}
          className="border-border text-muted-foreground hover:bg-muted"
        >
          <Download className="mr-2 h-3.5 w-3.5" />
          Exportar ({filteredLeads.length})
        </Button>
      </div>

      {/* Campaign Stats */}
      {selectedBroadcastData && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {selectedBroadcastData.name}
            </h2>
            <p className="text-sm text-muted-foreground">Información general de la campaña</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {selectedBroadcastData.sent_count || selectedBroadcastData.total_recipients || 0}
                </p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {selectedBroadcastData.replied_count || filteredLeads.length}
                </p>
                <p className="text-xs text-muted-foreground">Respondieron</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {selectedBroadcastData.leads_count || filteredLeads.filter(l => l.classification === 'interested').length}
                </p>
                <p className="text-xs text-muted-foreground">Interesados</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {selectedBroadcastData.not_interested_count || filteredLeads.filter(l => l.classification === 'not_interested').length}
                </p>
                <p className="text-xs text-muted-foreground">No interesados</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {selectedBroadcastData.needs_info_count || filteredLeads.filter(l => l.classification === 'needs_info').length}
                </p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        {filteredLeads.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {leads.length === 0 ? 'No hay leads encontrados' : 'No hay leads que coincidan con los filtros'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Empresa</TableHead>
                  <TableHead className="text-muted-foreground">Contacto</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-muted-foreground">Resumen IA</TableHead>
                  <TableHead className="text-muted-foreground">Última respuesta</TableHead>
                  <TableHead className="text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="border-border">
                    <TableCell className="font-medium text-foreground">
                      {lead.contacts?.company || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.contacts?.name || 'Desconocido'}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 text-sm">
                        <span>{getClassificationEmoji(lead.classification)}</span>
                        <span className="font-medium">{getClassificationLabel(lead.classification)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {lead.ai_summary || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {getTimeAgo(lead.last_activity_at || lead.created_at)}
                    </TableCell>
                    <TableCell>
                      {lead.conversation_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/inbox/${lead.conversation_id}`)}
                          className="h-7 w-7 p-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
