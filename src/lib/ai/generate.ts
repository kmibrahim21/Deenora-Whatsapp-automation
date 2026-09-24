import {
  AiError,
  type AiConfig,
  type AiUsage,
  type ChatMessage,
  type GenerateResult,
} from './types'
import { HANDOFF_SENTINEL, aiRequestTimeoutMs } from './defaults'
import { generateOpenAi } from './providers/openai'
import { generateAnthropic } from './providers/anthropic'
import { generateGemini } from './providers/gemini'

export interface GenerateArgs {
  config: AiConfig
  /** Fully-built system prompt (see `buildSystemPrompt`). */
  systemPrompt: string
  /** Recent conversation turns, oldest first. */
  messages: ChatMessage[]
}

/**
 * Split multi-key strings (separated by newlines, commas, semicolons, or pipes).
 */
export function extractApiKeys(keyString: string | null | undefined): string[] {
  if (!keyString) return []
  return keyString
    .split(/[\r\n,;|]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

/**
 * Generate the next reply from the account's configured provider.
 * Dispatches to the right adapter, then parses the handoff sentinel out
 * of the raw text. Supports multi-key rotation and automatic failover
 * when a key hits rate limit (429) or access issues.
 */
export async function generateReply(args: GenerateArgs): Promise<GenerateResult> {
  const { config, systemPrompt, messages } = args
  const timeoutMs = aiRequestTimeoutMs()
  const keys = extractApiKeys(config.apiKey)

  if (keys.length === 0) {
    throw new AiError('No API key configured for AI provider.', {
      code: 'missing_key',
      status: 400,
    })
  }

  let lastError: unknown = null

  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i]
    const providerArgs = {
      apiKey: currentKey,
      model: config.model,
      systemPrompt,
      messages,
      timeoutMs,
    }

    try {
      let result: { text: string; usage: AiUsage | null }
      switch (config.provider) {
        case 'openai':
          result = await generateOpenAi(providerArgs)
          break
        case 'anthropic':
          result = await generateAnthropic(providerArgs)
          break
        case 'gemini':
          result = await generateGemini(providerArgs)
          break
        default:
          throw new AiError(`Unsupported AI provider: ${config.provider}`, {
            code: 'unsupported_provider',
            status: 400,
          })
      }
      return parseGeneration(result.text, result.usage)
    } catch (err) {
      lastError = err
      const isRetryable =
        err instanceof AiError &&
        (err.code === 'rate_limited' ||
          err.code === 'invalid_key' ||
          err.code === 'network_error' ||
          err.code === 'timeout' ||
          err.status === 429 ||
          err.status === 403 ||
          err.status === 401 ||
          err.status === 502 ||
          err.status === 503 ||
          err.status === 504)

      if (i < keys.length - 1 && isRetryable) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.warn(
          `[ai generate] Key #${i + 1} for ${config.provider} failed (${errorMsg}). Automatically failing over to backup key #${i + 2}...`,
        )
        continue
      }
      break
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }
  throw new AiError('All configured AI API keys failed.', {
    code: 'all_keys_failed',
    status: 502,
  })
}

/**
 * Split the raw model output into `{ text, handoff, usage }`. The
 * sentinel can appear alone or trailing a partial reply; either way we
 * treat the turn as a handoff and strip the marker from any remaining
 * text. `usage` is passed straight through (null when the provider
 * didn't report it).
 */
export function parseGeneration(
  raw: string,
  usage: AiUsage | null = null,
): GenerateResult {
  const handoff = raw.includes(HANDOFF_SENTINEL)
  const text = raw.split(HANDOFF_SENTINEL).join('').trim()
  return { text, handoff, usage }
}
