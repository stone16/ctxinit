/**
 * LLM Module
 *
 * Unified interface for LLM providers (API and CLI).
 */

// Types
export {
  LLMProviderType,
  LLMProviderConfig,
  LLMMessage,
  LLMRequest,
  LLMResponse,
  LLMProvider,
  LLMProviderCapabilities,
  BootstrapLLMOutput,
  ProviderDetectionResult,
} from './types';

// Base
export { BaseLLMProvider } from './base-provider';

// Providers
export { ClaudeAPIProvider } from './providers/claude-api';
export { ClaudeCodeProvider } from './providers/claude-code';
export { OpenAIAPIProvider } from './providers/openai-api';
export { GeminiAPIProvider } from './providers/gemini-api';
export { GeminiCLIProvider } from './providers/gemini-cli';
export { CursorCLIProvider } from './providers/cursor-cli';
export { CodexCLIProvider } from './providers/codex-cli';
export { InteractiveProvider, StdinProvider } from './providers/interactive';

// Factory
export {
  createProvider,
  detectProviders,
  autoSelectProvider,
  listProviderTypes,
} from './provider-factory';
