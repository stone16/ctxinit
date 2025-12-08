/**
 * Migrate Command
 *
 * Migration operations for legacy context files:
 * - Analyze: Detect and report legacy files
 * - Attach: Create .context alongside legacy files
 * - Complete: Remove legacy files after confirmation
 */

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { contextExists, initializeContext, AgentSelection } from './init';

/**
 * Migrate command options
 */
export interface MigrateCommandOptions {
  /** Analyze mode - detect and report */
  analyze?: boolean;
  /** Attach mode - create alongside */
  attach?: boolean;
  /** Complete mode - remove legacy */
  complete?: boolean;
  /** Skip confirmation prompts */
  force?: boolean;
  /** Dry run - show what would happen */
  dryRun?: boolean;
}

/**
 * Legacy file analysis result
 */
interface LegacyAnalysis {
  cursorrules: { exists: boolean; size: number; lines: number };
  claudeMd: { exists: boolean; size: number; lines: number };
  agentsMd: { exists: boolean; size: number; lines: number };
}

/**
 * Analyze legacy files
 */
async function analyzeLegacyFiles(projectRoot: string): Promise<LegacyAnalysis> {
  const result: LegacyAnalysis = {
    cursorrules: { exists: false, size: 0, lines: 0 },
    claudeMd: { exists: false, size: 0, lines: 0 },
    agentsMd: { exists: false, size: 0, lines: 0 },
  };

  const files: Array<{ key: keyof LegacyAnalysis; path: string }> = [
    { key: 'cursorrules', path: path.join(projectRoot, '.cursorrules') },
    { key: 'claudeMd', path: path.join(projectRoot, 'CLAUDE.md') },
    { key: 'agentsMd', path: path.join(projectRoot, 'AGENTS.md') },
  ];

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      const stats = await fs.promises.stat(file.path);
      const content = await fs.promises.readFile(file.path, 'utf-8');
      result[file.key] = {
        exists: true,
        size: stats.size,
        lines: content.split('\n').length,
      };
    }
  }

  return result;
}

/**
 * Run analyze mode
 */
async function runAnalyze(projectRoot: string): Promise<number> {
  console.log(chalk.blue('\n📊 Analyzing legacy context files...\n'));

  const analysis = await analyzeLegacyFiles(projectRoot);
  const hasLegacy = analysis.cursorrules.exists || analysis.claudeMd.exists || analysis.agentsMd.exists;

  if (!hasLegacy) {
    console.log(chalk.green('✅ No legacy context files found.'));
    console.log(chalk.gray('   Your project is ready for fresh initialization with `ctx init`.'));
    return 0;
  }

  console.log(chalk.yellow('Found legacy context files:\n'));

  if (analysis.cursorrules.exists) {
    console.log(chalk.bold('  .cursorrules'));
    console.log(chalk.gray(`    Size: ${(analysis.cursorrules.size / 1024).toFixed(1)} KB`));
    console.log(chalk.gray(`    Lines: ${analysis.cursorrules.lines}`));
  }

  if (analysis.claudeMd.exists) {
    console.log(chalk.bold('  CLAUDE.md'));
    console.log(chalk.gray(`    Size: ${(analysis.claudeMd.size / 1024).toFixed(1)} KB`));
    console.log(chalk.gray(`    Lines: ${analysis.claudeMd.lines}`));
  }

  if (analysis.agentsMd.exists) {
    console.log(chalk.bold('  AGENTS.md'));
    console.log(chalk.gray(`    Size: ${(analysis.agentsMd.size / 1024).toFixed(1)} KB`));
    console.log(chalk.gray(`    Lines: ${analysis.agentsMd.lines}`));
  }

  console.log('');

  // Recommend strategy based on file sizes
  const totalSize = analysis.cursorrules.size + analysis.claudeMd.size + analysis.agentsMd.size;
  if (totalSize > 50 * 1024) {
    console.log(chalk.yellow('📋 Recommendation: Attach Mode'));
    console.log(chalk.gray('   Your legacy files are substantial. Consider using attach mode'));
    console.log(chalk.gray('   to run .context alongside existing files during transition.'));
    console.log(chalk.gray('   Run: ctx migrate --attach'));
  } else {
    console.log(chalk.green('📋 Recommendation: Direct Migration'));
    console.log(chalk.gray('   Your legacy files are relatively small. You can likely'));
    console.log(chalk.gray('   migrate directly to .context-based rules.'));
    console.log(chalk.gray('   Run: ctx init --wizard'));
  }

  return 0;
}

/**
 * Run attach mode
 */
async function runAttach(projectRoot: string, options: MigrateCommandOptions): Promise<number> {
  console.log(chalk.blue('\n🔗 Running attach mode migration...\n'));

  const analysis = await analyzeLegacyFiles(projectRoot);
  const hasLegacy = analysis.cursorrules.exists || analysis.claudeMd.exists || analysis.agentsMd.exists;

  if (!hasLegacy) {
    console.log(chalk.yellow('⚠️  No legacy files found to attach to.'));
    console.log(chalk.gray('   Run `ctx init` for fresh initialization instead.'));
    return 1;
  }

  // Check if .context already exists
  if (contextExists(projectRoot) && !options.force) {
    console.log(chalk.yellow('⚠️  .context directory already exists.'));
    console.log(chalk.gray('   Use --force to overwrite or run `ctx migrate --complete` first.'));
    return 1;
  }

  // Determine agent selection from existing files
  let agents: AgentSelection = 'all';
  if (analysis.claudeMd.exists && !analysis.cursorrules.exists) {
    agents = 'claude';
  } else if (analysis.cursorrules.exists && !analysis.claudeMd.exists) {
    agents = 'cursor';
  }

  if (options.dryRun) {
    console.log(chalk.cyan('📋 Dry run - would perform the following:'));
    console.log(chalk.gray('   1. Create .context directory structure'));
    console.log(chalk.gray('   2. Generate template files'));
    console.log(chalk.gray(`   3. Configure for ${agents} agent(s)`));
    console.log(chalk.gray('   4. Set migration.mode = "attach" in config.yaml'));
    console.log(chalk.gray('   5. Import legacy content as .context/rules/legacy.md'));
    return 0;
  }

  // Initialize .context
  const { created } = await initializeContext(projectRoot, agents);

  console.log(chalk.green('\n✅ Created .context directory structure'));
  for (const file of created) {
    console.log(chalk.gray(`   ${path.relative(projectRoot, file)}`));
  }

  // Create legacy.md rule from existing files
  const legacyRulePath = path.join(projectRoot, '.context', 'rules', 'legacy.md');
  let legacyContent = `---
id: legacy-rules
description: Imported legacy context rules
priority: 100
tags: [legacy, migration]
---

# Legacy Context Rules

This file contains rules imported from your legacy context files.
Review and organize these rules into appropriate files, then remove this file.

`;

  if (analysis.claudeMd.exists) {
    const content = await fs.promises.readFile(path.join(projectRoot, 'CLAUDE.md'), 'utf-8');
    legacyContent += `## From CLAUDE.md\n\n${content}\n\n`;
  }

  if (analysis.cursorrules.exists) {
    const content = await fs.promises.readFile(path.join(projectRoot, '.cursorrules'), 'utf-8');
    legacyContent += `## From .cursorrules\n\n${content}\n\n`;
  }

  if (analysis.agentsMd.exists) {
    const content = await fs.promises.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf-8');
    legacyContent += `## From AGENTS.md\n\n${content}\n\n`;
  }

  await fs.promises.writeFile(legacyRulePath, legacyContent, 'utf-8');
  console.log(chalk.green(`\n✅ Imported legacy rules to .context/rules/legacy.md`));

  // Backup legacy files with .legacy extension so diff command can compare them
  // This preserves the original files for comparison after ctx build overwrites them
  if (analysis.claudeMd.exists) {
    const src = path.join(projectRoot, 'CLAUDE.md');
    const dst = path.join(projectRoot, 'CLAUDE.md.legacy');
    await fs.promises.copyFile(src, dst);
    console.log(chalk.green('✅ Backed up CLAUDE.md → CLAUDE.md.legacy'));
  }

  if (analysis.agentsMd.exists) {
    const src = path.join(projectRoot, 'AGENTS.md');
    const dst = path.join(projectRoot, 'AGENTS.md.legacy');
    await fs.promises.copyFile(src, dst);
    console.log(chalk.green('✅ Backed up AGENTS.md → AGENTS.md.legacy'));
  }

  // Update config.yaml with migration mode
  const configPath = path.join(projectRoot, '.context', 'config.yaml');
  let configContent = await fs.promises.readFile(configPath, 'utf-8');
  configContent += `
# Migration configuration
migration:
  mode: attach
  preserve_legacy: true
  legacy_files:
`;
  if (analysis.claudeMd.exists) configContent += '    - CLAUDE.md\n';
  if (analysis.cursorrules.exists) configContent += '    - .cursorrules\n';
  if (analysis.agentsMd.exists) configContent += '    - AGENTS.md\n';

  await fs.promises.writeFile(configPath, configContent, 'utf-8');
  console.log(chalk.green('✅ Updated config.yaml with migration settings'));

  console.log(chalk.blue('\n📝 Next steps:'));
  console.log(chalk.gray('   1. Review and organize .context/rules/legacy.md'));
  console.log(chalk.gray('   2. Run `ctx build` to generate outputs'));
  console.log(chalk.gray('   3. Compare with `ctx diff --legacy`'));
  console.log(chalk.gray('   4. Complete migration with `ctx migrate --complete`'));

  return 0;
}

/**
 * Run complete mode
 */
async function runComplete(projectRoot: string, options: MigrateCommandOptions): Promise<number> {
  console.log(chalk.blue('\n🏁 Completing migration...\n'));

  const analysis = await analyzeLegacyFiles(projectRoot);
  const hasLegacy = analysis.cursorrules.exists || analysis.claudeMd.exists || analysis.agentsMd.exists;

  if (!hasLegacy) {
    console.log(chalk.green('✅ No legacy files to remove.'));
    return 0;
  }

  // Check if .context exists
  if (!contextExists(projectRoot)) {
    console.log(chalk.yellow('⚠️  .context directory not found.'));
    console.log(chalk.gray('   Run `ctx init` or `ctx migrate --attach` first.'));
    return 1;
  }

  // List files to remove (both original and .legacy backups)
  const filesToRemove: string[] = [];
  if (analysis.cursorrules.exists) filesToRemove.push('.cursorrules');
  // Note: CLAUDE.md and AGENTS.md are now generated by ctx build
  // We only need to remove the .legacy backups created during attach
  if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md.legacy'))) {
    filesToRemove.push('CLAUDE.md.legacy');
  }
  if (fs.existsSync(path.join(projectRoot, 'AGENTS.md.legacy'))) {
    filesToRemove.push('AGENTS.md.legacy');
  }

  console.log(chalk.yellow('The following legacy files will be removed:'));
  for (const file of filesToRemove) {
    console.log(chalk.gray(`   ${file}`));
  }

  // Confirm unless force
  if (!options.force && !options.dryRun) {
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to remove these files?',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.gray('\nOperation cancelled.'));
      return 1;
    }
  }

  if (options.dryRun) {
    console.log(chalk.cyan('\n📋 Dry run - would remove:'));
    for (const file of filesToRemove) {
      console.log(chalk.gray(`   ${file}`));
    }
    return 0;
  }

  // Create backup directory
  const backupDir = path.join(projectRoot, `.context-migration-backup-${Date.now()}`);
  await fs.promises.mkdir(backupDir, { recursive: true });

  // Move files to backup
  for (const file of filesToRemove) {
    const sourcePath = path.join(projectRoot, file);
    const backupPath = path.join(backupDir, file);
    await fs.promises.rename(sourcePath, backupPath);
    console.log(chalk.gray(`   Backed up: ${file}`));
  }

  console.log(chalk.green(`\n✅ Migration complete!`));
  console.log(chalk.gray(`   Legacy files backed up to: ${path.basename(backupDir)}`));

  // Update config.yaml to remove migration mode
  const configPath = path.join(projectRoot, '.context', 'config.yaml');
  if (fs.existsSync(configPath)) {
    let configContent = await fs.promises.readFile(configPath, 'utf-8');
    // Remove migration section (simple approach)
    // Match from "# Migration configuration" to end of migration block or end of file
    configContent = configContent.replace(/\n# Migration configuration\nmigration:[\s\S]*?(?=\n[a-z#]|$)/g, '');
    // Also handle case where migration section is at end of file
    configContent = configContent.replace(/\nmigration:\s*\n\s+mode:[\s\S]*$/g, '');
    await fs.promises.writeFile(configPath, configContent, 'utf-8');
    console.log(chalk.green('✅ Updated config.yaml to remove migration settings'));
  }

  console.log(chalk.blue('\n🎉 Your project now uses .context exclusively!'));
  console.log(chalk.gray('   Run `ctx build` to regenerate outputs.'));

  return 0;
}

/**
 * Run the migrate command
 */
export async function runMigrate(options: MigrateCommandOptions): Promise<number> {
  const projectRoot = process.cwd();

  // Determine which mode to run
  if (options.analyze) {
    return runAnalyze(projectRoot);
  }

  if (options.attach) {
    return runAttach(projectRoot, options);
  }

  if (options.complete) {
    return runComplete(projectRoot, options);
  }

  // Default: show help
  console.log(chalk.blue('\n📦 Context Migration Tool\n'));
  console.log('Usage: ctx migrate [options]\n');
  console.log('Options:');
  console.log('  --analyze    Detect and analyze legacy context files');
  console.log('  --attach     Create .context alongside legacy files');
  console.log('  --complete   Remove legacy files after migration');
  console.log('  --force      Skip confirmation prompts');
  console.log('  --dry-run    Show what would happen without making changes');
  console.log('');
  console.log('Migration workflow:');
  console.log(chalk.gray('  1. ctx migrate --analyze     # See what legacy files exist'));
  console.log(chalk.gray('  2. ctx migrate --attach      # Create .context alongside'));
  console.log(chalk.gray('  3. ctx build                 # Generate new outputs'));
  console.log(chalk.gray('  4. ctx diff --legacy         # Compare results'));
  console.log(chalk.gray('  5. ctx migrate --complete    # Remove legacy files'));

  return 0;
}
