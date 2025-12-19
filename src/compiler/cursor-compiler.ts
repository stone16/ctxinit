/**
 * Cursor IDE Compiler
 *
 * Compiles rules to individual .mdc files in .cursor/rules/
 * Each rule becomes a separate file with Cursor-compatible frontmatter.
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
import { estimateTokens } from './token-estimator';
import { selectRules, SelectionContext } from './rule-selector';

/**
 * Cursor .mdc frontmatter format
 */
interface MdcFrontmatter {
  description: string;
  globs: string[];
  alwaysApply: boolean;
}

/**
 * Cursor compiler implementation
 */
export class CursorCompiler extends BaseCompiler {
  constructor(context: CompilerContext) {
    super(context);
  }

  get targetName(): string {
    return 'cursor';
  }

  async compile(): Promise<CompilationResult> {
    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];
    const outputs: OutputFile[] = [];

    // Get cursor config
    const cursorConfig = this.context.config.compile?.cursor;
    const strategy = cursorConfig?.strategy || 'all';

    // Select rules based on strategy
    const selectionContext: SelectionContext = {
      projectRoot: this.context.projectRoot,
    };

    const selection = selectRules(
      this.context.rules,
      { strategy },
      selectionContext
    );

    if (selection.rules.length === 0) {
      warnings.push({
        type: 'empty_rules',
        message: 'No rules selected for Cursor compilation',
      });
    }

    const shouldWriteToDisk = this.context.writeToDisk !== false;
    if (shouldWriteToDisk) {
      // Ensure output directory exists
      this.ensureDirectory('.cursor/rules');
    }

    // Compile each rule to a separate .mdc file
    let totalTokens = 0;

    for (const rule of selection.rules) {
      try {
        const output = this.compileRule(rule);
        outputs.push(output);
        totalTokens += output.tokens;

        // Write output file (optional)
        if (shouldWriteToDisk) {
          this.writeOutput(output.path, output.content);
        }
      } catch (error) {
        errors.push({
          type: 'write_error',
          message: `Failed to compile rule ${rule.frontmatter.id}: ${(error as Error).message}`,
          path: rule.path,
        });
      }
    }

    return {
      success: errors.length === 0,
      outputs,
      errors,
      warnings,
      totalTokens,
      stats: {
        rulesProcessed: this.context.rules.length,
        rulesIncluded: selection.rules.length,
        outputFiles: outputs.length,
        totalTokens,
      },
    };
  }

  /**
   * Compile a single rule to .mdc format
   */
  private compileRule(rule: ParsedRule): OutputFile {
    const fileName = this.generateFileName(rule);
    const filePath = `.cursor/rules/${fileName}`;

    const frontmatter = this.generateFrontmatter(rule);
    const content = this.formatMdcFile(frontmatter, rule.content);

    const tokens = estimateTokens(content).tokens;

    return {
      path: filePath,
      content,
      tokens,
    };
  }

  /**
   * Generate output file name from rule path
   * Rules at backend/auth.md become backend-auth.mdc
   */
  private generateFileName(rule: ParsedRule): string {
    // Remove .md extension
    const baseName = rule.path.replace(/\.md$/, '');

    // Replace path separators with dashes
    const flatName = baseName.replace(/[/\\]/g, '-');

    // Sanitize: remove special characters, keep alphanumeric, dash, underscore
    const sanitized = flatName.replace(/[^a-zA-Z0-9_-]/g, '_');

    return `${sanitized}.mdc`;
  }

  /**
   * Generate Cursor-compatible frontmatter
   */
  private generateFrontmatter(rule: ParsedRule): MdcFrontmatter {
    return {
      description: rule.frontmatter.description || rule.frontmatter.id,
      globs: rule.effectiveGlobs,
      alwaysApply: rule.frontmatter.always_apply || false,
    };
  }

  /**
   * Format complete .mdc file with frontmatter and content
   */
  private formatMdcFile(frontmatter: MdcFrontmatter, content: string): string {
    const yamlFrontmatter = [
      '---',
      `description: ${JSON.stringify(frontmatter.description)}`,
      `globs:`,
      ...frontmatter.globs.map(g => `  - ${JSON.stringify(g)}`),
      `alwaysApply: ${frontmatter.alwaysApply}`,
      '---',
    ].join('\n');

    const bodyContent = `${yamlFrontmatter}\n\n${content}\n`;

    // Add checksum and timestamp metadata
    return this.addMetadata(bodyContent);
  }
}
