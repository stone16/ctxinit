import { z } from 'zod';

/**
 * Rule frontmatter schema for .md rule files
 */
export const RuleFrontmatterSchema = z.object({
  id: z.string().min(1, 'Rule ID is required'),
  description: z.string().optional(),
  domain: z.string().optional(),
  globs: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.number().int().min(0).max(100).default(50),
  tags: z.array(z.string()).default([]),
  always_apply: z.boolean().default(false),
});
export type RuleFrontmatter = z.infer<typeof RuleFrontmatterSchema>;

/**
 * Complete parsed rule with frontmatter and content
 */
export interface ParsedRule {
  /** File path relative to .context/rules/ */
  path: string;
  /** Absolute file path */
  absolutePath: string;
  /** Parsed and validated frontmatter */
  frontmatter: RuleFrontmatter;
  /** Markdown content body (after frontmatter) */
  content: string;
  /** Inferred globs from directory path if not specified */
  inferredGlobs: string[];
  /** Effective globs (explicit or inferred) */
  effectiveGlobs: string[];
}

/**
 * Rule validation result
 */
export interface RuleValidationResult {
  valid: boolean;
  errors: RuleValidationError[];
  warnings: RuleValidationWarning[];
}

/**
 * Rule validation error (blocking)
 */
export interface RuleValidationError {
  type: 'schema' | 'duplicate_id' | 'circular_reference' | 'path_traversal' | 'dead_link';
  message: string;
  path: string;
  line?: number;
}

/**
 * Rule validation warning (non-blocking)
 */
export interface RuleValidationWarning {
  type: 'ghost_rule' | 'token_limit' | 'deprecated';
  message: string;
  path: string;
}

/**
 * Default priority value for rules without explicit priority
 */
export const DEFAULT_PRIORITY = 50;

/**
 * Infer globs from a rule's directory path
 * @param rulePath - Relative path to the rule file (e.g., 'backend/auth/login.md')
 * @returns Array of inferred glob patterns
 */
export function inferGlobsFromPath(rulePath: string): string[] {
  const pathParts = rulePath.split('/');

  // Remove the filename
  pathParts.pop();

  if (pathParts.length === 0) {
    // Rule is in root of rules directory - applies to all files
    return ['**/*'];
  }

  // Build glob pattern from directory path
  // e.g., 'backend/auth' -> 'backend/auth/**/*', 'src/backend/auth/**/*'
  const dirPath = pathParts.join('/');
  return [
    `${dirPath}/**/*`,
    `src/${dirPath}/**/*`,
    `lib/${dirPath}/**/*`,
  ];
}
