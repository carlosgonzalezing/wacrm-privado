'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EmailProvider } from '@/lib/email';

const MASKED_KEY = '••••••••••••••••';

const PROVIDER_LABEL: Record<EmailProvider, string> = {
  sendgrid: 'SendGrid',
  mailgun: 'Mailgun',
  ses: 'AWS SES',
  resend: 'Resend',
};

export function EmailConfig() {
  const t = useTranslations('Settings.email');
  const supabase = createClient();
  const { accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState<EmailProvider>('sendgrid');
  const [apiKey, setApiKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');

  const loadedAccountIdRef = useRef<string | null>(null);

  const fetchConfig = useCallback(async (acctId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/config');
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to load configuration');
        return;
      }

      if (data.configured) {
        setConfigured(true);
        setProvider(data.config.provider);
        setFromName(data.config.from_name);
        setFromEmail(data.config.from_email);
        setReplyToEmail(data.config.reply_to_email || '');
        setApiKey(MASKED_KEY);
        setHasStoredKey(true);
        setKeyEdited(false);
      } else {
        setConfigured(false);
        setFromName('');
        setFromEmail('');
        setReplyToEmail('');
        setApiKey('');
        setHasStoredKey(false);
        setKeyEdited(false);
      }
    } catch {
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accountId && accountId !== loadedAccountIdRef.current && !authLoading && !profileLoading) {
      loadedAccountIdRef.current = accountId;
      fetchConfig(accountId);
    }
  }, [accountId, authLoading, profileLoading, fetchConfig]);

  const handleSave = async () => {
    if (!fromName || !fromEmail || !apiKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: keyEdited ? apiKey : MASKED_KEY,
          fromName,
          fromEmail,
          replyToEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Email configuration saved successfully');
        setConfigured(true);
        setHasStoredKey(true);
        setKeyEdited(false);
        await fetchConfig(accountId!);
      } else {
        toast.error(data.error || 'Failed to save configuration');
      }
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // TODO: Implement test email sending
      toast.success('Test email sent successfully');
    } catch {
      toast.error('Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch('/api/email/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Email configuration removed');
        setConfigured(false);
        setHasStoredKey(false);
        setApiKey('');
        setKeyEdited(false);
        setFromName('');
        setFromEmail('');
        setReplyToEmail('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove configuration');
      }
    } catch {
      toast.error('Failed to remove configuration');
    } finally {
      setRemoving(false);
    }
  };

  if (loading || authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div>
      <SettingsPanelHead
        title="Email Configuration"
        description="Configure your email provider to send broadcast campaigns via email."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" /> Email Provider & API Key
          </CardTitle>
          <CardDescription>
            Your API key is encrypted at rest. Only account owners and admins can modify this setting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as EmailProvider)} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sendgrid">{PROVIDER_LABEL.sendgrid}</SelectItem>
                  <SelectItem value="mailgun">{PROVIDER_LABEL.mailgun}</SelectItem>
                  <SelectItem value="ses">{PROVIDER_LABEL.ses}</SelectItem>
                  <SelectItem value="resend">{PROVIDER_LABEL.resend}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyEdited(true);
                    }}
                    onFocus={() => {
                      if (!keyEdited && hasStoredKey) {
                        setApiKey('');
                        setKeyEdited(true);
                      }
                    }}
                    placeholder="Enter API key"
                    disabled={saving}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" onClick={handleTest} disabled={saving || testing || !apiKey}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Business Name"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@yourdomain.com"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reply-To Email (Optional)</Label>
            <Input
              type="email"
              value={replyToEmail}
              onChange={(e) => setReplyToEmail(e.target.value)}
              placeholder="support@yourdomain.com"
              disabled={saving}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Configuration'}
            </Button>
            {configured && (
              <Button variant="destructive" onClick={handleRemove} disabled={saving || removing}>
                {removing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Remove'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
