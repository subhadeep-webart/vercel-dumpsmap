// lib/llm.js
// ---------------------------------------------------------------------------
// Emergent Universal LLM key client. Exposes a single chat-completions call
// against Emergent's OpenAI-compatible gateway. Used by features that need
// LLM access (OCR receipt scanner, future Rewards reasoning, etc.).
//
// Env vars (in /app/.env):
//   EMERGENT_LLM_KEY        — universal key (sk-emergent-...)
//   EMERGENT_LLM_BASE_URL   — base URL (defaults to integrations.emergentagent.com)
//
// Model names available — confirmed via /llm/v1/models on 2026-06:
//   gemini/gemini-2.5-flash        (default for vision / OCR — fast, cheap)
//   gemini/gemini-2.5-pro          (slower, more accurate)
//   gpt-5, gpt-4o, claude-sonnet-4-5, etc.
//
// Note: Emergent prefixes Gemini models with "gemini/" — DO NOT strip it.

const DEFAULT_BASE = 'https://integrations.emergentagent.com/llm/v1'
const DEFAULT_MODEL = 'gemini/gemini-2.5-flash'

function getConfig() {
  const key = (process.env.EMERGENT_LLM_KEY || '').trim()
  const base = (process.env.EMERGENT_LLM_BASE_URL || DEFAULT_BASE).trim().replace(/\/+$/, '')
  return { key, base, configured: !!key }
}

export function isLlmConfigured() {
  return getConfig().configured
}

/**
 * Run a chat completion against Emergent. Pass full OpenAI-compatible
 * `messages` array (each message may contain image_url parts for vision).
 *
 * Options:
 *   model            — Emergent model id (default 'gemini/gemini-2.5-flash')
 *   temperature      — default 0 (deterministic OCR)
 *   responseFormat   — pass { type: 'json_object' } to enforce JSON output
 *   maxTokens        — default 4096
 *   timeoutMs        — default 60000
 *
 * Returns the parsed JSON response body. Caller is responsible for reading
 * `choices[0].message.content`. Throws on non-2xx with the upstream error.
 */
export async function llmChat({ messages, model, temperature, responseFormat, maxTokens, timeoutMs } = {}) {
  const { key, base, configured } = getConfig()
  if (!configured) throw new Error('EMERGENT_LLM_KEY is not configured')
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages must be a non-empty array')

  const body = {
    model: model || DEFAULT_MODEL,
    messages,
    temperature: typeof temperature === 'number' ? temperature : 0,
    max_tokens: typeof maxTokens === 'number' ? maxTokens : 4096,
  }
  if (responseFormat) body.response_format = responseFormat

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), typeof timeoutMs === 'number' ? timeoutMs : 60000)
  let res
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
  } finally {
    clearTimeout(t)
  }
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch (_) { /* keep null */ }
  if (!res.ok) {
    const detail = json?.error?.message || text || `HTTP ${res.status}`
    const err = new Error(`Emergent LLM error: ${detail}`)
    err.status = res.status
    err.upstream = json
    throw err
  }
  return json
}

/**
 * Convenience: extract the assistant text content from a completion response.
 * Handles both string and array-of-parts content shapes.
 */
export function getTextContent(completion) {
  const choice = completion?.choices?.[0]
  if (!choice) return null
  const c = choice.message?.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    const part = c.find((p) => p?.type === 'text' && typeof p.text === 'string')
    return part?.text || null
  }
  if (c && typeof c === 'object' && typeof c.text === 'string') return c.text
  return null
}

/**
 * Strip code fences / leading prose around a JSON object so JSON.parse works
 * even when the model wraps output in ```json ... ``` or adds whitespace.
 */
export function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null
  let s = text.trim()
  // Strip ```json ... ``` or ``` ... ``` fences
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json|JSON)?\s*/, '').replace(/```$/, '').trim()
  }
  // Find first { and last } if there's surrounding prose
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first > 0 && last > first) s = s.slice(first, last + 1)
  try { return JSON.parse(s) } catch (_) { return null }
}
