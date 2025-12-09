/**
 * Cursor CLI Provider
 *
 * Uses the Cursor IDE's CLI for LLM invocation.
 * Note: Cursor primarily operates through its IDE, but can be invoked
 * via the `cursor` command in certain contexts.
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
 * Cursor CLI provider implementation
 */
export class CursorCLIProvider extends BaseLLMProvider {
  private cliCommand: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.cliCommand = config.cliPath || 'cursor';
  }

  get type(): LLMProviderType {
    return 'cursor';
  }

  get name(): string {
    return 'Cursor IDE CLI';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: false,
      systemPrompt: true,
      streaming: false, // CLI mode typically doesn't stream
      maxContextTokens: 128000,
      maxOutputTokens: 8192,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if cursor CLI is available
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
      // Cursor CLI invocation - this is a simplified implementation
      // The actual Cursor CLI API may vary
      const args = [
        'ai',  // AI subcommand (hypothetical)
        '--prompt', finalPrompt,
      ];

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
        reject(new Error(`Cursor CLI error: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Cursor CLI exited with code ${code}: ${stderr}`));
          return;
        }

        resolve({
          content: stdout.trim(),
          metadata: {
            provider: 'cursor',
            command: this.cliCommand,
          },
        });
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Cursor CLI timed out'));
      }, this.getTimeout());

      child.on('close', () => clearTimeout(timeoutId));
    });
  }
}
