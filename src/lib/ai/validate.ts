import { extractApiKeys, generateReply } from './generate'
import { AiError, type AiConfig } from './types'

/**
 * Cheap liveness + auth check: validates configured keys against the
 * configured provider/model. Throws `AiError` on failure, resolves on success.
 */
export async function validateAiCredentials(config: AiConfig): Promise<void> {
  const keys = extractApiKeys(config.apiKey)
  if (keys.length === 0) {
    throw new AiError('API key is required', { code: 'missing_key', status: 400 })
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
      await generateReply({
        config: { ...config, apiKey: key },
        systemPrompt: 'You are a connectivity check. Reply with the single word: OK.',
        messages: [{ role: 'user', content: 'ping' }],
      })
    } catch (err) {
      const label = keys.length > 1 ? `Key #${i + 1}` : 'API key'
      const msg = err instanceof Error ? err.message : String(err)
      throw new AiError(`${label} validation error: ${msg}`, {
        code: err instanceof AiError ? err.code : 'invalid_key',
        status: 400,
      })
    }
  }
}
