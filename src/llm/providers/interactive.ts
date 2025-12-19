/**
 * Interactive Provider
 *
 * Manual mode where the user copies the prompt and pastes the LLM response.
 * Useful when no API keys are available or for testing.
 */

import * as readline from 'readline';
import chalk from 'chalk';
import {
  LLMProviderType,
  LLMProviderConfig,
  LLMProviderCapabilities,
  LLMRequest,
  LLMResponse,
} from '../types';
import { BaseLLMProvider } from '../base-provider';

/**
 * Interactive (manual) provider implementation
 */
export class InteractiveProvider extends BaseLLMProvider {
  constructor(config: LLMProviderConfig) {
    super(config);
  }

  get type(): LLMProviderType {
    return 'interactive';
  }

  get name(): string {
    return 'Interactive (Manual)';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: false, // User must format correctly
      systemPrompt: true,
      streaming: false,
      maxContextTokens: Infinity, // No limit
      maxOutputTokens: Infinity, // No limit
    };
  }

  async isAvailable(): Promise<boolean> {
    // Interactive mode is always available if we have a TTY
    return process.stdin.isTTY === true;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const prompt = this.buildPromptFromMessages(request);

    // Add JSON instruction if requested
    const finalPrompt = request.jsonMode
      ? `${prompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown code blocks, no explanation, just the raw JSON object.`
      : prompt;

    console.log(chalk.cyan('\n' + '='.repeat(80)));
    console.log(chalk.cyan.bold('COPY THE FOLLOWING PROMPT TO YOUR LLM:'));
    console.log(chalk.cyan('='.repeat(80) + '\n'));

    console.log(finalPrompt);

    console.log(chalk.cyan('\n' + '='.repeat(80)));
    console.log(chalk.cyan.bold('END OF PROMPT'));
    console.log(chalk.cyan('='.repeat(80) + '\n'));

    console.log(chalk.yellow('Paste the LLM response below.'));
    console.log(chalk.yellow('When done, press Enter twice (empty line) or Ctrl+D:\n'));

    const response = await this.readMultilineInput();

    return {
      content: response.trim(),
      metadata: {
        provider: 'interactive',
        manual: true,
      },
    };
  }

  /**
   * Read multiline input from stdin until empty line or EOF
   */
  private async readMultilineInput(): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      const lines: string[] = [];
      let emptyLineCount = 0;

      rl.on('line', (line) => {
        if (line === '') {
          emptyLineCount++;
          if (emptyLineCount >= 2) {
            // Two consecutive empty lines = done
            rl.close();
            return;
          }
          lines.push(line);
        } else {
          emptyLineCount = 0;
          lines.push(line);
        }
      });

      rl.on('close', () => {
        resolve(lines.join('\n'));
      });
    });
  }
}

/**
 * Stdin Provider
 *
 * Reads response from stdin (for piped input).
 * Usage: echo "response" | ctx bootstrap --provider interactive
 */
export class StdinProvider extends BaseLLMProvider {
  constructor(config: LLMProviderConfig) {
    super(config);
  }

  get type(): LLMProviderType {
    return 'interactive'; // Same type, different mode
  }

  get name(): string {
    return 'Stdin (Piped)';
  }

  get capabilities(): LLMProviderCapabilities {
    return {
      jsonMode: false,
      systemPrompt: true,
      streaming: false,
      maxContextTokens: Infinity,
      maxOutputTokens: Infinity,
    };
  }

  async isAvailable(): Promise<boolean> {
    // Available when stdin is piped (not a TTY)
    return process.stdin.isTTY !== true;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const prompt = this.buildPromptFromMessages(request);

    // Output prompt to stderr so it doesn't interfere with piping
    console.error(chalk.cyan('Prompt sent to stderr for reference.'));
    console.error(chalk.gray(prompt.slice(0, 500) + '...'));

    // Read response from stdin
    const response = await this.readStdin();

    return {
      content: response.trim(),
      metadata: {
        provider: 'stdin',
        piped: true,
      },
    };
  }

  /**
   * Read all content from stdin
   */
  private async readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';

      process.stdin.setEncoding('utf8');

      process.stdin.on('readable', () => {
        let chunk;
        while ((chunk = process.stdin.read()) !== null) {
          data += chunk;
        }
      });

      process.stdin.on('end', () => {
        resolve(data);
      });

      process.stdin.on('error', (err) => {
        reject(err);
      });
    });
  }
}
