/**
 * Diff Command
 *
 * Compare compiled outputs with legacy files:
 * - Show differences between .context-based outputs and existing files
 * - Support --legacy flag for migration comparison
 */

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';

/**
 * Diff command options
 */
export interface DiffCommandOptions {
  /** Compare with legacy files */
  legacy?: boolean;
  /** Show unified diff format */
  unified?: boolean;
  /** Show detailed output */
  verbose?: boolean;
}

/**
 * Simple line-based diff
 */
function simpleDiff(oldLines: string[], newLines: string[]): string[] {
  const output: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      output.push(`+ ${newLine}`);
    } else if (newLine === undefined) {
      output.push(`- ${oldLine}`);
    } else if (oldLine !== newLine) {
      output.push(`- ${oldLine}`);
      output.push(`+ ${newLine}`);
    }
  }

  return output;
}

/**
 * Compare two files
 */
interface FileComparison {
  name: string;
  legacyPath: string;
  compiledPath: string;
  legacyExists: boolean;
  compiledExists: boolean;
  identical: boolean;
  legacyLines: number;
  compiledLines: number;
  diffLines: string[];
}

/**
 * Run the diff command
 */
export async function runDiff(options: DiffCommandOptions): Promise<number> {
  const projectRoot = process.cwd();

  if (!options.legacy) {
    console.log(chalk.yellow('\n⚠️  The diff command currently requires the --legacy flag.'));
    console.log(chalk.gray('   Usage: ctx diff --legacy'));
    console.log(chalk.gray('   This compares legacy context files with compiled .context outputs.\n'));
    return 1;
  }

  console.log(chalk.blue('\n📊 Comparing legacy files with compiled outputs...\n'));

  // Define comparison pairs
  const comparisons: Array<{ name: string; legacy: string; compiled: string }> = [
    {
      name: 'CLAUDE.md',
      legacy: path.join(projectRoot, 'CLAUDE.md.legacy'),
      compiled: path.join(projectRoot, 'CLAUDE.md'),
    },
    {
      name: 'AGENTS.md',
      legacy: path.join(projectRoot, 'AGENTS.md.legacy'),
      compiled: path.join(projectRoot, 'AGENTS.md'),
    },
    {
      name: '.cursorrules',
      legacy: path.join(projectRoot, '.cursorrules'),
      compiled: path.join(projectRoot, '.cursor', 'rules'),
    },
  ];

  const results: FileComparison[] = [];

  for (const comp of comparisons) {
    const result: FileComparison = {
      name: comp.name,
      legacyPath: comp.legacy,
      compiledPath: comp.compiled,
      legacyExists: fs.existsSync(comp.legacy),
      compiledExists: fs.existsSync(comp.compiled),
      identical: false,
      legacyLines: 0,
      compiledLines: 0,
      diffLines: [],
    };

    if (result.legacyExists && result.compiledExists) {
      // Handle directory vs file for cursor
      if (comp.name === '.cursorrules' && fs.statSync(comp.compiled).isDirectory()) {
        const legacyContent = await fs.promises.readFile(comp.legacy, 'utf-8');
        result.legacyLines = legacyContent.split('\n').length;

        // Read all .mdc files and combine
        const mdcFiles = fs.readdirSync(comp.compiled).filter(f => f.endsWith('.mdc'));
        let compiledContent = '';
        for (const mdcFile of mdcFiles) {
          compiledContent += await fs.promises.readFile(path.join(comp.compiled, mdcFile), 'utf-8');
          compiledContent += '\n---\n';
        }
        result.compiledLines = compiledContent.split('\n').length;

        // Can't easily diff one-to-many, just note structure difference
        result.identical = false;
        result.diffLines = [
          `Legacy: single file with ${result.legacyLines} lines`,
          `Compiled: ${mdcFiles.length} .mdc file(s) with ${result.compiledLines} total lines`,
        ];
      } else {
        const legacyContent = await fs.promises.readFile(comp.legacy, 'utf-8');
        const compiledContent = await fs.promises.readFile(comp.compiled, 'utf-8');

        const legacyLines = legacyContent.split('\n');
        const compiledLines = compiledContent.split('\n');

        result.legacyLines = legacyLines.length;
        result.compiledLines = compiledLines.length;
        result.identical = legacyContent === compiledContent;

        if (!result.identical) {
          result.diffLines = simpleDiff(legacyLines, compiledLines);
          // Limit diff output
          if (result.diffLines.length > 50) {
            result.diffLines = [
              ...result.diffLines.slice(0, 25),
              `... (${result.diffLines.length - 50} more lines) ...`,
              ...result.diffLines.slice(-25),
            ];
          }
        }
      }
    }

    results.push(result);
  }

  // Output results
  let hasLegacy = false;
  let hasCompiled = false;

  for (const result of results) {
    console.log(chalk.bold(`${result.name}:`));

    if (!result.legacyExists && !result.compiledExists) {
      console.log(chalk.gray('  Neither legacy nor compiled file exists\n'));
      continue;
    }

    if (!result.legacyExists) {
      console.log(chalk.gray('  No legacy file found'));
      if (result.compiledExists) {
        hasCompiled = true;
        console.log(chalk.green(`  Compiled: ${result.compiledLines} lines`));
      }
      console.log('');
      continue;
    }

    hasLegacy = true;
    console.log(chalk.yellow(`  Legacy: ${result.legacyLines} lines`));

    if (!result.compiledExists) {
      console.log(chalk.gray('  No compiled file (run `ctx build` first)'));
      console.log('');
      continue;
    }

    hasCompiled = true;
    console.log(chalk.green(`  Compiled: ${result.compiledLines} lines`));

    if (result.identical) {
      console.log(chalk.green('  ✅ Files are identical'));
    } else {
      console.log(chalk.yellow('  ⚠️  Files differ:'));
      if (options.verbose || options.unified) {
        for (const line of result.diffLines) {
          if (line.startsWith('+')) {
            console.log(chalk.green(`    ${line}`));
          } else if (line.startsWith('-')) {
            console.log(chalk.red(`    ${line}`));
          } else {
            console.log(chalk.gray(`    ${line}`));
          }
        }
      } else {
        console.log(chalk.gray(`    ${result.diffLines.length} difference(s) found`));
        console.log(chalk.gray('    Use --verbose to see details'));
      }
    }
    console.log('');
  }

  // Summary
  if (!hasLegacy) {
    console.log(chalk.gray('No legacy files found for comparison.'));
    console.log(chalk.gray('To compare, rename existing files with .legacy extension:'));
    console.log(chalk.gray('  mv CLAUDE.md CLAUDE.md.legacy'));
    return 0;
  }

  if (!hasCompiled) {
    console.log(chalk.yellow('No compiled outputs found.'));
    console.log(chalk.gray('Run `ctx build` first to generate outputs.'));
    return 1;
  }

  console.log(chalk.blue('💡 Migration tip:'));
  console.log(chalk.gray('   After verifying the diff, run `ctx migrate --complete` to remove legacy files.'));

  return 0;
}
