import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { z } from 'zod';
import { Config, ConfigSchema, DEFAULT_CONFIG } from '../schemas/config';

/**
 * Result of loading configuration
 */
export interface ConfigLoadResult {
  config: Config;
  source: 'file' | 'defaults';
  warnings: string[];
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly details?: z.ZodError
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Load configuration from a .context directory
 *
 * @param projectDir - Project root directory containing .context/
 * @returns Loaded configuration with metadata
 * @throws ConfigError if config file exists but is invalid
 */
export function loadConfig(projectDir: string): ConfigLoadResult {
  const configPath = path.join(projectDir, '.context', 'config.yaml');
  const warnings: string[] = [];

  // Check if config file exists
  if (!fs.existsSync(configPath)) {
    return {
      config: DEFAULT_CONFIG,
      source: 'defaults',
      warnings: ['No config.yaml found, using defaults'],
    };
  }

  // Read and parse YAML
  let rawContent: string;
  try {
    rawContent = fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw new ConfigError(`Failed to read config file: ${(error as Error).message}`);
  }

  // Handle empty file
  if (!rawContent.trim()) {
    return {
      config: DEFAULT_CONFIG,
      source: 'defaults',
      warnings: ['config.yaml is empty, using defaults'],
    };
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = yaml.parse(rawContent);
  } catch (error) {
    const yamlError = error as yaml.YAMLError;
    const lineInfo = yamlError.linePos ? ` at line ${yamlError.linePos[0].line}` : '';
    throw new ConfigError(`Invalid YAML syntax${lineInfo}: ${yamlError.message}`);
  }

  // Handle null/undefined parsed result
  if (parsed === null || parsed === undefined) {
    return {
      config: DEFAULT_CONFIG,
      source: 'defaults',
      warnings: ['config.yaml parsed as empty, using defaults'],
    };
  }

  // Check for unknown keys (warn but continue)
  if (typeof parsed === 'object' && parsed !== null) {
    const knownKeys = ['version', 'compile', 'conflict_resolution', 'migration'];
    const unknownKeys = Object.keys(parsed).filter((key) => !knownKeys.includes(key));
    if (unknownKeys.length > 0) {
      warnings.push(`Unknown configuration keys will be ignored: ${unknownKeys.join(', ')}`);
    }
  }

  // Validate against schema
  const result = ConfigSchema.safeParse(parsed);

  if (!result.success) {
    const firstError = result.error.issues[0];
    const path = firstError.path.join('.');
    throw new ConfigError(
      `Configuration validation failed at '${path}': ${firstError.message}`,
      undefined,
      result.error
    );
  }

  return {
    config: result.data,
    source: 'file',
    warnings,
  };
}

/**
 * Validate a configuration object
 *
 * @param config - Configuration object to validate
 * @returns Validation result
 */
export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const result = ConfigSchema.safeParse(config);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.issues.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });

  return { valid: false, errors };
}

/**
 * Get the default configuration
 */
export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

/**
 * Merge partial configuration with defaults
 *
 * @param partial - Partial configuration to merge
 * @returns Complete configuration with defaults filled in
 */
export function mergeWithDefaults(partial: Partial<Config>): Config {
  return ConfigSchema.parse({
    ...DEFAULT_CONFIG,
    ...partial,
    compile: {
      ...DEFAULT_CONFIG.compile,
      ...partial.compile,
    },
    conflict_resolution: {
      ...DEFAULT_CONFIG.conflict_resolution,
      ...partial.conflict_resolution,
    },
  });
}
