/**
 * Build Command
 *
 * Compile rules to target formats with:
 * - Full or incremental builds
 * - Static analysis validation
 * - Progress and statistics output
 */

import * as path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../config/loader';
import { BuildOrchestrator, formatBuildResult, BuildOptions } from '../build/orchestrator';
import { BUILD_TARGETS, BuildTarget } from '../schemas/config';

/**
 * Build command options
 */
export interface BuildCommandOptions {
  /** Only rebuild changed files */
  incremental?: boolean;
  /** Check whether outputs are up to date (no writes) */
  check?: boolean;
  /** Show detailed output */
  verbose?: boolean;
  /** Suppress output except errors */
  quiet?: boolean;
  /** Skip validation step */
  skipValidation?: boolean;
  /** Force full rebuild */
  force?: boolean;
  /** Specific targets to build */
  target?: string[];
}

/**
 * Parse and validate target arguments
 */
function parseTargets(targets?: string[]): BuildTarget[] {
  if (!targets || targets.length === 0) {
    return [];
  }

  const validTargets: BuildTarget[] = [];
  const invalidTargets: string[] = [];

  for (const target of targets) {
    if (BUILD_TARGETS.includes(target as BuildTarget)) {
      validTargets.push(target as BuildTarget);
    } else {
      invalidTargets.push(target);
    }
  }

  if (invalidTargets.length > 0) {
    throw new Error(
      `Invalid target(s): ${invalidTargets.join(', ')}. Valid targets: ${BUILD_TARGETS.join(', ')}`
    );
  }

  return validTargets;
}

/**
 * Run the build command
 */
export async function runBuild(options: BuildCommandOptions): Promise<number> {
  const projectRoot = process.cwd();

  // Check if .context exists
  const contextDir = path.join(projectRoot, '.context');
  const fs = await import('fs');
  if (!fs.existsSync(contextDir)) {
    console.log(chalk.red('\n❌ Error: .context directory not found.'));
    console.log(chalk.gray('   Run `ctx init` first to initialize your project.'));
    return 2;
  }

  // Load configuration
  if (!options.quiet) {
    console.log(chalk.blue('\n🔨 Building context rules...\n'));
  }

  let config;
  try {
    const loadResult = loadConfig(projectRoot);
    config = loadResult.config;

    // Show warnings from config loading
    if (!options.quiet && loadResult.warnings.length > 0) {
      for (const warning of loadResult.warnings) {
        console.log(chalk.yellow(`⚠️  ${warning}`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Configuration error: ${(error as Error).message}`));
    return 2;
  }

  // Parse targets
  let targets: BuildTarget[];
  try {
    targets = parseTargets(options.target);
  } catch (error) {
    console.log(chalk.red(`\n❌ ${(error as Error).message}`));
    return 2;
  }

  // Create orchestrator
  const orchestrator = new BuildOrchestrator(projectRoot, config, {
    quiet: options.quiet,
    verbose: options.verbose,
  });

  // Build options
  const buildOptions: BuildOptions = {
    projectRoot,
    targets: targets.length > 0 ? targets : undefined,
    force: options.force || !options.incremental,
    check: options.check,
    skipValidation: options.skipValidation,
    verbose: options.verbose,
    quiet: options.quiet,
  };

  // Execute build
  const result = await orchestrator.build(buildOptions);

  // Output results
  if (!options.quiet) {
    console.log('');
    console.log(formatBuildResult(result));
  } else if (!result.success) {
    // Even in quiet mode, show errors
    console.log(chalk.red('\n❌ Build failed'));
    for (const error of result.errors) {
      console.log(chalk.red(`   ${error}`));
    }
  }

  // Return appropriate exit code
  if (!result.success) {
    // Check if it's a validation error (exit code 1) or runtime error (exit code 2)
    const hasValidationError = result.errors.some(
      e =>
        e.includes('Validation') ||
        e.includes('duplicate') ||
        e.includes('Parse error') ||
        e.startsWith('[check]')
    );
    return hasValidationError ? 1 : 2;
  }

  return 0;
}
