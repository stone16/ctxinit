/**
 * Base LLM Provider
 *
 * Abstract base class for all LLM providers with common functionality.
 */

import {
  LLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  LLMProviderCapabilities,
  LLMRequest,
  LLMResponse,
} from './types';

/**
 * Abstract base provider class
 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  abstract get type(): LLMProviderType;
  abstract get name(): string;
  abstract get capabilities(): LLMProviderCapabilities;

  abstract isAvailable(): Promise<boolean>;
  abstract complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Get effective max tokens from config or default
   */
  protected getMaxTokens(request: LLMRequest): number {
    return request.maxTokens || this.config.maxTokens || 4096;
  }

  /**
   * Get effective temperature from config or default
   */
  protected getTemperature(request: LLMRequest): number {
    return request.temperature ?? this.config.temperature ?? 0.7;
  }

  /**
   * Get timeout in milliseconds
   */
  protected getTimeout(): number {
    return this.config.timeout || 120000; // 2 minutes default
  }

  /**
   * Build combined prompt from messages
   */
  protected buildPromptFromMessages(request: LLMRequest): string {
    const parts: string[] = [];

    if (request.systemPrompt) {
      parts.push(request.systemPrompt);
    }

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        parts.push(msg.content);
      } else if (msg.role === 'user') {
        parts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        parts.push(`Assistant: ${msg.content}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Parse JSON from LLM response, handling markdown code blocks
   */
  protected parseJsonResponse<T>(content: string): T {
    // Remove markdown code blocks if present
    let jsonStr = content.trim();

    // Handle ```json ... ``` blocks
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from LLM response: ${(error as Error).message}\n` +
        `Response content: ${content.slice(0, 500)}...`
      );
    }
  }
}
