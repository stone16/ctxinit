/**
 * Agents Compiler
 *
 * Compiles rules to a comprehensive AGENTS.md file for general AI agents.
 * Includes full project context, architecture, and rule summaries.
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
import { sortByPriority } from './rule-selector';

/**
 * Agents compiler implementation
 */
export class AgentsCompiler extends BaseCompiler {
  constructor(context: CompilerContext) {
    super(context);
  }

  get targetName(): string {
    return 'agents';
  }

  async compile(): Promise<CompilationResult> {
    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];

    // Get agents config
    const agentsConfig = this.context.config.compile?.agents;
    const maxTokens = agentsConfig?.max_tokens || 8000;

    // Load project.md (required)
    const projectContent = await this.loadProjectContent();
    if (!projectContent) {
      errors.push({
        type: 'missing_file',
        message: 'project.md is required for Agents compilation but was not found',
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

    // Calculate token usage for required content
    let usedTokens = 0;
    usedTokens += estimateTokens(projectContent).tokens;
    if (architectureContent) {
      usedTokens += estimateTokens(architectureContent).tokens;
    }

    // Reserve tokens for meta-rule
    const metaRule = this.generateMetaRule();
    usedTokens += estimateTokens(metaRule).tokens;

    // Calculate remaining budget for rules
    const effectiveBudget = applyBudgetMargin(maxTokens);
    const rulesBudget = Math.max(0, effectiveBudget - usedTokens);

    // For agents, we use summaries instead of full content
    const allRules = sortByPriority(this.context.rules);
    const selectedRules: ParsedRule[] = [];
    let ruleTokens = 0;

    for (const rule of allRules) {
      const summary = this.getRuleSummary(rule);
      const summaryTokens = estimateTokens(summary).tokens;

      if (ruleTokens + summaryTokens <= rulesBudget) {
        selectedRules.push(rule);
        ruleTokens += summaryTokens;
      } else {
        warnings.push({
          type: 'token_limit',
          message: `Rule ${rule.frontmatter.id} excluded due to token budget`,
        });
      }
    }

    if (selectedRules.length === 0 && this.context.rules.length > 0) {
      warnings.push({
        type: 'empty_rules',
        message: 'No rules included in AGENTS.md due to token budget constraints',
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
      path: 'AGENTS.md',
      content,
      tokens: totalTokens,
    };

    // Write output
    try {
      this.writeOutput(output.path, output.content);
    } catch (error) {
      errors.push({
        type: 'write_error',
        message: `Failed to write AGENTS.md: ${(error as Error).message}`,
        path: 'AGENTS.md',
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
   * Build the complete AGENTS.md content
   */
  private buildOutput(
    projectContent: string,
    architectureContent: string | undefined,
    rules: ParsedRule[],
    metaRule: string
  ): string {
    const sections: string[] = [];

    // Header
    sections.push('# Agent Context\n');
    sections.push('This document provides context for AI agents working with this project.\n');

    // Full project content
    sections.push('## Project Overview\n');
    sections.push(projectContent.trim());
    sections.push('');

    // Full architecture content
    if (architectureContent) {
      sections.push('## Architecture\n');
      sections.push(architectureContent.trim());
      sections.push('');
    }

    // Rule summaries
    if (rules.length > 0) {
      sections.push('## Rules and Guidelines\n');

      for (const rule of rules) {
        sections.push(`### ${rule.frontmatter.id}\n`);

        // Include description
        if (rule.frontmatter.description) {
          sections.push(`**Description:** ${rule.frontmatter.description}\n`);
        }

        // Include tags if present
        if (rule.frontmatter.tags && rule.frontmatter.tags.length > 0) {
          sections.push(`**Tags:** ${rule.frontmatter.tags.join(', ')}\n`);
        }

        // Include domain if present
        if (rule.frontmatter.domain) {
          sections.push(`**Domain:** ${rule.frontmatter.domain}\n`);
        }

        // Include summary (first paragraph)
        const firstParagraph = rule.content.split('\n\n')[0];
        if (firstParagraph) {
          sections.push(firstParagraph.trim());
        }

        sections.push('');
      }
    }

    // Directory index for navigation
    sections.push(this.generateDirectoryIndex(rules));

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
