import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { ParsedRule, RuleValidationError, RuleValidationWarning, RuleValidationResult } from '../schemas/rule';
import { Config } from '../schemas/config';

/**
 * Analysis result for a complete validation run
 */
export interface AnalysisResult {
  /** Whether validation passed (no blocking errors) */
  valid: boolean;
  /** Blocking errors that prevent compilation */
  errors: RuleValidationError[];
  /** Non-blocking warnings */
  warnings: RuleValidationWarning[];
  /** Total rules analyzed */
  rulesAnalyzed: number;
}

/**
 * Options for static analysis
 */
export interface AnalysisOptions {
  /** Project root directory */
  projectRoot: string;
  /** Configuration for token limits */
  config?: Config;
}

/**
 * Analyze rules for duplicate IDs
 *
 * @param rules - Parsed rules to analyze
 * @returns Array of duplicate ID errors
 */
export function findDuplicateIds(rules: ParsedRule[]): RuleValidationError[] {
  const errors: RuleValidationError[] = [];
  const idMap = new Map<string, string[]>();

  for (const rule of rules) {
    const id = rule.frontmatter.id;
    const paths = idMap.get(id) || [];
    paths.push(rule.path);
    idMap.set(id, paths);
  }

  for (const [id, paths] of idMap) {
    if (paths.length > 1) {
      for (const rulePath of paths) {
        errors.push({
          type: 'duplicate_id',
          message: `Duplicate rule ID '${id}' found in: ${paths.filter(p => p !== rulePath).join(', ')}`,
          path: rulePath,
        });
      }
    }
  }

  return errors;
}

/**
 * Find dead links in markdown content
 *
 * @param rule - Parsed rule to analyze
 * @param projectRoot - Project root for resolving relative links
 * @returns Array of dead link errors
 */
export function findDeadLinks(rule: ParsedRule, projectRoot: string): RuleValidationError[] {
  const errors: RuleValidationError[] = [];

  // Match markdown links: [text](path)
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(rule.content)) !== null) {
    const linkPath = match[2];

    // Skip external URLs and anchors
    if (linkPath.startsWith('http://') ||
        linkPath.startsWith('https://') ||
        linkPath.startsWith('#') ||
        linkPath.startsWith('mailto:')) {
      continue;
    }

    // Handle paths relative to the rule file
    const ruleDir = path.dirname(rule.absolutePath);
    const resolvedPath = linkPath.startsWith('/')
      ? path.join(projectRoot, linkPath)
      : path.join(ruleDir, linkPath);

    // Remove anchor from path for file existence check
    const pathWithoutAnchor = resolvedPath.split('#')[0];

    if (!fs.existsSync(pathWithoutAnchor)) {
      const lineNumber = getLineNumber(rule.content, match.index);
      errors.push({
        type: 'dead_link',
        message: `Dead link found: ${linkPath}`,
        path: rule.path,
        line: lineNumber,
      });
    }
  }

  return errors;
}

/**
 * Find ghost rules (globs that match no files)
 *
 * @param rule - Parsed rule to analyze
 * @param projectRoot - Project root for glob matching
 * @returns Array of ghost rule warnings
 */
export function findGhostRules(rule: ParsedRule, projectRoot: string): RuleValidationWarning[] {
  const warnings: RuleValidationWarning[] = [];

  // Skip rules with always_apply flag
  if (rule.frontmatter.always_apply) {
    return warnings;
  }

  for (const glob of rule.effectiveGlobs) {
    try {
      const matches = fg.sync(glob, {
        cwd: projectRoot,
        onlyFiles: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'coverage/**'],
      });

      if (matches.length === 0) {
        warnings.push({
          type: 'ghost_rule',
          message: `Glob pattern '${glob}' matches no files`,
          path: rule.path,
        });
      }
    } catch {
      // Invalid glob pattern - will be caught elsewhere
    }
  }

  return warnings;
}

/**
 * Check for potential token limit issues
 *
 * @param rules - Parsed rules to analyze
 * @param config - Configuration with token limits
 * @returns Array of token limit warnings
 */
export function checkTokenLimits(rules: ParsedRule[], config?: Config): RuleValidationWarning[] {
  const warnings: RuleValidationWarning[] = [];

  if (!config?.compile?.claude?.max_tokens) {
    return warnings;
  }

  const maxTokens = config.compile.claude.max_tokens;

  // Rough token estimation: ~4 chars per token for English text
  const totalChars = rules.reduce((sum, rule) => {
    return sum + rule.content.length + JSON.stringify(rule.frontmatter).length;
  }, 0);

  const estimatedTokens = Math.ceil(totalChars / 4);

  if (estimatedTokens > maxTokens * 0.9) {
    warnings.push({
      type: 'token_limit',
      message: `Estimated tokens (${estimatedTokens}) approaching limit (${maxTokens}). Consider reducing content or increasing limit.`,
      path: 'all rules',
    });
  }

  return warnings;
}

/**
 * Detect circular references in rule imports
 *
 * @param rules - Parsed rules to analyze
 * @returns Array of circular reference errors
 */
export function findCircularReferences(rules: ParsedRule[]): RuleValidationError[] {
  const errors: RuleValidationError[] = [];
  const ruleMap = new Map<string, ParsedRule>();

  // Build a map of rule IDs to rules
  for (const rule of rules) {
    ruleMap.set(rule.frontmatter.id, rule);
  }

  // Find @import or @include references in content
  const importPattern = /@(?:import|include)\s+["']([^"']+)["']/g;

  for (const rule of rules) {
    const visited = new Set<string>();
    const stack = [rule.frontmatter.id];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) {
        errors.push({
          type: 'circular_reference',
          message: `Circular reference detected: ${Array.from(visited).join(' -> ')} -> ${currentId}`,
          path: rule.path,
        });
        break;
      }

      visited.add(currentId);
      const currentRule = ruleMap.get(currentId);

      if (currentRule) {
        let match;
        while ((match = importPattern.exec(currentRule.content)) !== null) {
          const importedId = match[1];
          if (ruleMap.has(importedId)) {
            stack.push(importedId);
          }
        }
        // Reset regex lastIndex for next iteration
        importPattern.lastIndex = 0;
      }
    }
  }

  return errors;
}

/**
 * Validate a single rule
 *
 * @param rule - Parsed rule to validate
 * @param options - Analysis options
 * @returns Validation result for the rule
 */
export function validateRule(rule: ParsedRule, options: AnalysisOptions): RuleValidationResult {
  const errors: RuleValidationError[] = [];
  const warnings: RuleValidationWarning[] = [];

  // Check for dead links
  errors.push(...findDeadLinks(rule, options.projectRoot));

  // Check for ghost rules
  warnings.push(...findGhostRules(rule, options.projectRoot));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Run complete static analysis on all rules
 *
 * @param rules - Parsed rules to analyze
 * @param options - Analysis options
 * @returns Complete analysis result
 */
export function analyzeRules(rules: ParsedRule[], options: AnalysisOptions): AnalysisResult {
  const errors: RuleValidationError[] = [];
  const warnings: RuleValidationWarning[] = [];

  // Check for duplicate IDs
  errors.push(...findDuplicateIds(rules));

  // Check for circular references
  errors.push(...findCircularReferences(rules));

  // Validate each rule individually
  for (const rule of rules) {
    const result = validateRule(rule, options);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  // Check token limits
  warnings.push(...checkTokenLimits(rules, options.config));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rulesAnalyzed: rules.length,
  };
}

/**
 * Get line number from string index
 */
function getLineNumber(content: string, index: number): number {
  const lines = content.slice(0, index).split('\n');
  return lines.length;
}
