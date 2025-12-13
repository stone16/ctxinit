/**
 * LLM Provider Types
 *
 * Unified interface for LLM providers supporting both API and CLI invocation.
 */

/**
 * Supported LLM provider types
 */
export type LLMProviderType =
  // API providers
  | 'claude-api'
  | 'openai-api'
  | 'gemini-api'
  // CLI tool providers
  | 'claude-code'   // claude CLI
  | 'cursor'        // cursor CLI
  | 'codex'         // codex/openai CLI
  | 'gemini-cli'    // gemini CLI
  // Manual/interactive
  | 'interactive';

/**
 * Provider configuration
 */
export interface LLMProviderConfig {
  type: LLMProviderType;
  /** API key (for API providers) */
  apiKey?: string;
  /** Model to use */
  model?: string;
  /** CLI command path override */
  cliPath?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
}

/**
 * Message format for LLM communication
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM request
 */
export interface LLMRequest {
  messages: LLMMessage[];
  /** Optional system prompt (some providers handle separately) */
  systemPrompt?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
  /** JSON mode - request structured JSON output */
  jsonMode?: boolean;
}

/**
 * LLM response
 */
export interface LLMResponse {
  content: string;
  /** Tokens used in prompt */
  promptTokens?: number;
  /** Tokens used in response */
  completionTokens?: number;
  /** Total tokens */
  totalTokens?: number;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Provider capabilities
 */
export interface LLMProviderCapabilities {
  /** Supports JSON mode */
  jsonMode: boolean;
  /** Supports system prompts */
  systemPrompt: boolean;
  /** Supports streaming */
  streaming: boolean;
  /** Max context window */
  maxContextTokens: number;
  /** Max output tokens */
  maxOutputTokens: number;
}

/**
 * Provider interface - all providers must implement this
 */
export interface LLMProvider {
  /** Provider type */
  readonly type: LLMProviderType;

  /** Provider display name */
  readonly name: string;

  /** Provider capabilities */
  readonly capabilities: LLMProviderCapabilities;

  /**
   * Check if provider is available (API key set, CLI installed, etc.)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Send request to LLM
   */
  complete(request: LLMRequest): Promise<LLMResponse>;
}

/**
 * Bootstrap-specific output structure
 */
export interface BootstrapLLMOutput {
  /** Enhanced project.md content */
  projectMd?: string;
  /** Enhanced architecture.md content */
  architectureMd?: string;
  /** Generated/enhanced rules */
  rules: Array<{
    /** Path relative to .context/ (e.g., "rules/typescript-patterns.md") */
    path: string;
    /** Full file content with frontmatter */
    content: string;
  }>;
  /** Any warnings or suggestions from LLM */
  suggestions?: string[];
}

/**
 * Provider detection result
 */
export interface ProviderDetectionResult {
  available: LLMProviderType[];
  recommended: LLMProviderType | null;
  details: Record<LLMProviderType, {
    available: boolean;
    reason?: string;
  }>;
}
