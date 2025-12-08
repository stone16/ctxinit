/**
 * Hooks Command
 *
 * CLI command for managing git hooks integration.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { HuskyManager } from '../git/husky';
import { GitignoreManager } from '../git/gitignore';
import { generatePreCommitHook } from '../git/hooks';

/**
 * Hooks command options
 */
export interface HooksCommandOptions {
  /** Install hooks without prompts */
  install?: boolean;
  /** Remove hooks */
  remove?: boolean;
  /** Skip Husky installation */
  skipHusky?: boolean;
  /** Skip gitignore updates */
  skipGitignore?: boolean;
  /** Force overwrite existing hooks */
  force?: boolean;
  /** Dry run - show what would happen */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Run the hooks command
 */
export async function runHooks(options: HooksCommandOptions): Promise<number> {
  const projectRoot = process.cwd();
  const huskyManager = new HuskyManager(projectRoot);
  const gitignoreManager = new GitignoreManager(projectRoot);

  // Handle remove mode
  if (options.remove) {
    return removeHooks(huskyManager, gitignoreManager, options);
  }

  // Handle install mode (default)
  return installHooks(huskyManager, gitignoreManager, options);
}

/**
 * Install hooks
 */
async function installHooks(
  huskyManager: HuskyManager,
  gitignoreManager: GitignoreManager,
  options: HooksCommandOptions
): Promise<number> {
  console.log(chalk.blue('\n🔗 Setting up git hooks...\n'));

  // Check Husky status
  const status = await huskyManager.checkStatus();

  if (options.verbose) {
    console.log(chalk.gray('Husky status:'));
    console.log(chalk.gray(`  Installed: ${status.installed}`));
    console.log(chalk.gray(`  Initialized: ${status.initialized}`));
    console.log(chalk.gray(`  Has pre-commit: ${status.hasPreCommitHook}`));
    console.log(chalk.gray(`  Has ctx hook: ${status.hasCtxHook}`));
    console.log('');
  }

  // If ctx hook already exists
  if (status.hasCtxHook && !options.force) {
    console.log(chalk.green('✅ ctx pre-commit hook is already configured.'));
    return 0;
  }

  // Install Husky if needed
  if (!options.skipHusky && !status.installed) {
    if (options.dryRun) {
      console.log(chalk.cyan('Would install Husky as dev dependency'));
    } else {
      // Ask for confirmation unless --install flag is set
      if (!options.install) {
        const { confirmInstall } = await inquirer.prompt<{ confirmInstall: boolean }>([
          {
            type: 'confirm',
            name: 'confirmInstall',
            message: 'Husky is not installed. Install it now?',
            default: true,
          },
        ]);

        if (!confirmInstall) {
          console.log(chalk.yellow('⚠️  Skipping Husky installation.'));
          console.log(chalk.gray('   You can set up the hook manually in .git/hooks/pre-commit'));
          return 0;
        }
      }

      console.log(chalk.gray('Installing Husky...'));
      const installed = await huskyManager.install();
      if (!installed) {
        console.log(chalk.red('❌ Failed to install Husky.'));
        return 2;
      }
      console.log(chalk.green('✅ Husky installed'));
    }
  }

  // Initialize Husky if needed
  if (!options.skipHusky && !status.initialized) {
    if (options.dryRun) {
      console.log(chalk.cyan('Would initialize Husky (.husky directory)'));
    } else {
      console.log(chalk.gray('Initializing Husky...'));
      const initialized = await huskyManager.initialize();
      if (!initialized) {
        console.log(chalk.red('❌ Failed to initialize Husky.'));
        return 2;
      }
      console.log(chalk.green('✅ Husky initialized'));
    }
  }

  // Generate and add pre-commit hook
  const hookContent = generatePreCommitHook({
    incremental: true,
    autoStage: true,
    verbose: options.verbose,
  });

  if (options.dryRun) {
    console.log(chalk.cyan('\nWould create pre-commit hook:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray(hookContent));
    console.log(chalk.gray('─'.repeat(40)));
  } else {
    const added = await huskyManager.addPreCommitHook(hookContent);
    if (!added) {
      console.log(chalk.red('❌ Failed to add pre-commit hook.'));
      return 2;
    }
    console.log(chalk.green('✅ Pre-commit hook configured'));
  }

  // Update .gitignore
  if (!options.skipGitignore) {
    if (options.dryRun) {
      const missing = await gitignoreManager.getMissingEntries();
      if (missing.length > 0) {
        console.log(chalk.cyan('\nWould add to .gitignore:'));
        for (const entry of missing) {
          console.log(chalk.gray(`  ${entry}`));
        }
      }
    } else {
      const { added } = await gitignoreManager.addCtxEntries();
      if (added.length > 0) {
        console.log(chalk.green('✅ Updated .gitignore'));
        if (options.verbose) {
          for (const entry of added) {
            console.log(chalk.gray(`   + ${entry}`));
          }
        }
      }
    }
  }

  console.log(chalk.green('\n✅ Git hooks setup complete!\n'));
  console.log(chalk.gray('The pre-commit hook will:'));
  console.log(chalk.gray('  1. Run `ctx build --incremental` before each commit'));
  console.log(chalk.gray('  2. Auto-stage compiled outputs (CLAUDE.md, AGENTS.md, .cursor/rules/)'));
  console.log(chalk.gray('  3. Block commits if validation errors are found'));

  return 0;
}

/**
 * Remove hooks
 */
async function removeHooks(
  huskyManager: HuskyManager,
  gitignoreManager: GitignoreManager,
  options: HooksCommandOptions
): Promise<number> {
  console.log(chalk.blue('\n🔗 Removing ctx git hooks...\n'));

  if (options.dryRun) {
    console.log(chalk.cyan('Would remove ctx pre-commit hook'));
    console.log(chalk.cyan('Would remove ctx entries from .gitignore'));
  } else {
    // Remove ctx hook
    const removed = await huskyManager.removeCtxHook();
    if (removed) {
      console.log(chalk.green('✅ Removed ctx pre-commit hook'));
    }

    // Remove gitignore entries
    const removedEntries = await gitignoreManager.removeCtxEntries();
    if (removedEntries.length > 0) {
      console.log(chalk.green('✅ Removed ctx entries from .gitignore'));
      if (options.verbose) {
        for (const entry of removedEntries) {
          console.log(chalk.gray(`   - ${entry}`));
        }
      }
    }
  }

  console.log(chalk.green('\n✅ Git hooks removed.'));
  return 0;
}
