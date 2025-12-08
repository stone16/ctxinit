/**
 * Rule selection strategies for compilation
 *
 * Supports filtering and ordering rules by:
 * - Directory: Include rules from specific directories
 * - Glob: Include rules whose globs match current context
 * - Priority: Order rules by priority, select until budget exhausted
 * - Tag: Include rules with specific tags
 */

import * as path from 'path';
import { minimatch } from 'minimatch';
import { ParsedRule } from '../schemas/rule';
import { SelectionStrategy } from '../schemas/config';
import { estimateTokens, applyBudgetMargin } from './token-estimator';

/**
 * Selection context for glob-based matching
 */
export interface SelectionContext {
  /** Project root directory */
  projectRoot: string;
  /** Files in current context (for glob matching) */
  contextFiles?: string[];
}

/**
 * Selection options for filtering rules
 */
export interface SelectionOptions {
  /** Selection strategy */
  strategy: SelectionStrategy;
  /** Directories to include (for 'directory' strategy) */
  includeDirs?: string[];
  /** Tags to include (for 'tag' strategy) */
  includeTags?: string[];
  /** Maximum token budget */
  maxTokens?: number;
  /** Always include these rule IDs */
  alwaysInclude?: string[];
}

/**
 * Result of rule selection
 */
export interface SelectionResult {
  /** Selected rules */
  rules: ParsedRule[];
  /** Total estimated tokens */
  totalTokens: number;
  /** Rules excluded due to budget */
  excludedByBudget: ParsedRule[];
  /** Rules excluded by filter */
  excludedByFilter: ParsedRule[];
}

/**
 * Filter rules by directory
 *
 * @param rules - Rules to filter
 * @param includeDirs - Directories to include
 * @returns Filtered rules
 */
export function filterByDirectory(rules: ParsedRule[], includeDirs: string[]): ParsedRule[] {
  if (!includeDirs || includeDirs.length === 0) {
    return rules;
  }

  return rules.filter(rule => {
    const ruleDir = path.dirname(rule.path);
    return includeDirs.some(dir => {
      // Match exact directory or nested subdirectories
      const normalizedDir = dir.replace(/^\/|\/$/g, '');
      const normalizedRuleDir = ruleDir.replace(/^\/|\/$/g, '');
      return normalizedRuleDir === normalizedDir ||
             normalizedRuleDir.startsWith(normalizedDir + '/') ||
             normalizedDir === '.';
    });
  });
}

/**
 * Filter rules by glob matching against context files
 *
 * @param rules - Rules to filter
 * @param context - Selection context with project root and context files
 * @returns Filtered rules
 */
export function filterByGlob(rules: ParsedRule[], context: SelectionContext): ParsedRule[] {
  if (!context.contextFiles || context.contextFiles.length === 0) {
    return rules;
  }

  return rules.filter(rule => {
    // Check if any of the rule's globs match any context file
    for (const glob of rule.effectiveGlobs) {
      try {
        // Use minimatch to check if any context file matches the glob
        for (const contextFile of context.contextFiles!) {
          if (minimatch(contextFile, glob, { matchBase: true })) {
            return true;
          }
        }
      } catch {
        // Invalid glob, skip
      }
    }
    return false;
  });
}

/**
 * Filter rules by tag
 *
 * @param rules - Rules to filter
 * @param includeTags - Tags to include (at least one must match)
 * @returns Filtered rules
 */
export function filterByTag(rules: ParsedRule[], includeTags: string[]): ParsedRule[] {
  if (!includeTags || includeTags.length === 0) {
    return rules;
  }

  return rules.filter(rule => {
    const ruleTags = rule.frontmatter.tags || [];
    return ruleTags.some(tag => includeTags.includes(tag));
  });
}

/**
 * Sort rules by priority (highest first), then alphabetically by ID
 *
 * @param rules - Rules to sort
 * @returns Sorted rules
 */
export function sortByPriority(rules: ParsedRule[]): ParsedRule[] {
  return [...rules].sort((a, b) => {
    const priorityDiff = b.frontmatter.priority - a.frontmatter.priority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    // Equal priority: sort alphabetically by ID
    return a.frontmatter.id.localeCompare(b.frontmatter.id);
  });
}

/**
 * Select rules until token budget is exhausted
 *
 * @param rules - Rules to select from (already sorted)
 * @param maxTokens - Maximum token budget
 * @param alwaysIncludeIds - Rule IDs to always include first
 * @returns Selection result with selected rules and metadata
 */
export function selectByBudget(
  rules: ParsedRule[],
  maxTokens: number,
  alwaysIncludeIds: string[] = []
): SelectionResult {
  const effectiveBudget = applyBudgetMargin(maxTokens);
  const selected: ParsedRule[] = [];
  const excludedByBudget: ParsedRule[] = [];
  let totalTokens = 0;

  // First, add always-include rules
  const alwaysInclude = rules.filter(r => alwaysIncludeIds.includes(r.frontmatter.id));
  const remaining = rules.filter(r => !alwaysIncludeIds.includes(r.frontmatter.id));

  for (const rule of alwaysInclude) {
    const tokens = estimateTokens(rule.content).tokens;
    totalTokens += tokens;
    selected.push(rule);
  }

  // Then add remaining rules until budget exhausted
  for (const rule of remaining) {
    const tokens = estimateTokens(rule.content).tokens;

    if (totalTokens + tokens <= effectiveBudget) {
      totalTokens += tokens;
      selected.push(rule);
    } else {
      excludedByBudget.push(rule);
    }
  }

  return {
    rules: selected,
    totalTokens,
    excludedByBudget,
    excludedByFilter: [],
  };
}

/**
 * Select rules using the specified strategy
 *
 * @param rules - All available rules
 * @param options - Selection options
 * @param context - Selection context
 * @returns Selection result
 */
export function selectRules(
  rules: ParsedRule[],
  options: SelectionOptions,
  context: SelectionContext
): SelectionResult {
  let filtered = [...rules];
  const excludedByFilter: ParsedRule[] = [];

  // Apply strategy-based filtering
  switch (options.strategy) {
    case 'directory':
      if (options.includeDirs) {
        filtered = filterByDirectory(filtered, options.includeDirs);
        excludedByFilter.push(...rules.filter(r => !filtered.includes(r)));
      }
      break;

    case 'glob':
      if (context.contextFiles) {
        filtered = filterByGlob(filtered, context);
        excludedByFilter.push(...rules.filter(r => !filtered.includes(r)));
      }
      break;

    case 'tag':
      if (options.includeTags) {
        filtered = filterByTag(filtered, options.includeTags);
        excludedByFilter.push(...rules.filter(r => !filtered.includes(r)));
      }
      break;

    case 'priority':
      // Priority strategy: sort by priority, no filtering
      break;

    case 'all':
      // Include all rules
      break;
  }

  // Always sort by priority for consistent ordering
  filtered = sortByPriority(filtered);

  // Apply token budget if specified
  if (options.maxTokens !== undefined) {
    // If budget is zero or negative, exclude all rules
    if (options.maxTokens <= 0) {
      return {
        rules: [],
        totalTokens: 0,
        excludedByBudget: filtered,
        excludedByFilter,
      };
    }

    const result = selectByBudget(
      filtered,
      options.maxTokens,
      options.alwaysInclude
    );
    return {
      ...result,
      excludedByFilter,
    };
  }

  // No budget constraint
  const totalTokens = filtered.reduce(
    (sum, rule) => sum + estimateTokens(rule.content).tokens,
    0
  );

  return {
    rules: filtered,
    totalTokens,
    excludedByBudget: [],
    excludedByFilter,
  };
}

/**
 * Get rules with always_apply flag set to true
 *
 * @param rules - All rules
 * @returns Rules with always_apply: true
 */
export function getAlwaysApplyRules(rules: ParsedRule[]): ParsedRule[] {
  return rules.filter(rule => rule.frontmatter.always_apply === true);
}

/**
 * Partition rules into always-apply and conditional
 *
 * @param rules - All rules
 * @returns Object with alwaysApply and conditional arrays
 */
export function partitionRules(rules: ParsedRule[]): {
  alwaysApply: ParsedRule[];
  conditional: ParsedRule[];
} {
  const alwaysApply: ParsedRule[] = [];
  const conditional: ParsedRule[] = [];

  for (const rule of rules) {
    if (rule.frontmatter.always_apply) {
      alwaysApply.push(rule);
    } else {
      conditional.push(rule);
    }
  }

  return { alwaysApply, conditional };
}
