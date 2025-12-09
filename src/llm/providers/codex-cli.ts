/**
 * Codex CLI Provider
 *
 * Uses OpenAI's Codex CLI tool for LLM invocation.
 * Also supports GitHub Copilot CLI.
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
 * Codex/Copilot CLI provider implementation
 */
export class CodexCLIProvider extends BaseLLMProvider {
  private cliCommand: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    // Support multiple CLI tools
    this.cliCommand = config.cliPath || this.detectCLI();
  }

  /**
   * Detect available CLI tool
   */
  private detectCLI(): string {
    // Try codex first, then gh copilot
    const candidates = ['codex', 'gh copilot'];

    for (const cmd of candidates) {
      try {
        execSync(`${cmd.split(' ')[0]} --version`, {
          stdio: 'pipe',
          timeout: 5000,
        });
        return cmd;
      } catch {
        // Continue to next candidate
      }
    }

    return 'codex'; // Default, will fail on isAvailable check
  }

  get type(): LLMProviderType {
    return 'codex';
  }

  get name(): string {
    return 'Codex/Copilot CLI';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: false,
      systemPrompt: true,
      streaming: false,
      maxContextTokens: 128000,
      maxOutputTokens: 8192,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const cmd = this.cliCommand.split(' ')[0];
      execSync(`${cmd} --version`, {
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
      let args: string[];

      if (this.cliCommand.startsWith('gh copilot')) {
        // GitHub Copilot CLI
        args = ['copilot', 'suggest', '-t', 'shell', finalPrompt];
      } else {
        // Generic codex CLI
        args = ['--prompt', finalPrompt];
      }

      const [cmd, ...cmdArgs] = this.cliCommand.split(' ');
      const fullArgs = [...cmdArgs, ...args];

      const child = spawn(cmd, fullArgs, {
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
        reject(new Error(`Codex CLI error: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Codex CLI exited with code ${code}: ${stderr}`));
          return;
        }

        resolve({
          content: stdout.trim(),
          metadata: {
            provider: 'codex',
            command: this.cliCommand,
          },
        });
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Codex CLI timed out'));
      }, this.getTimeout());

      child.on('close', () => clearTimeout(timeoutId));
    });
  }
}
