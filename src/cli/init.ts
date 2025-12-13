/**
 * Init Command
 *
 * Initialize .context directory structure in a project with:
 * - Interactive agent selection
 * - Template file generation
 * - Existing directory detection
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { DEFAULT_CONFIG } from '../schemas/config';
import yaml from 'yaml';
import { runBootstrap } from './bootstrap';

/**
 * Init command options
 */
export interface InitOptions {
  /** Force overwrite existing .context */
  force?: boolean;
  /** Run without interactive prompts */
  interactive?: boolean;
  /** Launch migration wizard */
  wizard?: boolean;
  /** Dry run mode - show what would happen */
  dryRun?: boolean;
  /** Run bootstrap to analyze codebase and generate LLM prompt */
  bootstrap?: boolean;
}

/**
 * Agent selection type
 */
export type AgentSelection = 'cursor' | 'claude' | 'all';

/**
 * Template file definition
 */
interface TemplateFile {
  source: string;
  target: string;
}

/**
 * Get path to templates directory
 */
function getTemplatesDir(): string {
  // In development: templates/ relative to project root
  // In production: relative to dist/
  const devPath = path.join(__dirname, '..', '..', 'templates');
  const prodPath = path.join(__dirname, '..', '..', '..', 'templates');

  if (fs.existsSync(devPath)) {
    return devPath;
  }
  return prodPath;
}

/**
 * Read template file content
 */
function readTemplate(templateName: string): string {
  const templatesDir = getTemplatesDir();
  const templatePath = path.join(templatesDir, templateName);
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Generate config.yaml based on agent selection
 */
function generateConfig(agents: AgentSelection): string {
  // Deep copy to avoid mutating DEFAULT_CONFIG
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as typeof DEFAULT_CONFIG;

  if (agents === 'cursor') {
    delete config.compile.claude;
    delete config.compile.agents;
  } else if (agents === 'claude') {
    delete config.compile.cursor;
    delete config.compile.agents;
  }
  // 'all' keeps everything

  return yaml.stringify(config);
}

/**
 * Check if .context directory exists
 */
export function contextExists(projectRoot: string): boolean {
  const contextDir = path.join(projectRoot, '.context');
  return fs.existsSync(contextDir);
}

/**
 * Detect existing context files (for migration)
 */
export function detectExistingFiles(projectRoot: string): {
  cursorrules: boolean;
  claudeMd: boolean;
  agentsMd: boolean;
} {
  return {
    cursorrules: fs.existsSync(path.join(projectRoot, '.cursorrules')),
    claudeMd: fs.existsSync(path.join(projectRoot, 'CLAUDE.md')),
    agentsMd: fs.existsSync(path.join(projectRoot, 'AGENTS.md')),
  };
}

/**
 * Create backup of existing .context directory
 */
async function backupContext(projectRoot: string): Promise<string> {
  const contextDir = path.join(projectRoot, '.context');
  const timestamp = Date.now();
  const backupDir = path.join(projectRoot, `.context.backup.${timestamp}`);

  await fs.promises.rename(contextDir, backupDir);
  return backupDir;
}

/**
 * Initialize .context directory structure
 */
export async function initializeContext(
  projectRoot: string,
  agents: AgentSelection,
  options: { dryRun?: boolean } = {}
): Promise<{ created: string[]; skipped: string[] }> {
  const contextDir = path.join(projectRoot, '.context');
  const rulesDir = path.join(contextDir, 'rules');

  const created: string[] = [];
  const skipped: string[] = [];

  // Create directories
  const directories = [contextDir, rulesDir];
  for (const dir of directories) {
    if (!options.dryRun) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    created.push(dir);
  }

  // Define template files
  const templates: TemplateFile[] = [
    { source: 'project.md', target: path.join(contextDir, 'project.md') },
    { source: 'architecture.md', target: path.join(contextDir, 'architecture.md') },
    { source: 'rules/example.md', target: path.join(rulesDir, 'example.md') },
  ];

  // Write template files
  for (const template of templates) {
    if (fs.existsSync(template.target)) {
      skipped.push(template.target);
      continue;
    }

    if (!options.dryRun) {
      const content = readTemplate(template.source);
      await fs.promises.writeFile(template.target, content, 'utf-8');
    }
    created.push(template.target);
  }

  // Generate and write config.yaml
  const configPath = path.join(contextDir, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    if (!options.dryRun) {
      const configContent = generateConfig(agents);
      await fs.promises.writeFile(configPath, configContent, 'utf-8');
    }
    created.push(configPath);
  } else {
    skipped.push(configPath);
  }

  return { created, skipped };
}

/**
 * Run the init command
 */
export async function runInit(options: InitOptions): Promise<number> {
  const projectRoot = process.cwd();

  console.log(chalk.blue('\n🚀 Initializing .context directory\n'));

  // Check for existing .context
  if (contextExists(projectRoot)) {
    if (!options.force) {
      console.log(chalk.yellow('⚠️  .context directory already exists.'));
      console.log(chalk.gray('   Use --force to overwrite (creates backup)'));
      return 1;
    }

    // Backup existing
    const backupPath = await backupContext(projectRoot);
    console.log(chalk.gray(`   Backed up to: ${path.basename(backupPath)}`));
  }

  // Detect existing context files
  const existing = detectExistingFiles(projectRoot);
  const hasExisting = existing.cursorrules || existing.claudeMd || existing.agentsMd;

  if (hasExisting && !options.wizard && options.interactive !== false) {
    console.log(chalk.yellow('📁 Found existing context files:'));
    if (existing.cursorrules) console.log(chalk.gray('   - .cursorrules'));
    if (existing.claudeMd) console.log(chalk.gray('   - CLAUDE.md'));
    if (existing.agentsMd) console.log(chalk.gray('   - AGENTS.md'));
    console.log(chalk.gray('\n   Run with --wizard for guided migration.\n'));
  }

  // Select agents
  let agents: AgentSelection = 'all';

  if (options.interactive !== false) {
    const answers = await inquirer.prompt<{ agents: AgentSelection }>([
      {
        type: 'list',
        name: 'agents',
        message: 'Which AI agents do you want to target?',
        choices: [
          { name: 'All agents (Cursor, Claude Code, Codex)', value: 'all' },
          { name: 'Cursor IDE only', value: 'cursor' },
          { name: 'Claude Code only', value: 'claude' },
        ],
        default: 'all',
      },
    ]);
    agents = answers.agents;
  }

  // Initialize
  const { created, skipped } = await initializeContext(projectRoot, agents, {
    dryRun: options.dryRun,
  });

  // Output results
  if (options.dryRun) {
    console.log(chalk.cyan('\n📋 Dry run - would create:'));
  } else {
    console.log(chalk.green('\n✅ Created:'));
  }

  for (const file of created) {
    const relative = path.relative(projectRoot, file);
    console.log(chalk.gray(`   ${relative}`));
  }

  if (skipped.length > 0) {
    console.log(chalk.yellow('\n⏭️  Skipped (already exist):'));
    for (const file of skipped) {
      const relative = path.relative(projectRoot, file);
      console.log(chalk.gray(`   ${relative}`));
    }
  }

  // Bootstrap option - analyze codebase and generate LLM prompt
  let shouldBootstrap = options.bootstrap;

  if (shouldBootstrap === undefined && options.interactive !== false && !options.dryRun) {
    const bootstrapAnswer = await inquirer.prompt<{ bootstrap: boolean }>([
      {
        type: 'confirm',
        name: 'bootstrap',
        message: 'Analyze codebase and generate LLM prompt for rule creation?',
        default: true,
      },
    ]);
    shouldBootstrap = bootstrapAnswer.bootstrap;
  }

  if (shouldBootstrap && !options.dryRun) {
    const { prompt } = await runBootstrap(projectRoot);

    // Save the prompt to a file
    const promptPath = path.join(projectRoot, '.context', 'bootstrap-prompt.md');
    await fs.promises.writeFile(promptPath, prompt, 'utf-8');

    console.log(chalk.green('\n✅ Bootstrap complete!'));
    console.log(chalk.gray('   LLM prompt saved to: .context/bootstrap-prompt.md'));
    console.log(chalk.blue('\n📝 Next steps:'));
    console.log(chalk.gray('   1. Copy .context/bootstrap-prompt.md content to your LLM'));
    console.log(chalk.gray('   2. Save generated rules to .context/rules/'));
    console.log(chalk.gray('   3. Run: ctx build'));
  } else {
    // Standard next steps
    console.log(chalk.blue('\n📝 Next steps:'));
    console.log(chalk.gray('   1. Edit .context/project.md with your project info'));
    console.log(chalk.gray('   2. Add rules to .context/rules/'));
    console.log(chalk.gray('   3. Run: ctx build'));
    console.log(chalk.gray('\n   Tip: Use --bootstrap to generate LLM-assisted rules'));
  }

  return 0;
}
