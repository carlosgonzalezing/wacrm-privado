'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Mail,
  Building2,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Users,
  Sparkles,
  Calendar,
  TrendingUp,
  ShieldCheck,
  MessagesSquare,
  Clock,
} from 'lucide-react';

export interface CampaignLead {
  id: string;
  classification: string;
  interest_level: string;
  ai_summary: string;
  status: string;
  conversation_id: string;
  created_at: string;
  last_activity_at: string;
  first_response_at?: string;
  metadata?: { confidence?: number; classified_at?: string };
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

interface LeadDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CampaignLead | null;
}

interface ConversationMessage {
  id: string;
  sender_type: 'customer' | 'agent' | 'bot';
  content_type: string;
  content_text?: string;
  created_at: string;
}

function getClassificationStyle(classification: string) {
  switch (classification) {
    case 'interested':
      return {
        emoji: '🟢',
        label: 'Interesado',
        className: 'bg-green-500/15 text-green-400 border-green-500/30',
      };
    case 'not_interested':
      return {
        emoji: '🔴',
        label: 'No interesado',
        className: 'bg-red-500/15 text-red-400 border-red-500/30',
      };
    case 'needs_info':
      return {
        emoji: '🟡',
        label: 'Requiere asesor',
        className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      };
    case 'requesting_call':
      return {
        emoji: '🟣',
        label: 'Solicita llamada',
        className: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      };
    default:
      return {
        emoji: '⚪',
        label: 'Pendiente',
        className: 'bg-muted text-muted-foreground border-border',
      };
  }
}

function getInterestStyle(level: string | null) {
  switch (level) {
    case 'low':
      return { label: 'Bajo', className: 'bg-slate-500/15 text-slate-400' };
    case 'medium':
      return { label: 'Medio', className: 'bg-blue-500/15 text-blue-400' };
    case 'high':
      return { label: 'Alto', className: 'bg-green-500/15 text-green-400' };
    case 'very_high':
      return {
        label: 'Muy alto',
        className: 'bg-emerald-500/15 text-emerald-400',
      };
    default:
      return { label: '—', className: 'bg-muted text-muted-foreground' };
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'new':
      return 'Nuevo';
    case 'assigned':
      return 'Asignado';
    case 'contacted':
      return 'Contactado';
    case 'qualified':
      return 'Calificado';
    case 'lost':
      return 'Perdido';
    case 'converted':
      return 'Convertido';
    default:
      return status;
  }
}

function formatDate(date: string | undefined) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeAgo(date: string | undefined) {
  if (!date) return '—';
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

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function LeadDetailView({
  open,
  onOpenChange,
  lead,
}: LeadDetailViewProps) {
  const router = useRouter();
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (!open || !lead?.conversation_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMessages(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('messages')
        .select('id, sender_type, content_type, content_text, created_at')
        .eq('conversation_id', lead.conversation_id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!cancelled) {
        setMessages((data ?? []).reverse() as ConversationMessage[]);
        setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lead?.conversation_id]);

  async function copyPhone() {
    if (!lead?.contacts?.phone) return;
    await navigator.clipboard.writeText(lead.contacts.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground w-full p-0 sm:max-w-lg"
      >
        {!lead ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-primary size-6 animate-spin" />
          </div>
        ) : (
          <LeadDetailBody
            lead={lead}
            messages={messages}
            loadingMessages={loadingMessages}
            copiedPhone={copiedPhone}
            onCopyPhone={copyPhone}
            onOpenConversation={() =>
              router.push(`/inbox?c=${lead.conversation_id}`)
            }
            onViewContacts={() => router.push('/contacts')}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function LeadDetailBody({
  lead,
  messages,
  loadingMessages,
  copiedPhone,
  onCopyPhone,
  onOpenConversation,
  onViewContacts,
}: {
  lead: CampaignLead;
  messages: ConversationMessage[];
  loadingMessages: boolean;
  copiedPhone: boolean;
  onCopyPhone: () => void;
  onOpenConversation: () => void;
  onViewContacts: () => void;
}) {
  const cls = getClassificationStyle(lead.classification);
  const interest = getInterestStyle(lead.interest_level);
  const confidence = lead.metadata?.confidence;
  const contact = lead.contacts;
  const broadcast = lead.broadcasts;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <SheetHeader className="border-border/50 border-b p-4">
        <div className="flex items-center gap-3">
          <Avatar className="bg-muted border-border size-12 border">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {getInitials(contact?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-popover-foreground truncate">
              {contact?.name || 'Desconocido'}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground mt-0.5 text-xs">
              {broadcast?.name || 'Campaña no disponible'}
            </SheetDescription>
            <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-3 text-xs">
              {contact?.phone && (
                <button
                  onClick={onCopyPhone}
                  className="hover:text-primary flex cursor-pointer items-center gap-1 transition-colors"
                >
                  <Phone className="size-3" />
                  {contact.phone}
                  {copiedPhone ? (
                    <Check className="text-primary size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              )}
              {contact?.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3" />
                  {contact.email}
                </span>
              )}
              {contact?.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" />
                  {contact.company}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`${cls.className} border`}>
            <span>{cls.emoji}</span>
            {cls.label}
          </Badge>
          <Badge
            variant="outline"
            className={`${interest.className} border-border`}
          >
            <TrendingUp className="size-3" />
            {interest.label}
          </Badge>
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border"
          >
            {getStatusLabel(lead.status)}
          </Badge>
        </div>
      </SheetHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* AI Summary */}
        <div className="p-4">
          <div className="border-border from-primary/10 via-card to-card rounded-xl border bg-gradient-to-br p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="bg-primary/15 text-primary flex h-7 w-7 items-center justify-center rounded-lg">
                <Sparkles className="size-4" />
              </div>
              <h3 className="text-foreground text-sm font-semibold">
                Resumen de IA
              </h3>
            </div>
            {lead.ai_summary ? (
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {lead.ai_summary}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Sin resumen disponible
              </p>
            )}
          </div>
        </div>

        {/* Lead Data */}
        <div className="px-4 pb-4">
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Datos del lead
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="border-border bg-card rounded-lg border p-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
                <Calendar className="size-3" />
                <span className="text-[11px]">Primera respuesta</span>
              </div>
              <p className="text-foreground text-xs font-medium">
                {getTimeAgo(lead.first_response_at)}
              </p>
              <p className="text-muted-foreground text-[10px]">
                {formatDate(lead.first_response_at)}
              </p>
            </div>
            <div className="border-border bg-card rounded-lg border p-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
                <Clock className="size-3" />
                <span className="text-[11px]">Última actividad</span>
              </div>
              <p className="text-foreground text-xs font-medium">
                {getTimeAgo(lead.last_activity_at)}
              </p>
              <p className="text-muted-foreground text-[10px]">
                {formatDate(lead.last_activity_at)}
              </p>
            </div>
            <div className="border-border bg-card rounded-lg border p-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
                <ShieldCheck className="size-3" />
                <span className="text-[11px]">Confianza IA</span>
              </div>
              {confidence != null ? (
                <p className="text-foreground text-xs font-medium">
                  {Math.round(confidence * 100)}%
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">—</p>
              )}
            </div>
            <div className="border-border bg-card rounded-lg border p-3">
              <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
                <Users className="size-3" />
                <span className="text-[11px]">Campaña</span>
              </div>
              <p className="text-foreground truncate text-xs font-medium">
                {broadcast?.name || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Conversation Preview */}
        {lead.conversation_id && (
          <div className="px-4 pb-4">
            <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <MessagesSquare className="size-3.5" />
              Conversación
            </h3>
            <div className="border-border bg-card overflow-hidden rounded-xl border">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground text-sm">
                    Sin mensajes disponibles
                  </p>
                </div>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto p-3">
                  {messages.map((msg) => {
                    const isCustomer = msg.sender_type === 'customer';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                            isCustomer
                              ? 'bg-muted text-foreground'
                              : msg.sender_type === 'bot'
                                ? 'bg-primary/15 text-foreground'
                                : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          {msg.content_type === 'text' ||
                          msg.content_type === 'template' ? (
                            <p className="break-words whitespace-pre-wrap">
                              {msg.content_text || `[${msg.content_type}]`}
                            </p>
                          ) : (
                            <p className="italic opacity-70">
                              [{msg.content_type}]
                            </p>
                          )}
                          <p
                            className={`mt-1 text-[9px] ${
                              isCustomer
                                ? 'text-muted-foreground'
                                : msg.sender_type === 'bot'
                                  ? 'text-primary/60'
                                  : 'text-primary-foreground/60'
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString(
                              'es-ES',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-border flex items-center gap-2 border-t p-4">
        <Button
          onClick={onOpenConversation}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
          size="sm"
        >
          <ExternalLink className="size-3.5" />
          Abrir conversación
        </Button>
        <Button
          variant="outline"
          onClick={onViewContacts}
          className="border-border text-muted-foreground hover:bg-muted"
          size="sm"
        >
          <Users className="size-3.5" />
          Ver en contactos
        </Button>
      </div>
    </div>
  );
}
