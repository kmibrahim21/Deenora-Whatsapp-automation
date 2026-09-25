import { AiError, type ChatMessage, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] }
    finishReason?: string
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

/**
 * Gemini wants roles `user` / `model` and a transcript that starts on the
 * customer. Merge consecutive turns and drop leading assistant turns,
 * same as the Anthropic adapter.
 */
function normalizeForGemini(messages: ChatMessage[]): ChatMessage[] {
  const merged = mergeConsecutive(messages)
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }
  if (merged.length === 0) {
    return [{ role: 'user', content: '(The customer has not sent a message yet.)' }]
  }
  return merged
}

/**
 * Call Google Gemini's generateContent endpoint (Google AI Studio key).
 * Returns the raw assistant text + token usage (handoff parsing happens
 * in `generateReply`).
 */
export async function generateGemini(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  }
  // Gemini 3.x Flash models "think" by default and thinking tokens count
  // against maxOutputTokens. Turn it off for Flash models to ensure
  // the full output budget is available for the reply.
  if (/flash/i.test(model)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  let res: Response
  const executeCall = async () => {
    return fetch(
      `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: normalizeForGemini(messages).map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    )
  }

  try {
    res = await executeCall()
    // 503 Overloaded / High Demand: retry once after 1s before giving up
    if (res.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      res = await executeCall()
    }
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    const body = await res.clone().text().catch(() => '')
    let detail = ''
    try {
      const parsed = JSON.parse(body)
      detail = parsed?.error?.message || ''
    } catch {
      detail = body
    }

    // Gemini reports bad key as HTTP 400 with API_KEY_INVALID
    if (res.status === 400 && (/API_KEY_INVALID|API key not valid/i.test(body) || /API_KEY_INVALID|API key not valid/i.test(detail))) {
      throw new AiError('Gemini rejected the API key: Invalid API key.', {
        code: 'invalid_key',
        status: 401,
      })
    }

    // Gemini reports permission/access issues as 403
    if (res.status === 403) {
      throw new AiError(
        detail
          ? `Gemini Access Denied (403): ${detail}`
          : 'Gemini Access Denied (403): Please ensure API Key has no restrictive IP/HTTP Referrer settings and Generative Language API is enabled.',
        {
          code: 'invalid_key',
          status: 403,
        },
      )
    }

    // Gemini rate limit / quota exceeded
    if (res.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(body) || /RESOURCE_EXHAUSTED|quota/i.test(detail)) {
      throw new AiError(
        detail
          ? `Gemini rate limit / quota exceeded (429): ${detail}`
          : 'Gemini rate limit reached (429): Requests per minute or daily quota exhausted.',
        {
          code: 'rate_limited',
          status: 429,
        },
      )
    }

    // Gemini high demand / overloaded / 503
    if (res.status === 503 || /UNAVAILABLE|overloaded|high demand|experiencing high demand/i.test(body) || /UNAVAILABLE|overloaded|high demand|experiencing high demand/i.test(detail)) {
      throw new AiError(
        detail
          ? `Gemini API overloaded (503): ${detail}`
          : 'Gemini API is currently overloaded due to high demand. Please try again shortly or add a backup key.',
        {
          code: 'rate_limited',
          status: 503,
        },
      )
    }

    throw await providerHttpError('Gemini', res)
  }

  const data = (await res.json().catch(() => null)) as GeminiResponse | null
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()
  if (!text) {
    throw new AiError('Gemini returned an empty response.', {
      code: 'empty_response',
    })
  }
  const usage = normalizeUsage({
    prompt: data?.usageMetadata?.promptTokenCount,
    completion: data?.usageMetadata?.candidatesTokenCount,
    total: data?.usageMetadata?.totalTokenCount,
  })
  return { text, usage }
}
