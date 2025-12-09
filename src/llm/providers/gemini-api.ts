/**
 * Google Gemini API Provider
 *
 * Uses Google's Gemini API for LLM invocation.
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
 * Gemini API provider implementation
 */
export class GeminiAPIProvider extends BaseLLMProvider {
  private static readonly DEFAULT_MODEL = 'gemini-1.5-pro';

  constructor(config: LLMProviderConfig) {
    super(config);
  }

  get type(): LLMProviderType {
    return 'gemini-api';
  }

  get name(): string {
    return 'Google Gemini API';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: true,
      systemPrompt: true,
      streaming: true,
      maxContextTokens: 1000000, // Gemini 1.5 Pro has 1M context
      maxOutputTokens: 8192,
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = this.config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    return !!apiKey;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY not set');
    }

    const model = this.config.model || GeminiAPIProvider.DEFAULT_MODEL;
    const maxTokens = this.getMaxTokens(request);
    const temperature = this.getTemperature(request);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Build contents array
    const contents: Array<{
      role: string;
      parts: Array<{ text: string }>;
    }> = [];

    // Build system instruction
    let systemInstruction = request.systemPrompt || '';
    const systemMessages = request.messages.filter(m => m.role === 'system');
    if (systemMessages.length > 0) {
      systemInstruction = [systemInstruction, ...systemMessages.map(m => m.content)]
        .filter(Boolean)
        .join('\n\n');
    }

    // Add JSON instruction if requested
    if (request.jsonMode) {
      systemInstruction += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation, just the JSON object.';
    }

    // Add user/assistant messages
    for (const msg of request.messages) {
      if (msg.role !== 'system') {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    // Add system instruction if present
    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    // Enable JSON mode if requested
    if (request.jsonMode) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.getTimeout());

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        candidates: Array<{
          content: {
            parts: Array<{ text: string }>;
          };
        }>;
        usageMetadata?: {
          promptTokenCount: number;
          candidatesTokenCount: number;
          totalTokenCount: number;
        };
      };

      const content = data.candidates[0]?.content?.parts
        ?.map(p => p.text)
        .join('') || '';

      return {
        content,
        promptTokens: data.usageMetadata?.promptTokenCount,
        completionTokens: data.usageMetadata?.candidatesTokenCount,
        totalTokens: data.usageMetadata?.totalTokenCount,
        metadata: { model },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
