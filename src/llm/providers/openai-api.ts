/**
 * OpenAI API Provider
 *
 * Supports OpenAI GPT models and Codex via API.
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
 * OpenAI API provider implementation
 */
export class OpenAIAPIProvider extends BaseLLMProvider {
  private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';
  private static readonly DEFAULT_MODEL = 'gpt-4o';

  constructor(config: LLMProviderConfig) {
    super(config);
  }

  get type(): LLMProviderType {
    return 'openai-api';
  }

  get name(): string {
    return 'OpenAI API';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: true, // GPT-4 supports JSON mode
      systemPrompt: true,
      streaming: true,
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    return !!apiKey;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set');
    }

    const model = this.config.model || OpenAIAPIProvider.DEFAULT_MODEL;
    const maxTokens = this.getMaxTokens(request);
    const temperature = this.getTemperature(request);

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];

    // Add system prompt
    let systemPrompt = request.systemPrompt || '';
    const systemMessages = request.messages.filter(m => m.role === 'system');
    if (systemMessages.length > 0) {
      systemPrompt = [systemPrompt, ...systemMessages.map(m => m.content)]
        .filter(Boolean)
        .join('\n\n');
    }
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add other messages
    for (const msg of request.messages) {
      if (msg.role !== 'system') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    };

    // Enable JSON mode if requested
    if (request.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.getTimeout());

    try {
      const response = await fetch(OpenAIAPIProvider.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const content = data.choices[0]?.message?.content || '';

      return {
        content,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
        metadata: { model },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
