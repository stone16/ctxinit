/**
 * CLI Entry Point
 *
 * Unified `ctx` command for context architecture management.
 * Supports init, build, lint, diff, verify, and migrate subcommands.
 */

import { Command } from 'commander';
import { runInit } from './cli/init';
import { runBuild } from './cli/build';
import { runLint } from './cli/lint';
import { runVerify } from './cli/verify';
import { runDiff } from './cli/diff';
import { runMigrate } from './cli/migrate';
import { runHooks } from './cli/hooks';
import { runEnhancedBootstrap } from './bootstrap';
import { listProviderTypes, LLMProviderType } from './llm';

const program = new Command();

program
  .name('ctx')
  .description('Unified context architecture for AI coding assistants')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize .context directory in your project')
  .option('-f, --force', 'Overwrite existing .context directory (creates backup)')
  .option('--no-interactive', 'Run without prompts (use defaults)')
  .option('--wizard', 'Launch guided migration wizard')
  .option('--dry-run', 'Show what would happen without making changes')
  .option('--no-bootstrap', 'Skip LLM bootstrap (only create templates)')
  .action(async (options) => {
    try {
      const exitCode = await runInit({
        force: options.force,
        interactive: options.interactive,
        wizard: options.wizard,
        dryRun: options.dryRun,
        bootstrap: options.bootstrap,
      });
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Build command
program
  .command('build')
  .description('Compile rules into target formats')
  .option('-i, --incremental', 'Only rebuild changed files')
  .option('--check', 'Check whether compiled outputs are up to date (no writes)')
  .option('-v, --verbose', 'Show detailed output')
  .option('-q, --quiet', 'Suppress output except errors')
  .option('--skip-validation', 'Skip validation step')
  .option('--force', 'Force full rebuild')
  .option('-t, --target <targets...>', 'Specific targets to build (claude, cursor, agents)')
  .action(async (options) => {
    try {
      const exitCode = await runBuild({
        incremental: options.incremental,
        check: options.check,
        verbose: options.verbose,
        quiet: options.quiet,
        skipValidation: options.skipValidation,
        force: options.force,
        target: options.target,
      });
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Lint command
program
  .command('lint [files...]')
  .description('Validate rules without building')
  .option('--json', 'Output in JSON format')
  .option('-v, --verbose', 'Show detailed output')
  .option('-q, --quiet', 'Suppress output except errors')
  .action(async (files, options) => {
    try {
      const exitCode = await runLint({
        json: options.json,
        verbose: options.verbose,
        quiet: options.quiet,
        files: files.length > 0 ? files : undefined,
      });
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Verify command
program
  .command('verify')
  .description('Verify checksums of compiled outputs')
  .option('-v, --verbose', 'Show detailed output')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const exitCode = await runVerify({
        verbose: options.verbose,
        json: options.json,
      });
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Diff command
program
  .command('diff')
  .description('Compare compiled outputs with legacy files')
  .option('--legacy', 'Compare with legacy context files')
  .option('--unified', 'Show unified diff format')
  .option('-v, --verbose', 'Show detailed diff output')
  .action(async (options) => {
    try {
      const exitCode = await runDiff({
        legacy: options.legacy,
        unified: options.unified,
        verbose: options.verbose,
      });
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Migrate command
program
  .command('migrate')
  .description('Manage migration from legacy context files')
  .option('--analyze', 'Analyze existing legacy files')
  .option('--attach', 'Create .context alongside legacy files')
  .option('--complete', 'Remove legacy files after migration')
  .option('-f, --force', 'Skip confirmation prompts')
  .option('--dry-run', 'Show what would happen without making changes')
  .action(async (options) => {
    try {
      const exitCode = await runMigrate({
        analyze: options.analyze,
        attach: options.attach,
        complete: options.complete,
        force: options.force,
        dryRun: options.dryRun,
      });
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Hooks command
program
  .command('hooks')
  .description('Manage git hooks integration')
  .option('--install', 'Install hooks without prompts')
  .option('--remove', 'Remove ctx git hooks')
  .option('--skip-husky', 'Skip Husky installation')
  .option('--skip-gitignore', 'Skip .gitignore updates')
  .option('-f, --force', 'Force overwrite existing hooks')
  .option('--dry-run', 'Show what would happen without making changes')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      const exitCode = await runHooks({
        install: options.install,
        remove: options.remove,
        skipHusky: options.skipHusky,
        skipGitignore: options.skipGitignore,
        force: options.force,
        dryRun: options.dryRun,
        verbose: options.verbose,
      });
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Bootstrap command (enhanced LLM-powered context generation)
program
  .command('bootstrap')
  .description('Generate context files using LLM analysis')
  .option('-p, --provider <type>', 'LLM provider to use (auto-detect if not specified)')
  .option('--analyze-only', 'Only analyze codebase, skip LLM invocation')
  .option('--skip-validation', 'Skip output validation')
  .option('--auto-build', 'Automatically run build after bootstrap')
  .option('-v, --verbose', 'Show detailed output including prompts')
  .option('--dry-run', 'Show what would be generated without writing files')
  .option('--list-providers', 'List available LLM providers')
  .action(async (options) => {
    try {
      // List providers if requested
      if (options.listProviders) {
        console.log('\nAvailable LLM providers:\n');
        for (const provider of listProviderTypes()) {
          console.log(`  ${provider.type.padEnd(15)} ${provider.description}`);
        }
        console.log('\nUse --provider <type> to specify a provider.');
        console.log('If not specified, the best available provider will be auto-selected.\n');
        process.exit(0);
      }

      const result = await runEnhancedBootstrap(process.cwd(), {
        provider: options.provider as LLMProviderType | undefined,
        analyzeOnly: options.analyzeOnly,
        skipValidation: options.skipValidation,
        autoBuild: options.autoBuild,
        verbose: options.verbose,
        dryRun: options.dryRun,
      });

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(2);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error('Unknown command: %s', program.args.join(' '));
  console.log('Run `ctx --help` for available commands.');
  process.exit(1);
});

export function run(): void {
  program.parse();
}
