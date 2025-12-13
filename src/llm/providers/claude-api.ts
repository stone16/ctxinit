/**
 * Claude API Provider
 *
 * Uses Anthropic's Claude API directly via HTTP.
 */

import {
  LLMProviderType,
  LLMProviderConfig,
  LLMProviderCapabilities,
  LLMRequest,
  LLMResponse,
} from '../types';
import { BaseLLMProvider } from '../base-provider';

/**
 * Claude API provider implementation
 */
export class ClaudeAPIProvider extends BaseLLMProvider {
  private static readonly API_URL = 'https://api.anthropic.com/v1/messages';
  private static readonly DEFAULT_MODEL = 'claude-sonnet-4-20250514';

  constructor(config: LLMProviderConfig) {
    super(config);
  }

  get type(): LLMProviderType {
    return 'claude-api';
  }

  get name(): string {
    return 'Claude API (Anthropic)';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: false, // Claude doesn't have native JSON mode, but follows instructions well
      systemPrompt: true,
      streaming: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    return !!apiKey;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }

    const model = this.config.model || ClaudeAPIProvider.DEFAULT_MODEL;
    const maxTokens = this.getMaxTokens(request);
    const temperature = this.getTemperature(request);

    // Build messages array
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Build system prompt
    let systemPrompt = request.systemPrompt || '';
    const systemMessages = request.messages.filter(m => m.role === 'system');
    if (systemMessages.length > 0) {
      systemPrompt = [systemPrompt, ...systemMessages.map(m => m.content)]
        .filter(Boolean)
        .join('\n\n');
    }

    // Add JSON instruction if requested
    if (request.jsonMode) {
      systemPrompt += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation, just the JSON object.';
    }

    const body = {
      model,
      max_tokens: maxTokens,
      temperature,
      ...(systemPrompt && { system: systemPrompt }),
      messages,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.getTimeout());

    try {
      const response = await fetch(ClaudeAPIProvider.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
        usage?: {
          input_tokens: number;
          output_tokens: number;
        };
      };

      const content = data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');

      return {
        content,
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: data.usage
          ? data.usage.input_tokens + data.usage.output_tokens
          : undefined,
        metadata: { model },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
