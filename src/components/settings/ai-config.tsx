'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Info,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsPanelHead } from './settings-panel-head';
import { AiKnowledgeCard } from './ai-knowledge';
import { AI_PROVIDER_DEFAULT_MODEL } from '@/lib/ai/defaults';
import type { AiProvider } from '@/lib/ai/types';
import type { AccountMember } from '@/types';
import { fetchAccountMembers, memberLabel } from '@/lib/account/members';
import { useTranslations } from 'next-intl';

const MASKED_KEY = '••••••••••••••••';

// Radix Select can't use an empty-string item value, so the "leave
// unassigned" choice gets a sentinel that maps to null in the payload.
const HANDOFF_QUEUE = '__queue__';

const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
};

const KEY_PLACEHOLDER: Record<AiProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  gemini: 'AIza...',
};

const MAX_KEYS = 4;

export function AiConfig() {
  const { accountId, accountRole, profileLoading } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;
  const t = useTranslations('Settings.aiConfig');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [model, setModel] = useState(AI_PROVIDER_DEFAULT_MODEL.openai);
  
  // Array of API keys (1 to 4 keys for automatic failover/rotation)
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const [showKeys, setShowKeys] = useState<boolean[]>([false]);
  const [keyEdited, setKeyEdited] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  const [embeddingsKey, setEmbeddingsKey] = useState('');
  const [embeddingsKeyEdited, setEmbeddingsKeyEdited] = useState(false);
  const [hasStoredEmbeddingsKey, setHasStoredEmbeddingsKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [maxPerConversation, setMaxPerConversation] = useState(3);
  // Empty string = leave unassigned (shared queue).
  const [handoffAgentId, setHandoffAgentId] = useState('');
  const [members, setMembers] = useState<AccountMember[]>([]);

  // Guard keyed on the account (not a bare boolean) so an in-place
  // account switch — ownership transfer, multi-account membership —
  // refetches instead of showing the previous account's config.
  const loadedAccountIdRef = useRef<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t('loadFailed'));
        return;
      }
      if (data.configured) {
        setConfigured(true);
        setProvider(data.provider);
        setModel(data.model);
        setSystemPrompt(data.system_prompt ?? '');
        setIsActive(data.is_active);
        setAutoReplyEnabled(data.auto_reply_enabled);
        setMaxPerConversation(data.auto_reply_max_per_conversation ?? 3);
        setHandoffAgentId(data.handoff_agent_id ?? '');
        setHasStoredKey(Boolean(data.has_key));

        const count = Math.max(1, Math.min(MAX_KEYS, data.key_count || 1));
        setApiKeys(data.has_key ? Array(count).fill(MASKED_KEY) : ['']);
        setShowKeys(Array(count).fill(false));
        setKeyEdited(false);

        setHasStoredEmbeddingsKey(Boolean(data.has_embeddings_key));
        setEmbeddingsKey(data.has_embeddings_key ? MASKED_KEY : '');
        setEmbeddingsKeyEdited(false);
      }
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchConfig();
    void fetchAccountMembers().then(setMembers);
  }, [accountId, fetchConfig]);

  // Swap the model default when the provider changes, unless the user
  // typed a custom model.
  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    const isDefaultModel =
      model === AI_PROVIDER_DEFAULT_MODEL.openai ||
      model === AI_PROVIDER_DEFAULT_MODEL.anthropic ||
      model === AI_PROVIDER_DEFAULT_MODEL.gemini ||
      model.trim() === '';
    if (isDefaultModel) setModel(AI_PROVIDER_DEFAULT_MODEL[next]);
  };

  const handleKeyChange = (index: number, value: string) => {
    // If the user pastes multiple keys separated by newlines or commas
    if (value.includes('\n') || (value.includes(',') && value.length > 50)) {
      const parts = value
        .split(/[\r\n,]+/)
        .map((k) => k.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        const nextKeys = [...apiKeys];
        for (let i = 0; i < parts.length && index + i < MAX_KEYS; i++) {
          nextKeys[index + i] = parts[i];
        }
        setApiKeys(nextKeys);
        setKeyEdited(true);
        return;
      }
    }

    const next = [...apiKeys];
    next[index] = value;
    setApiKeys(next);
    setKeyEdited(true);
  };

  const handleKeyFocus = (index: number) => {
    if (!keyEdited && hasStoredKey && apiKeys[index] === MASKED_KEY) {
      const next = [...apiKeys];
      next[index] = '';
      setApiKeys(next);
      setKeyEdited(true);
    }
  };

  const toggleShowKey = (index: number) => {
    setShowKeys((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const addKeyField = () => {
    if (apiKeys.length >= MAX_KEYS) return;
    setApiKeys((prev) => [...prev, '']);
    setShowKeys((prev) => [...prev, false]);
    setKeyEdited(true);
  };

  const removeKeyField = (index: number) => {
    if (apiKeys.length <= 1) {
      setApiKeys(['']);
      setShowKeys([false]);
    } else {
      setApiKeys((prev) => prev.filter((_, i) => i !== index));
      setShowKeys((prev) => prev.filter((_, i) => i !== index));
    }
    setKeyEdited(true);
  };

  const keyPayload = () => {
    if (!keyEdited) return undefined;
    const clean = apiKeys.map((k) => k.trim()).filter((k) => k.length > 0);
    return clean.length > 0 ? clean.join('\n') : '';
  };

  // undefined = leave unchanged; '' typed = null (clear); text = set.
  const embeddingsKeyPayload = () =>
    embeddingsKeyEdited ? embeddingsKey.trim() || null : undefined;

  const buildBody = () => ({
    provider,
    model: model.trim(),
    api_key: keyPayload(),
    embeddings_api_key: embeddingsKeyPayload(),
    system_prompt: systemPrompt.trim() || null,
    is_active: isActive,
    auto_reply_enabled: autoReplyEnabled,
    auto_reply_max_per_conversation: maxPerConversation,
    handoff_agent_id: handoffAgentId || null,
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          api_key: keyPayload(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          apiKeys.filter((k) => k.trim()).length > 1
            ? 'All configured API keys verified successfully!'
            : t('testSuccess'),
        );
      } else {
        toast.error(data.error ?? t('testRejected'), { duration: 6000 });
      }
    } catch {
      toast.error(t('testNetworkError'));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!model.trim()) {
      toast.error(t('missingModel'));
      return;
    }
    if (!configured && !keyEdited) {
      toast.error(t('missingApiKey'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('saveSuccess'));
        await fetchConfig();
      } else {
        toast.error(data.error ?? t('saveFailed'), { duration: 6000 });
      }
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch('/api/ai/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('removeSuccess'));
        setConfigured(false);
        setHasStoredKey(false);
        setApiKeys(['']);
        setShowKeys([false]);
        setKeyEdited(false);
        setIsActive(false);
        setAutoReplyEnabled(false);
        setSystemPrompt('');
        setHandoffAgentId('');
      } else {
        const data = await res.json();
        toast.error(data.error ?? t('removeFailed'));
      }
    } catch {
      toast.error(t('removeFailed'));
    } finally {
      setRemoving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  const disabled = !canEdit || saving;

  return (
    <div>
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
      />

      {!canEdit && (
        <p className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t('adminOnlyConfig')}
        </p>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> {t('providerAndKey')}
            </CardTitle>
            <CardDescription>
              {t('encryptionNotice')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('provider')}</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => handleProviderChange(v as AiProvider)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">{PROVIDER_LABEL.openai}</SelectItem>
                    <SelectItem value="anthropic">
                      {PROVIDER_LABEL.anthropic}
                    </SelectItem>
                    <SelectItem value="gemini">{PROVIDER_LABEL.gemini}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-model">{t('model')}</Label>
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Provider Info / Troubleshooting Banner for Gemini */}
            {provider === 'gemini' && (
              <div className="rounded-lg border border-sky-500/20 bg-sky-50/50 p-3.5 text-xs text-sky-900 dark:bg-sky-950/20 dark:text-sky-200">
                <div className="flex items-start gap-2.5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sky-950 dark:text-sky-100">
                      Google Gemini API কী সেটআপ ও এক্সেস নির্দেশনা:
                    </p>
                    <ul className="list-inside list-disc space-y-0.5 text-muted-foreground dark:text-sky-300">
                      <li>Google AI Studio (<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-medium hover:text-sky-600">aistudio.google.com</a>) থেকে API Key তৈরি করুন।</li>
                      <li>Google Cloud Console-এ API Key এর <strong>Application restrictions</strong> অবশ্যই <code>None</code> রাখুন (HTTP Referrer বা IP রেস্ট্রিক্ট থাকলে সার্ভার থেকে কল ব্লক হবে ও Access Denied দেখাবে)।</li>
                      <li>প্রজেক্টে <strong>Generative Language API</strong> সক্রিয় থাকতে হবে।</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* API Keys with Multi-Key Rotation / Fallback */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="ai-key-0">{t('apiKey')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    একাধিক কী (সর্বোচ্চ {MAX_KEYS}টি) দিলে একটির লিমিট বা কোটা শেষ হলে স্বয়ংক্রিয়ভাবে পরবর্তী কী ব্যবহার হবে (Auto Failover)।
                  </p>
                </div>
                {apiKeys.length < MAX_KEYS && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addKeyField}
                    disabled={disabled}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> ব্যাকআপ কী যোগ করুন
                  </Button>
                )}
              </div>

              <div className="space-y-2.5">
                {apiKeys.map((keyVal, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {idx === 0 ? 'Primary' : `Backup #${idx}`}
                        </span>
                      </div>
                      <Input
                        id={`ai-key-${idx}`}
                        type={showKeys[idx] ? 'text' : 'password'}
                        value={keyVal}
                        onChange={(e) => handleKeyChange(idx, e.target.value)}
                        onFocus={() => handleKeyFocus(idx)}
                        placeholder={`${KEY_PLACEHOLDER[provider]} ${idx > 0 ? `(Backup Key ${idx})` : ''}`}
                        disabled={disabled}
                        autoComplete="off"
                        className="pl-24 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(idx)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showKeys[idx] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {idx > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeKeyField(idx)}
                        disabled={disabled}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                        title="রিমুভ করুন"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  কীগুলো AES-256-GCM এনক্রিপশনে সুরক্ষিত থাকবে।
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={disabled || testing}
                  className="h-8 text-xs"
                >
                  {testing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  )}
                  {t('testKey')}
                </Button>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="ai-embeddings-key">
                {t('embeddingsKey')}{' '}
                <span className="font-normal text-muted-foreground">
                  {t('optionalSemanticSearch')}
                </span>
              </Label>
              <Input
                id="ai-embeddings-key"
                type="password"
                value={embeddingsKey}
                onChange={(e) => {
                  setEmbeddingsKey(e.target.value);
                  setEmbeddingsKeyEdited(true);
                }}
                onFocus={() => {
                  if (!embeddingsKeyEdited && hasStoredEmbeddingsKey) {
                    setEmbeddingsKey('');
                    setEmbeddingsKeyEdited(true);
                  }
                }}
                placeholder="sk-... (OpenAI)"
                disabled={disabled}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {t('embeddingsHint', {
                  sameKeyText: provider === 'openai' ? t('sameKeyText') : '',
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('behaviour')}</CardTitle>
            <CardDescription>
              {t('behaviourDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">{t('businessContext')}</Label>
              <Textarea
                id="ai-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('promptPlaceholder')}
                rows={5}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('enableAssistant')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('enableAssistantDesc')}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t('autoReply')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('autoReplyDesc')}
                </p>
              </div>
              <Switch
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
                disabled={disabled || !isActive}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ai-max">{t('maxAutoReplies')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('maxAutoRepliesDesc')}
                </p>
              </div>
              <Input
                id="ai-max"
                type="number"
                min={1}
                max={20}
                value={maxPerConversation}
                onChange={(e) =>
                  setMaxPerConversation(
                    Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                disabled={disabled || !autoReplyEnabled}
                className="w-20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-handoff">{t('handoffTo')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('handoffToDesc')}
              </p>
              <Select
                value={handoffAgentId || HANDOFF_QUEUE}
                onValueChange={(v) =>
                  setHandoffAgentId(!v || v === HANDOFF_QUEUE ? '' : v)
                }
                disabled={disabled || !autoReplyEnabled}
              >
                <SelectTrigger id="ai-handoff">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HANDOFF_QUEUE}>
                    {t('handoffQueue')}
                  </SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {memberLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <AiKnowledgeCard
          accountId={accountId}
          canEdit={canEdit}
          hasEmbeddingsKey={
            embeddingsKeyEdited
              ? embeddingsKey.trim().length > 0
              : hasStoredEmbeddingsKey
          }
        />

        <div className="flex items-center justify-between">
          {configured ? (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={!canEdit || removing}
              className="text-destructive hover:text-destructive"
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('remove')}
            </Button>
          ) : (
            <span />
          )}

          <Button onClick={handleSave} disabled={disabled}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
