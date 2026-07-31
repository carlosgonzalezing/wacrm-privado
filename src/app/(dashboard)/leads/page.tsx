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
  Filter,
  Download,
  ChevronDown,
  ExternalLink,
  Users,
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
  };
  profiles: {
    full_name: string;
  };
}

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'interested' | 'not_interested' | 'needs_info' | 'requesting_call'>('all');
  const [interestLevelFilter, setInterestLevelFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'very_high'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'assigned' | 'contacted' | 'qualified' | 'lost' | 'converted'>('all');
  const [broadcastFilter, setBroadcastFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

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
              name
            ),
            profiles:advisor_id (
              full_name
            )
          `)
          .order('created_at', { ascending: false });

        if (leadsError) {
          // If campaign_leads table doesn't exist yet, just log and continue
          console.warn('Campaign leads not available:', leadsError);
          setLeads([]);
        } else {
          setLeads(leadsData ?? []);
        }

        // Fetch all broadcasts for filter
        const { data: broadcastsData } = await supabase
          .from('broadcasts')
          .select('id, name')
          .order('created_at', { ascending: false });

        setBroadcasts(broadcastsData ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading leads');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredLeads = useMemo(() => {
    let filtered = leads;
    
    // Filter by classification
    if (classificationFilter !== 'all') {
      filtered = filtered.filter((l) => l.classification === classificationFilter);
    }
    
    // Filter by interest level
    if (interestLevelFilter !== 'all') {
      filtered = filtered.filter((l) => l.interest_level === interestLevelFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    // Filter by broadcast
    if (broadcastFilter !== 'all') {
      filtered = filtered.filter((l) => l.broadcasts?.id === broadcastFilter);
    }
    
    return filtered;
  }, [leads, classificationFilter, interestLevelFilter, statusFilter, broadcastFilter]);

  function handleExport() {
    // Build export URL with filters
    const params = new URLSearchParams();
    if (interestLevelFilter !== 'all') {
      params.set('interest_level', interestLevelFilter);
    }
    
    // For now, we'll export the filtered leads directly
    const csv = filteredLeads.map((l) => [
      l.contacts?.name || '',
      l.contacts?.phone || '',
      l.contacts?.email || '',
      l.contacts?.company || '',
      l.broadcasts?.name || '',
      l.classification || '',
      l.interest_level || '',
      `"${(l.ai_summary || '').replace(/"/g, '""')}"`,
      l.status || '',
      l.profiles?.full_name || '',
      l.created_at || ''
    ]);
    
    const header = ['Contact', 'Phone', 'Email', 'Company', 'Campaign', 'Classification', 'Interest Level', 'AI Summary', 'Status', 'Assigned Advisor', 'Created At'];
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all leads captured by AI across campaigns
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={filteredLeads.length === 0}
          className="border-border text-muted-foreground hover:bg-muted"
        >
          <Download className="mr-2 h-3.5 w-3.5" />
          Export Leads ({filteredLeads.length})
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">{leads.length}</p>
          <p className="text-xs text-muted-foreground">Total Leads</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground">Interested</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">
            {leads.filter(l => l.classification === 'interested').length}
          </p>
          <p className="text-xs text-muted-foreground">Interested</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground">High Interest</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">
            {leads.filter(l => l.interest_level === 'high' || l.interest_level === 'very_high').length}
          </p>
          <p className="text-xs text-muted-foreground">High/Very High</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground">Qualified</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">
            {leads.filter(l => l.status === 'qualified').length}
          </p>
          <p className="text-xs text-muted-foreground">Qualified</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:bg-muted"
              />
            }
          >
            <Filter className="mr-2 h-3.5 w-3.5" />
            {classificationFilter === 'all'
              ? 'All Classifications'
              : classificationFilter.replace('_', ' ').toUpperCase()}
            <ChevronDown className="ml-2 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-border bg-popover">
            <DropdownMenuItem
              onClick={() => setClassificationFilter('all')}
              className={classificationFilter === 'all' ? 'text-primary' : 'text-popover-foreground'}
            >
              All Classifications
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setClassificationFilter('interested')}
              className={classificationFilter === 'interested' ? 'text-primary' : 'text-popover-foreground'}
            >
              Interested
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setClassificationFilter('not_interested')}
              className={classificationFilter === 'not_interested' ? 'text-primary' : 'text-popover-foreground'}
            >
              Not Interested
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setClassificationFilter('needs_info')}
              className={classificationFilter === 'needs_info' ? 'text-primary' : 'text-popover-foreground'}
            >
              Needs Info
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setClassificationFilter('requesting_call')}
              className={classificationFilter === 'requesting_call' ? 'text-primary' : 'text-popover-foreground'}
            >
              Requesting Call
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:bg-muted"
              />
            }
          >
            <Filter className="mr-2 h-3.5 w-3.5" />
            {interestLevelFilter === 'all'
              ? 'All Interest Levels'
              : interestLevelFilter.toUpperCase()}
            <ChevronDown className="ml-2 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-border bg-popover">
            <DropdownMenuItem
              onClick={() => setInterestLevelFilter('all')}
              className={interestLevelFilter === 'all' ? 'text-primary' : 'text-popover-foreground'}
            >
              All Interest Levels
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setInterestLevelFilter('low')}
              className={interestLevelFilter === 'low' ? 'text-primary' : 'text-popover-foreground'}
            >
              Low
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setInterestLevelFilter('medium')}
              className={interestLevelFilter === 'medium' ? 'text-primary' : 'text-popover-foreground'}
            >
              Medium
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setInterestLevelFilter('high')}
              className={interestLevelFilter === 'high' ? 'text-primary' : 'text-popover-foreground'}
            >
              High
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setInterestLevelFilter('very_high')}
              className={interestLevelFilter === 'very_high' ? 'text-primary' : 'text-popover-foreground'}
            >
              Very High
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:bg-muted"
              />
            }
          >
            <Filter className="mr-2 h-3.5 w-3.5" />
            {statusFilter === 'all'
              ? 'All Statuses'
              : statusFilter.replace('_', ' ').toUpperCase()}
            <ChevronDown className="ml-2 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-border bg-popover">
            <DropdownMenuItem
              onClick={() => setStatusFilter('all')}
              className={statusFilter === 'all' ? 'text-primary' : 'text-popover-foreground'}
            >
              All Statuses
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setStatusFilter('new')}
              className={statusFilter === 'new' ? 'text-primary' : 'text-popover-foreground'}
            >
              New
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setStatusFilter('assigned')}
              className={statusFilter === 'assigned' ? 'text-primary' : 'text-popover-foreground'}
            >
              Assigned
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setStatusFilter('contacted')}
              className={statusFilter === 'contacted' ? 'text-primary' : 'text-popover-foreground'}
            >
              Contacted
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setStatusFilter('qualified')}
              className={statusFilter === 'qualified' ? 'text-primary' : 'text-popover-foreground'}
            >
              Qualified
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setStatusFilter('lost')}
              className={statusFilter === 'lost' ? 'text-primary' : 'text-popover-foreground'}
            >
              Lost
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setStatusFilter('converted')}
              className={statusFilter === 'converted' ? 'text-primary' : 'text-popover-foreground'}
            >
              Converted
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:bg-muted"
              />
            }
          >
            <Filter className="mr-2 h-3.5 w-3.5" />
            {broadcastFilter === 'all'
              ? 'All Campaigns'
              : broadcasts.find(b => b.id === broadcastFilter)?.name || 'Campaign'}
            <ChevronDown className="ml-2 h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-border bg-popover max-h-64 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => setBroadcastFilter('all')}
              className={broadcastFilter === 'all' ? 'text-primary' : 'text-popover-foreground'}
            >
              All Campaigns
            </DropdownMenuItem>
            {broadcasts.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => setBroadcastFilter(b.id)}
                className={broadcastFilter === b.id ? 'text-primary' : 'text-popover-foreground'}
              >
                {b.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        {filteredLeads.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {leads.length === 0 ? 'No leads found' : 'No leads match the selected filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-muted-foreground">Campaign</TableHead>
                  <TableHead className="text-muted-foreground">Classification</TableHead>
                  <TableHead className="text-muted-foreground">Interest Level</TableHead>
                  <TableHead className="text-muted-foreground">AI Summary</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Assigned Advisor</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="border-border">
                    <TableCell className="font-medium text-foreground">
                      {lead.contacts?.name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.contacts?.phone || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.broadcasts?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          lead.classification === 'interested' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                          lead.classification === 'not_interested' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                          lead.classification === 'needs_info' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          lead.classification === 'requesting_call' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        }`}
                      >
                        {lead.classification.replace('_', ' ').toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {lead.interest_level ? (
                        <span className="text-xs font-medium text-foreground">
                          {lead.interest_level.toUpperCase()}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {lead.ai_summary || '-'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-foreground">
                        {lead.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.profiles?.full_name || 'Unassigned'}
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
