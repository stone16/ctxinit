/**
 * Claude Compiler
 *
 * Compiles rules to a single CLAUDE.md entry file with token budget control.
 * Includes project context, architecture summary, and selected rules.
 */

import { ParsedRule } from '../schemas/rule';
import {
  BaseCompiler,
  CompilerContext,
  CompilationResult,
  OutputFile,
  CompilationError,
  CompilationWarning,
} from './base-compiler';
import { estimateTokens, applyBudgetMargin } from './token-estimator';
import {
  selectRules,
  SelectionContext,
  partitionRules,
} from './rule-selector';

/**
 * Claude compiler implementation
 */
export class ClaudeCompiler extends BaseCompiler {
  constructor(context: CompilerContext) {
    super(context);
  }

  get targetName(): string {
    return 'claude';
  }

  async compile(): Promise<CompilationResult> {
    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];

    // Get claude config
    const claudeConfig = this.context.config.compile?.claude;
    const maxTokens = claudeConfig?.max_tokens || 4000;
    const strategy = claudeConfig?.strategy || 'priority';
    const alwaysInclude = claudeConfig?.always_include || [];

    // Load project.md (required)
    const projectContent = await this.loadProjectContent();
    if (!projectContent) {
      errors.push({
        type: 'missing_file',
        message: 'project.md is required for Claude compilation but was not found',
        path: '.context/project.md',
      });
      return this.buildFailureResult(errors, warnings);
    }

    // Load architecture.md (optional)
    const architectureContent = await this.loadArchitectureContent();
    if (!architectureContent) {
      warnings.push({
        type: 'missing_optional',
        message: 'architecture.md not found, compilation will continue without it',
        path: '.context/architecture.md',
      });
    }

    // Calculate token usage for always-include content
    let usedTokens = 0;
    const alwaysIncludeTokens = estimateTokens(projectContent).tokens +
      (architectureContent ? estimateTokens(architectureContent).tokens : 0);
    usedTokens += alwaysIncludeTokens;

    // Reserve tokens for meta-rule and directory index
    const metaRule = this.generateMetaRule();
    usedTokens += estimateTokens(metaRule).tokens;

    // Calculate remaining budget for rules
    const effectiveBudget = applyBudgetMargin(maxTokens);
    const rulesBudget = Math.max(0, effectiveBudget - usedTokens);

    // Partition and select rules
    const { alwaysApply, conditional } = partitionRules(this.context.rules);

    // Always-apply rules are included first
    let selectedRules = [...alwaysApply];
    let ruleTokens = alwaysApply.reduce(
      (sum, r) => sum + estimateTokens(r.content).tokens,
      0
    );

    // Select conditional rules based on strategy
    const selectionContext: SelectionContext = {
      projectRoot: this.context.projectRoot,
    };

    const selection = selectRules(
      conditional,
      {
        strategy,
        maxTokens: rulesBudget - ruleTokens,
        alwaysInclude,
      },
      selectionContext
    );

    selectedRules = [...selectedRules, ...selection.rules];
    ruleTokens += selection.totalTokens;

    if (selection.excludedByBudget.length > 0) {
      warnings.push({
        type: 'token_limit',
        message: `${selection.excludedByBudget.length} rules excluded due to token budget`,
      });
    }

    if (selectedRules.length === 0 && this.context.rules.length > 0) {
      warnings.push({
        type: 'empty_rules',
        message: 'No rules selected for Claude compilation after budget constraints',
      });
    }

    // Build output content
    const content = this.buildOutput(
      projectContent,
      architectureContent,
      selectedRules,
      metaRule
    );

    const totalTokens = estimateTokens(content).tokens;

    // Create output
    const output: OutputFile = {
      path: 'CLAUDE.md',
      content,
      tokens: totalTokens,
    };

    // Write output
    try {
      this.writeOutput(output.path, output.content);
    } catch (error) {
      errors.push({
        type: 'write_error',
        message: `Failed to write CLAUDE.md: ${(error as Error).message}`,
        path: 'CLAUDE.md',
      });
    }

    return {
      success: errors.length === 0,
      outputs: [output],
      errors,
      warnings,
      totalTokens,
      stats: {
        rulesProcessed: this.context.rules.length,
        rulesIncluded: selectedRules.length,
        outputFiles: 1,
        totalTokens,
        tokenBudget: maxTokens,
      },
    };
  }

  /**
   * Build the complete CLAUDE.md content
   */
  private buildOutput(
    projectContent: string,
    architectureContent: string | undefined,
    rules: ParsedRule[],
    metaRule: string
  ): string {
    const sections: string[] = [];

    // Header
    sections.push('# Project Context\n');

    // Project content
    sections.push(projectContent.trim());
    sections.push('');

    // Architecture (if available)
    if (architectureContent) {
      sections.push('## Architecture\n');
      sections.push(architectureContent.trim());
      sections.push('');
    }

    // Directory index
    sections.push(this.generateDirectoryIndex(rules));

    // Rules content
    if (rules.length > 0) {
      sections.push('## Rules\n');

      for (const rule of rules) {
        sections.push(`### ${rule.frontmatter.id}\n`);

        if (rule.frontmatter.description) {
          sections.push(`*${rule.frontmatter.description}*\n`);
        }

        sections.push(rule.content.trim());
        sections.push('');
      }
    }

    // Meta-rule
    sections.push(metaRule);

    return sections.join('\n');
  }

  /**
   * Build a failure result
   */
  private buildFailureResult(
    errors: CompilationError[],
    warnings: CompilationWarning[]
  ): CompilationResult {
    return {
      success: false,
      outputs: [],
      errors,
      warnings,
      totalTokens: 0,
      stats: {
        rulesProcessed: 0,
        rulesIncluded: 0,
        outputFiles: 0,
        totalTokens: 0,
      },
    };
  }
}
