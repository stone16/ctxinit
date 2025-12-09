/**
 * Claude Code CLI Provider
 *
 * Uses the `claude` CLI tool for LLM invocation.
 * Supports both interactive and piped modes.
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
 * Claude Code CLI provider implementation
 */
export class ClaudeCodeProvider extends BaseLLMProvider {
  private cliCommand: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.cliCommand = config.cliPath || 'claude';
  }

  get type(): LLMProviderType {
    return 'claude-code';
  }

  get name(): string {
    return 'Claude Code CLI';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: false,
      systemPrompt: true,
      streaming: true,
      maxContextTokens: 200000,
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
        '--print',  // Print response and exit (non-interactive)
        '--output-format', 'text',  // Plain text output
      ];

      // Add model if specified
      if (this.config.model) {
        args.push('--model', this.config.model);
      }

      // Add max tokens if specified
      const maxTokens = this.getMaxTokens(request);
      if (maxTokens) {
        args.push('--max-tokens', String(maxTokens));
      }

      // Add the prompt
      args.push(finalPrompt);

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
        reject(new Error(`Claude Code CLI error: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude Code CLI exited with code ${code}: ${stderr}`));
          return;
        }

        resolve({
          content: stdout.trim(),
          metadata: {
            provider: 'claude-code',
            command: this.cliCommand,
          },
        });
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Claude Code CLI timed out'));
      }, this.getTimeout());

      child.on('close', () => clearTimeout(timeoutId));
    });
  }
}
