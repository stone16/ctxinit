/**
 * Cursor CLI Provider
 *
 * Experimental provider for Cursor IDE CLI integration.
 * Note: Cursor primarily operates through its IDE. This provider attempts
 * to use cursor-agent if available, falling back to piping prompts to stdin.
 *
 * This is an experimental implementation - Cursor's CLI API may change.
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
      // Note: Cursor's CLI interface is not publicly documented.
      // This implementation uses stdin piping as a fallback approach.
      // The cursor-agent command may be available in some installations.
      const args: string[] = [];

      const child = spawn(this.cliCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.getTimeout(),
      });

      let stdout = '';
      let stderr = '';

      // Write prompt to stdin for cursor to process
      if (child.stdin) {
        child.stdin.write(finalPrompt);
        child.stdin.end();
      }

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Cursor CLI error: ${error.message}`));
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Cursor CLI timed out'));
      }, this.getTimeout());

      child.on('close', (code) => {
        clearTimeout(timeoutId);
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
    });
  }
}
