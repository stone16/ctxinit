import { z } from 'zod';

/**
 * Rule selection strategies for compilation
 */
export const SelectionStrategySchema = z.enum(['priority', 'directory', 'glob', 'tag', 'all']);
export type SelectionStrategy = z.infer<typeof SelectionStrategySchema>;

/**
 * Conflict resolution strategies
 */
export const ConflictResolutionStrategySchema = z.enum(['priority_wins', 'merge']);
export type ConflictResolutionStrategy = z.infer<typeof ConflictResolutionStrategySchema>;

/**
 * Claude compilation target configuration
 */
export const ClaudeTargetSchema = z.object({
  max_tokens: z.number().int().positive().default(4000),
  strategy: SelectionStrategySchema.default('priority'),
  always_include: z.array(z.string()).default([]),
});
export type ClaudeTarget = z.infer<typeof ClaudeTargetSchema>;

/**
 * Cursor compilation target configuration
 */
export const CursorTargetSchema = z.object({
  strategy: SelectionStrategySchema.default('all'),
});
export type CursorTarget = z.infer<typeof CursorTargetSchema>;

/**
 * Agents compilation target configuration
 */
export const AgentsTargetSchema = z.object({
  max_tokens: z.number().int().positive().default(8000),
  strategy: SelectionStrategySchema.default('priority'),
  include_dirs: z.array(z.string()).default([]),
});
export type AgentsTarget = z.infer<typeof AgentsTargetSchema>;

/**
 * Compilation configuration for all targets
 */
export const CompileConfigSchema = z.object({
  claude: ClaudeTargetSchema.optional(),
  cursor: CursorTargetSchema.optional(),
  agents: AgentsTargetSchema.optional(),
});
export type CompileConfig = z.infer<typeof CompileConfigSchema>;

/**
 * Conflict resolution configuration
 */
export const ConflictResolutionSchema = z.object({
  strategy: ConflictResolutionStrategySchema.default('priority_wins'),
  fallback: ConflictResolutionStrategySchema.optional(),
});
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

/**
 * Migration mode configuration
 */
export const MigrationModeSchema = z.enum(['attach', 'replace']);
export type MigrationMode = z.infer<typeof MigrationModeSchema>;

/**
 * Migration configuration for legacy file handling
 */
export const MigrationConfigSchema = z.object({
  mode: MigrationModeSchema.optional(),
  preserve_legacy: z.boolean().default(false),
  legacy_files: z.array(z.string()).default([]),
});
export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;

/**
 * Complete config.yaml schema
 */
export const ConfigSchema = z.object({
  version: z.string().default('1.0'),
  compile: CompileConfigSchema.default({}),
  conflict_resolution: ConflictResolutionSchema.default({ strategy: 'priority_wins' }),
  migration: MigrationConfigSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  version: '1.0',
  compile: {
    claude: {
      max_tokens: 4000,
      strategy: 'priority',
      always_include: [],
    },
    cursor: {
      strategy: 'all',
    },
    agents: {
      max_tokens: 8000,
      strategy: 'priority',
      include_dirs: [],
    },
  },
  conflict_resolution: {
    strategy: 'priority_wins',
  },
};
