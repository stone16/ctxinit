/**
 * Lint Command
 *
 * Validate rules without building:
 * - Run static analysis
 * - Output errors and warnings
 * - Support JSON output format
 * - Support file path targeting
 */

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { loadConfig } from '../config/loader';
import { parseAllRules, ParseOptions } from '../parser/rule-parser';
import { analyzeRules, AnalysisOptions, AnalysisResult } from '../analysis/static-analysis';

/**
 * Lint command options
 */
export interface LintCommandOptions {
  /** Output in JSON format */
  json?: boolean;
  /** Specific files to lint */
  files?: string[];
  /** Show detailed output */
  verbose?: boolean;
  /** Suppress output except errors */
  quiet?: boolean;
}

/**
 * JSON output format
 */
export interface LintJsonOutput {
  success: boolean;
  rulesLinted: number;
  errors: Array<{
    type: string;
    message: string;
    path: string;
    line?: number;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    path: string;
    line?: number;
  }>;
}

/**
 * Run the lint command
 */
export async function runLint(options: LintCommandOptions): Promise<number> {
  const projectRoot = process.cwd();

  // Check if .context exists
  const contextDir = path.join(projectRoot, '.context');
  if (!fs.existsSync(contextDir)) {
    if (options.json) {
      const output: LintJsonOutput = {
        success: false,
        rulesLinted: 0,
        errors: [{
          type: 'INIT_ERROR',
          message: '.context directory not found. Run `ctx init` first.',
          path: projectRoot,
        }],
        warnings: [],
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(chalk.red('\n❌ Error: .context directory not found.'));
      console.log(chalk.gray('   Run `ctx init` first to initialize your project.'));
    }
    return 2;
  }

  // Load configuration
  let config;
  try {
    const loadResult = loadConfig(projectRoot);
    config = loadResult.config;
  } catch (error) {
    if (options.json) {
      const output: LintJsonOutput = {
        success: false,
        rulesLinted: 0,
        errors: [{
          type: 'CONFIG_ERROR',
          message: (error as Error).message,
          path: path.join(contextDir, 'config.yaml'),
        }],
        warnings: [],
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(chalk.red(`\n❌ Configuration error: ${(error as Error).message}`));
    }
    return 2;
  }

  // Parse rules
  if (!options.quiet && !options.json) {
    console.log(chalk.blue('\n🔍 Linting context rules...\n'));
  }

  const parseOptions: ParseOptions = {
    projectRoot,
    rulesDir: path.join(contextDir, 'rules'),
  };

  const { rules, errors: parseErrors } = parseAllRules(parseOptions);

  // Filter to specific files if provided
  let rulesToLint = rules;
  if (options.files && options.files.length > 0) {
    const targetPaths = options.files.map(f => path.resolve(projectRoot, f));
    rulesToLint = rules.filter(r => targetPaths.includes(r.absolutePath));
  }

  // Collect all issues
  const allErrors: Array<{ type: string; message: string; path: string; line?: number }> = [];
  const allWarnings: Array<{ type: string; message: string; path: string; line?: number }> = [];

  // Add parse errors
  for (const err of parseErrors) {
    allErrors.push({
      type: 'PARSE_ERROR',
      message: err.message,
      path: err.path,
      line: err.line,
    });
  }

  // Run static analysis
  if (parseErrors.length === 0 && rulesToLint.length > 0) {
    const analysisOptions: AnalysisOptions = {
      projectRoot,
      config,
    };

    const analysisResult: AnalysisResult = analyzeRules(rulesToLint, analysisOptions);

    // Add analysis errors
    for (const err of analysisResult.errors) {
      allErrors.push({
        type: err.type,
        message: err.message,
        path: err.path,
        line: err.line,
      });
    }

    // Add analysis warnings
    for (const warn of analysisResult.warnings) {
      allWarnings.push({
        type: warn.type,
        message: warn.message,
        path: warn.path,
      });
    }
  }

  // Output results
  const success = allErrors.length === 0;

  if (options.json) {
    const output: LintJsonOutput = {
      success,
      rulesLinted: rulesToLint.length,
      errors: allErrors,
      warnings: allWarnings,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Human-readable output
    if (!options.quiet) {
      console.log(chalk.gray(`Linted ${rulesToLint.length} rule(s)\n`));
    }

    if (allErrors.length > 0) {
      console.log(chalk.red('Errors:'));
      for (const err of allErrors) {
        const location = err.line ? `${err.path}:${err.line}` : err.path;
        console.log(chalk.red(`  ❌ [${err.type}] ${err.message}`));
        console.log(chalk.gray(`     ${location}`));
      }
      console.log('');
    }

    if (allWarnings.length > 0) {
      console.log(chalk.yellow('Warnings:'));
      for (const warn of allWarnings) {
        const location = warn.line ? `${warn.path}:${warn.line}` : warn.path;
        console.log(chalk.yellow(`  ⚠️  [${warn.type}] ${warn.message}`));
        console.log(chalk.gray(`     ${location}`));
      }
      console.log('');
    }

    if (success) {
      if (!options.quiet) {
        if (allWarnings.length > 0) {
          console.log(chalk.yellow(`✅ Lint passed with ${allWarnings.length} warning(s)`));
        } else {
          console.log(chalk.green('✅ Lint passed - no issues found'));
        }
      }
    } else {
      console.log(chalk.red(`❌ Lint failed - ${allErrors.length} error(s) found`));
    }
  }

  // Return appropriate exit code
  return success ? 0 : 1;
}
