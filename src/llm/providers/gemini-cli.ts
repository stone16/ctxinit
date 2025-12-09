/**
 * Gemini CLI Provider
 *
 * Uses Google's Gemini CLI tool for LLM invocation.
 */

import { spawn, execSync } from 'child_process';
import {
  LLMProviderType,
  LLMProviderConfig,
  LLMProviderCapabilities,
  LLMRequest,
  LLMResponse,
} from '../types';
import { BaseLLMProvider } from '../base-provider';

/**
 * Gemini CLI provider implementation
 */
export class GeminiCLIProvider extends BaseLLMProvider {
  private cliCommand: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.cliCommand = config.cliPath || 'gemini';
  }

  get type(): LLMProviderType {
    return 'gemini-cli';
  }

  get name(): string {
    return 'Gemini CLI';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: false,
      systemPrompt: true,
      streaming: false,
      maxContextTokens: 1000000,
      maxOutputTokens: 8192,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync(`${this.cliCommand} --version`, {
        stdio: 'pipe',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const prompt = this.buildPromptFromMessages(request);

    // Add JSON instruction if requested
    const finalPrompt = request.jsonMode
      ? `${prompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown code blocks, no explanation, just the raw JSON object.`
      : prompt;

    return new Promise((resolve, reject) => {
      const args = [
        'prompt',
        finalPrompt,
      ];

      // Add model if specified
      if (this.config.model) {
        args.unshift('--model', this.config.model);
      }

      const child = spawn(this.cliCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.getTimeout(),
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Gemini CLI error: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
          return;
        }

        resolve({
          content: stdout.trim(),
          metadata: {
            provider: 'gemini-cli',
            command: this.cliCommand,
          },
        });
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Gemini CLI timed out'));
      }, this.getTimeout());

      child.on('close', () => clearTimeout(timeoutId));
    });
  }
}
