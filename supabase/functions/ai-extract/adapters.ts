// Providers behind one interface. Which one runs, and with which model,
// endpoint and key, comes from the Edge Function secrets only:
//   AI_PROVIDER = anthropic (default) | ollama
//   AI_MODEL    = claude-haiku-5-5 (default for anthropic) | the Ollama model name
//   ANTHROPIC_API_KEY                      (anthropic)
//   OLLAMA_BASE_URL, OLLAMA_API_KEY (opt.) (ollama, any OpenAI-compatible endpoint)
import Anthropic from 'npm:@anthropic-ai/sdk@0.137.0'

export type Attachment = { mime: string; base64: string } | { text: string }
export type ExtractRequest = { system: string; instruction: string; attachment: Attachment | null; schema: Record<string, unknown> }
export type ExtractResult =
  | { ok: true; data: unknown; inputTokens: number | null; outputTokens: number | null }
  | { ok: false; status: 'error' | 'refused'; error: string }

export interface Provider {
  name: string
  model: string
  configured: boolean
  /** can this provider read this kind of attachment? */
  accepts(mime: string): boolean
  extract(req: ExtractRequest): Promise<ExtractResult>
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

class AnthropicProvider implements Provider {
  name = 'anthropic'
  model = Deno.env.get('AI_MODEL') || 'claude-haiku-5-5'
  private key = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  configured = this.key.length > 0

  accepts(mime: string) {
    return mime === 'application/pdf' || IMAGE_TYPES.includes(mime) || mime.startsWith('text/')
  }

  async extract(req: ExtractRequest): Promise<ExtractResult> {
    const client = new Anthropic({ apiKey: this.key })
    const content: Anthropic.ContentBlockParam[] = []
    const a = req.attachment
    if (a && 'text' in a) content.push({ type: 'text', text: `<document>\n${a.text}\n</document>` })
    else if (a && a.mime === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.base64 } })
    else if (a) content.push({ type: 'image', source: { type: 'base64', media_type: a.mime as 'image/png', data: a.base64 } })
    content.push({ type: 'text', text: req.instruction })
    try {
      const res = await client.messages.create({
        model: this.model,
        max_tokens: 8000,
        // the instructions are the same on every call: cached once they are long enough
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: req.schema } },
        messages: [{ role: 'user', content }],
      })
      if (res.stop_reason === 'refusal') return { ok: false, status: 'refused', error: 'The model declined this document' }
      if (res.stop_reason === 'max_tokens') return { ok: false, status: 'error', error: 'The answer was cut off (max tokens)' }
      const text = res.content.find((b) => b.type === 'text')
      if (!text || text.type !== 'text') return { ok: false, status: 'error', error: 'No answer from the model' }
      return { ok: true, data: JSON.parse(text.text), inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return { ok: false, status: 'error', error: 'The AI provider is busy (rate limit); try again in a minute' }
      if (e instanceof Anthropic.AuthenticationError) return { ok: false, status: 'error', error: 'The AI provider rejected the API key' }
      if (e instanceof Anthropic.BadRequestError) return { ok: false, status: 'error', error: `The AI provider refused the request: ${e.message}` }
      if (e instanceof Anthropic.APIError) return { ok: false, status: 'error', error: `AI provider error ${e.status ?? ''}`.trim() }
      return { ok: false, status: 'error', error: e instanceof Error ? e.message : String(e) }
    }
  }
}

/** Any OpenAI-compatible endpoint (Ollama, vLLM, LM Studio) — for a self-hosted model. */
class OllamaProvider implements Provider {
  name = 'ollama'
  model = Deno.env.get('AI_MODEL') || 'qwen2.5vl:7b'
  private base = (Deno.env.get('OLLAMA_BASE_URL') ?? '').replace(/\/+$/, '')
  private key = Deno.env.get('OLLAMA_API_KEY') ?? ''
  configured = this.base.length > 0

  accepts(mime: string) {
    return IMAGE_TYPES.includes(mime) || mime.startsWith('text/') // PDFs: convert to text or images first
  }

  async extract(req: ExtractRequest): Promise<ExtractResult> {
    const parts: unknown[] = []
    const a = req.attachment
    if (a && 'text' in a) parts.push({ type: 'text', text: `<document>\n${a.text}\n</document>` })
    else if (a) parts.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${a.base64}` } })
    parts.push({ type: 'text', text: req.instruction })
    try {
      const res = await fetch(`${this.base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.key ? { Authorization: `Bearer ${this.key}` } : {}) },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'system', content: req.system }, { role: 'user', content: parts }],
          response_format: { type: 'json_schema', json_schema: { name: 'extraction', strict: true, schema: req.schema } },
          temperature: 0,
        }),
      })
      if (!res.ok) return { ok: false, status: 'error', error: `AI endpoint error ${res.status}` }
      const body = await res.json()
      const text = body?.choices?.[0]?.message?.content
      if (typeof text !== 'string') return { ok: false, status: 'error', error: 'No answer from the model' }
      return { ok: true, data: JSON.parse(text), inputTokens: body?.usage?.prompt_tokens ?? null, outputTokens: body?.usage?.completion_tokens ?? null }
    } catch (e) {
      return { ok: false, status: 'error', error: e instanceof Error ? e.message : String(e) }
    }
  }
}

export function provider(): Provider {
  return (Deno.env.get('AI_PROVIDER') ?? 'anthropic').toLowerCase() === 'ollama' ? new OllamaProvider() : new AnthropicProvider()
}
