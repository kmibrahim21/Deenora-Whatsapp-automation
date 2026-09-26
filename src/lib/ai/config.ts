import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import type { AiConfig } from './types'

interface AiConfigRow {
  provider: 'openai' | 'anthropic' | 'gemini'
  model: string
  api_key: string
  system_prompt: string | null
  is_active: boolean
  auto_reply_enabled: boolean
  auto_reply_max_per_conversation: number
  handoff_agent_id: string | null
  embeddings_api_key: string | null
}

const CONFIG_COLUMNS =
  'provider, model, api_key, system_prompt, is_active, auto_reply_enabled, auto_reply_max_per_conversation, handoff_agent_id, embeddings_api_key'

/**
 * Load and decrypt the account's AI config for *use* (draft or
 * auto-reply). Returns `null` when there's no row or the master switch
 * (`is_active`) is off — both mean "AI is not available", which callers
 * treat identically. Throws only if the stored key can't be decrypted
 * (mismatched `ENCRYPTION_KEY`), so that distinct failure surfaces
 * rather than looking like "not configured".
 *
 * Works with any client: pass the RLS-scoped SSR client from a
 * dashboard route, or the service-role admin client from the webhook.
 */
export async function loadAiConfig(
  db: SupabaseClient,
  accountId: string,
  opts: { requireActive?: boolean } = {},
): Promise<AiConfig | null> {
  const { requireActive = true } = opts
  const { data, error } = await db
    .from('ai_configs')
    .select(CONFIG_COLUMNS)
    .eq('account_id', accountId)
    .maybeSingle()

  if (error) throw error

  const serverGeminiKey = process.env.GEMINI_API_KEY

  if (!data) return null

  const row = data as AiConfigRow
  if (requireActive && !row.is_active) return null

  let resolvedKey = ''
  if (row.api_key) {
    try {
      resolvedKey = decrypt(row.api_key)
    } catch {
      resolvedKey = ''
    }
  }
  // If provider is gemini and custom key does not match Gemini API key format (must start with AIza), fallback to system key
  if (row.provider === 'gemini' && (!resolvedKey || !resolvedKey.startsWith('AIza')) && serverGeminiKey) {
    resolvedKey = serverGeminiKey
  } else if (!resolvedKey && serverGeminiKey) {
    resolvedKey = serverGeminiKey
  }
  if (!resolvedKey) return null

  let resolvedModel = row.model || 'gemini-3.8-flash'
  if (resolvedModel === 'gemini-2.5-flash' || resolvedModel === 'gemini-3.5-flash') {
    resolvedModel = 'gemini-3.8-flash'
  }

  let embeddingsApiKey: string | null = null
  if (row.embeddings_api_key) {
    try {
      embeddingsApiKey = decrypt(row.embeddings_api_key)
    } catch {
      embeddingsApiKey = null
    }
  }
  if (!embeddingsApiKey && serverGeminiKey) {
    embeddingsApiKey = serverGeminiKey
  }

  return {
    provider: row.provider || 'gemini',
    model: resolvedModel,
    apiKey: resolvedKey,
    systemPrompt:
      row.system_prompt ||
      'You are a professional, helpful, polite customer support assistant for WhatsApp. You reply clearly, accurately, and concisely in Bengali (বাংলা) or English based on the language of the customer. Answer queries about courses, prices, features, admission, and assist customers warmly.',
    isActive: row.is_active,
    autoReplyEnabled: row.auto_reply_enabled ?? true,
    autoReplyMaxPerConversation: row.auto_reply_max_per_conversation ?? 20,
    handoffAgentId: row.handoff_agent_id,
    embeddingsApiKey,
  }
}

/**
 * Load + decrypt just the embeddings key, independent of `is_active`.
 * Used by the knowledge-base ingest routes so the KB gets embedded (and
 * semantic search works) whenever an embeddings key is present, even if
 * the assistant's master switch is currently off.
 *
 * Returns `{ key, corrupt }`: `key` is null when there's no key OR it
 * can't be decrypted; `corrupt` distinguishes those cases so callers can
 * warn ("a key is set but unusable") rather than silently indexing
 * lexical-only and reporting success.
 */
export async function loadEmbeddingsKey(
  db: SupabaseClient,
  accountId: string,
): Promise<{ key: string | null; corrupt: boolean }> {
  const { data, error } = await db
    .from('ai_configs')
    .select('embeddings_api_key')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error || !data?.embeddings_api_key) return { key: null, corrupt: false }
  try {
    return { key: decrypt(data.embeddings_api_key), corrupt: false }
  } catch {
    console.error(
      `[ai config] embeddings key for account ${accountId} could not be decrypted — check ENCRYPTION_KEY.`,
    )
    return { key: null, corrupt: true }
  }
}
