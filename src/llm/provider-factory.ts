/**
 * LLM Provider Factory
 *
 * Creates and manages LLM providers with auto-detection capabilities.
 */

import {
  LLMProvider,
  LLMProviderType,
  LLMProviderConfig,
  ProviderDetectionResult,
} from './types';
import { ClaudeAPIProvider } from './providers/claude-api';
import { ClaudeCodeProvider } from './providers/claude-code';
import { OpenAIAPIProvider } from './providers/openai-api';
import { GeminiAPIProvider } from './providers/gemini-api';
import { GeminiCLIProvider } from './providers/gemini-cli';
import { CursorCLIProvider } from './providers/cursor-cli';
import { CodexCLIProvider } from './providers/codex-cli';
import { InteractiveProvider, StdinProvider } from './providers/interactive';

/**
 * Provider priority order for auto-detection
 * Higher priority providers are preferred when multiple are available
 */
const PROVIDER_PRIORITY: LLMProviderType[] = [
  'claude-code',    // Prefer local CLI tools first
  'cursor',
  'codex',
  'gemini-cli',
  'claude-api',     // Then APIs
  'openai-api',
  'gemini-api',
  'interactive',    // Fallback to manual
];

/**
 * Create a provider instance
 */
export function createProvider(
  type: LLMProviderType,
  config: Partial<LLMProviderConfig> = {}
): LLMProvider {
  const fullConfig: LLMProviderConfig = {
    type,
    ...config,
  };

  switch (type) {
    case 'claude-api':
      return new ClaudeAPIProvider(fullConfig);
    case 'claude-code':
      return new ClaudeCodeProvider(fullConfig);
    case 'openai-api':
      return new OpenAIAPIProvider(fullConfig);
    case 'gemini-api':
      return new GeminiAPIProvider(fullConfig);
    case 'gemini-cli':
      return new GeminiCLIProvider(fullConfig);
    case 'cursor':
      return new CursorCLIProvider(fullConfig);
    case 'codex':
      return new CodexCLIProvider(fullConfig);
    case 'interactive':
      // Choose between interactive and stdin based on TTY
      if (process.stdin.isTTY) {
        return new InteractiveProvider(fullConfig);
      }
      return new StdinProvider(fullConfig);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * Detect all available providers
 */
export async function detectProviders(): Promise<ProviderDetectionResult> {
  const details: ProviderDetectionResult['details'] = {} as ProviderDetectionResult['details'];
  const available: LLMProviderType[] = [];

  // Check all provider types
  const allTypes: LLMProviderType[] = [
    'claude-api',
    'claude-code',
    'openai-api',
    'gemini-api',
    'gemini-cli',
    'cursor',
    'codex',
    'interactive',
  ];

  await Promise.all(
    allTypes.map(async (type) => {
      try {
        const provider = createProvider(type);
        const isAvailable = await provider.isAvailable();

        details[type] = {
          available: isAvailable,
          reason: isAvailable ? undefined : getUnavailableReason(type),
        };

        if (isAvailable) {
          available.push(type);
        }
      } catch (error) {
        details[type] = {
          available: false,
          reason: (error as Error).message,
        };
      }
    })
  );

  // Determine recommended provider based on priority
  let recommended: LLMProviderType | null = null;
  for (const type of PROVIDER_PRIORITY) {
    if (available.includes(type)) {
      recommended = type;
      break;
    }
  }

  return {
    available,
    recommended,
    details,
  };
}

/**
 * Get reason why a provider is unavailable
 */
function getUnavailableReason(type: LLMProviderType): string {
  switch (type) {
    case 'claude-api':
      return 'ANTHROPIC_API_KEY environment variable not set';
    case 'claude-code':
      return 'claude CLI not found in PATH';
    case 'openai-api':
      return 'OPENAI_API_KEY environment variable not set';
    case 'gemini-api':
      return 'GOOGLE_API_KEY or GEMINI_API_KEY environment variable not set';
    case 'gemini-cli':
      return 'gemini CLI not found in PATH';
    case 'cursor':
      return 'cursor CLI not found in PATH';
    case 'codex':
      return 'codex CLI not found in PATH';
    case 'interactive':
      return 'No TTY available for interactive input';
    default:
      return 'Unknown reason';
  }
}

/**
 * Auto-select the best available provider
 */
export async function autoSelectProvider(
  preferredType?: LLMProviderType
): Promise<LLMProvider> {
  // If preferred type specified, try it first
  if (preferredType) {
    const provider = createProvider(preferredType);
    if (await provider.isAvailable()) {
      return provider;
    }
    throw new Error(
      `Preferred provider '${preferredType}' is not available: ${getUnavailableReason(preferredType)}`
    );
  }

  // Auto-detect
  const detection = await detectProviders();

  if (!detection.recommended) {
    throw new Error(
      'No LLM provider available. Please set up one of:\n' +
      '  - ANTHROPIC_API_KEY for Claude API\n' +
      '  - Install claude CLI for Claude Code\n' +
      '  - OPENAI_API_KEY for OpenAI API\n' +
      '  - GOOGLE_API_KEY for Gemini API\n' +
      '  - Install cursor, codex, or gemini CLI'
    );
  }

  return createProvider(detection.recommended);
}

/**
 * List all supported provider types with descriptions
 */
export function listProviderTypes(): Array<{
  type: LLMProviderType;
  name: string;
  description: string;
}> {
  return [
    {
      type: 'claude-api',
      name: 'Claude API',
      description: 'Anthropic Claude API (requires ANTHROPIC_API_KEY)',
    },
    {
      type: 'claude-code',
      name: 'Claude Code',
      description: 'Claude Code CLI tool (requires claude in PATH)',
    },
    {
      type: 'openai-api',
      name: 'OpenAI API',
      description: 'OpenAI GPT API (requires OPENAI_API_KEY)',
    },
    {
      type: 'gemini-api',
      name: 'Gemini API',
      description: 'Google Gemini API (requires GOOGLE_API_KEY)',
    },
    {
      type: 'gemini-cli',
      name: 'Gemini CLI',
      description: 'Google Gemini CLI tool (requires gemini in PATH)',
    },
    {
      type: 'cursor',
      name: 'Cursor',
      description: 'Cursor IDE CLI (requires cursor in PATH)',
    },
    {
      type: 'codex',
      name: 'Codex/Copilot',
      description: 'OpenAI Codex or GitHub Copilot CLI',
    },
    {
      type: 'interactive',
      name: 'Interactive',
      description: 'Manual copy/paste mode (always available with TTY)',
    },
  ];
}
