/**
 * Bootstrap Orchestrator
 *
 * Coordinates the enhanced bootstrap flow:
 * 1. Analyze codebase
 * 2. Load existing .context files (preserve user edits)
 * 3. Invoke LLM to generate/enhance context
 * 4. Validate output (links, references, best practices)
 * 5. Write files to .context/
 * 6. Optionally run build to generate outputs
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import fg from 'fast-glob';

import {
  LLMProvider,
  LLMProviderType,
  BootstrapLLMOutput,
  autoSelectProvider,
  createProvider,
  detectProviders,
} from '../llm';
import {
  BOOTSTRAP_SYSTEM_PROMPT,
  buildBootstrapUserPrompt,
} from '../llm/prompts';
import {
  analyzeCodebase,
  CodebaseAnalysis,
  printAnalysisSummary,
} from '../cli/bootstrap';
import { validateBootstrapOutput, ValidationResult } from './validator';

/**
 * Bootstrap options
 */
export interface BootstrapOptions {
  /** LLM provider to use (auto-detect if not specified) */
  provider?: LLMProviderType;
  /** Skip LLM invocation, just analyze */
  analyzeOnly?: boolean;
  /** Skip validation */
  skipValidation?: boolean;
  /** Auto-run build after bootstrap */
  autoBuild?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Dry run - don't write files */
  dryRun?: boolean;
}

/**
 * Bootstrap result
 */
export interface BootstrapResult {
  success: boolean;
  analysis: CodebaseAnalysis;
  llmOutput?: BootstrapLLMOutput;
  validation?: ValidationResult;
  filesWritten: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Existing context state
 */
interface ExistingContext {
  projectMd?: string;
  architectureMd?: string;
  existingRules: Array<{ path: string; content: string }>;
}

/**
 * Run the enhanced bootstrap flow
 */
export async function runEnhancedBootstrap(
  projectRoot: string,
  options: BootstrapOptions = {}
): Promise<BootstrapResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const filesWritten: string[] = [];

  console.log(chalk.blue('\n🚀 Starting enhanced bootstrap...\n'));

  // Phase 1: Analyze codebase
  console.log(chalk.cyan('Phase 1: Analyzing codebase...'));
  const analysis = await analyzeCodebase(projectRoot);
  printAnalysisSummary(analysis);

  if (options.analyzeOnly) {
    return {
      success: true,
      analysis,
      filesWritten,
      errors,
      warnings,
    };
  }

  // Phase 2: Load existing context
  console.log(chalk.cyan('\nPhase 2: Loading existing context...'));
  const existingContext = await loadExistingContext(projectRoot);

  if (existingContext.projectMd || existingContext.architectureMd || existingContext.existingRules.length > 0) {
    console.log(chalk.gray('  Found existing context files (will preserve user edits):'));
    if (existingContext.projectMd) console.log(chalk.gray('    - .context/project.md'));
    if (existingContext.architectureMd) console.log(chalk.gray('    - .context/architecture.md'));
    for (const rule of existingContext.existingRules) {
      console.log(chalk.gray(`    - .context/${rule.path}`));
    }
  } else {
    console.log(chalk.gray('  No existing context files found.'));
  }

  // Phase 3: Select LLM provider
  console.log(chalk.cyan('\nPhase 3: Selecting LLM provider...'));
  let provider: LLMProvider;

  try {
    if (options.provider) {
      provider = createProvider(options.provider);
      if (!(await provider.isAvailable())) {
        throw new Error(`Provider '${options.provider}' is not available`);
      }
    } else {
      // Auto-detect
      const detection = await detectProviders();
      console.log(chalk.gray('  Available providers:'));
      for (const type of detection.available) {
        const marker = type === detection.recommended ? chalk.green('→') : ' ';
        console.log(chalk.gray(`  ${marker} ${type}`));
      }
      provider = await autoSelectProvider();
    }
    console.log(chalk.green(`  Using: ${provider.name}`));
  } catch (error) {
    errors.push((error as Error).message);
    return {
      success: false,
      analysis,
      filesWritten,
      errors,
      warnings,
    };
  }

  // Phase 4: Invoke LLM
  console.log(chalk.cyan('\nPhase 4: Generating context with LLM...'));
  let llmOutput: BootstrapLLMOutput;

  try {
    const userPrompt = buildBootstrapUserPrompt(analysis, existingContext);

    if (options.verbose) {
      console.log(chalk.gray('\n--- Prompt Preview (first 500 chars) ---'));
      console.log(chalk.gray(userPrompt.slice(0, 500) + '...'));
      console.log(chalk.gray('--- End Preview ---\n'));
    }

    console.log(chalk.gray('  Sending request to LLM...'));

    const response = await provider.complete({
      systemPrompt: BOOTSTRAP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      jsonMode: true,
      maxTokens: 8192,
      temperature: 0.7,
    });

    if (options.verbose && response.totalTokens) {
      console.log(chalk.gray(`  Tokens used: ${response.totalTokens}`));
    }

    // Parse JSON response
    llmOutput = parseBootstrapResponse(response.content);
    console.log(chalk.green('  ✓ LLM response received and parsed'));

    if (llmOutput.suggestions && llmOutput.suggestions.length > 0) {
      console.log(chalk.yellow('\n  Suggestions from LLM:'));
      for (const suggestion of llmOutput.suggestions) {
        console.log(chalk.yellow(`    - ${suggestion}`));
      }
    }
  } catch (error) {
    errors.push(`LLM invocation failed: ${(error as Error).message}`);
    return {
      success: false,
      analysis,
      filesWritten,
      errors,
      warnings,
    };
  }

  // Phase 5: Validate output
  let validation: ValidationResult | undefined;

  if (!options.skipValidation) {
    console.log(chalk.cyan('\nPhase 5: Validating output...'));
    validation = await validateBootstrapOutput(llmOutput, projectRoot, analysis);

    if (validation.errors.length > 0) {
      console.log(chalk.red('  Validation errors:'));
      for (const err of validation.errors) {
        console.log(chalk.red(`    ✗ ${err}`));
        errors.push(err);
      }
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('  Validation warnings:'));
      for (const warn of validation.warnings) {
        console.log(chalk.yellow(`    ⚠ ${warn}`));
        warnings.push(warn);
      }
    }

    if (validation.valid) {
      console.log(chalk.green('  ✓ Validation passed'));
    }
  }

  // Phase 6: Write files
  if (!options.dryRun) {
    console.log(chalk.cyan('\nPhase 6: Writing context files...'));

    try {
      const written = await writeContextFiles(projectRoot, llmOutput);
      filesWritten.push(...written);

      for (const file of written) {
        console.log(chalk.gray(`    ✓ ${file}`));
      }
      console.log(chalk.green(`  ✓ Wrote ${written.length} files`));
    } catch (error) {
      errors.push(`Failed to write files: ${(error as Error).message}`);
    }
  } else {
    console.log(chalk.cyan('\nPhase 6: Dry run - would write:'));
    if (llmOutput.projectMd) console.log(chalk.gray('    - .context/project.md'));
    if (llmOutput.architectureMd) console.log(chalk.gray('    - .context/architecture.md'));
    for (const rule of llmOutput.rules) {
      console.log(chalk.gray(`    - .context/${rule.path}`));
    }
  }

  // Summary
  const success = errors.length === 0;

  console.log(chalk.blue('\n' + '='.repeat(50)));
  if (success) {
    console.log(chalk.green.bold('✅ Bootstrap completed successfully!'));
    console.log(chalk.gray(`\nFiles created/updated: ${filesWritten.length}`));
    console.log(chalk.blue('\n📝 Next steps:'));
    console.log(chalk.gray('   1. Review generated files in .context/'));
    console.log(chalk.gray('   2. Customize rules as needed'));
    console.log(chalk.gray('   3. Run: ctx build'));
  } else {
    console.log(chalk.red.bold('❌ Bootstrap completed with errors'));
    console.log(chalk.gray(`\nErrors: ${errors.length}`));
  }

  return {
    success,
    analysis,
    llmOutput,
    validation,
    filesWritten,
    errors,
    warnings,
  };
}

/**
 * Load existing context files
 */
async function loadExistingContext(projectRoot: string): Promise<ExistingContext> {
  const contextDir = path.join(projectRoot, '.context');
  const result: ExistingContext = {
    existingRules: [],
  };

  // Load project.md
  const projectPath = path.join(contextDir, 'project.md');
  if (fs.existsSync(projectPath)) {
    result.projectMd = await fs.promises.readFile(projectPath, 'utf-8');
  }

  // Load architecture.md
  const archPath = path.join(contextDir, 'architecture.md');
  if (fs.existsSync(archPath)) {
    result.architectureMd = await fs.promises.readFile(archPath, 'utf-8');
  }

  // Load existing rules
  const rulesDir = path.join(contextDir, 'rules');
  if (fs.existsSync(rulesDir)) {
    const ruleFiles = await fg('**/*.md', {
      cwd: rulesDir,
      onlyFiles: true,
    });

    for (const file of ruleFiles) {
      const fullPath = path.join(rulesDir, file);
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      result.existingRules.push({
        path: `rules/${file}`,
        content,
      });
    }
  }

  return result;
}

/**
 * Parse LLM response into structured output
 */
function parseBootstrapResponse(content: string): BootstrapLLMOutput {
  // Remove markdown code blocks if present
  let jsonStr = content.trim();

  const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as BootstrapLLMOutput;

    // Validate structure
    if (!parsed.rules || !Array.isArray(parsed.rules)) {
      parsed.rules = [];
    }

    // Normalize rule paths
    for (const rule of parsed.rules) {
      if (!rule.path.startsWith('rules/')) {
        rule.path = `rules/${rule.path}`;
      }
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${(error as Error).message}\n` +
      `Response preview: ${content.slice(0, 500)}...`
    );
  }
}

/**
 * Write context files to disk
 */
async function writeContextFiles(
  projectRoot: string,
  output: BootstrapLLMOutput
): Promise<string[]> {
  const contextDir = path.join(projectRoot, '.context');
  const written: string[] = [];

  // Ensure directories exist
  await fs.promises.mkdir(contextDir, { recursive: true });
  await fs.promises.mkdir(path.join(contextDir, 'rules'), { recursive: true });

  // Write project.md
  if (output.projectMd) {
    const filePath = path.join(contextDir, 'project.md');
    await fs.promises.writeFile(filePath, output.projectMd, 'utf-8');
    written.push('.context/project.md');
  }

  // Write architecture.md
  if (output.architectureMd) {
    const filePath = path.join(contextDir, 'architecture.md');
    await fs.promises.writeFile(filePath, output.architectureMd, 'utf-8');
    written.push('.context/architecture.md');
  }

  // Write rules
  for (const rule of output.rules) {
    const filePath = path.join(contextDir, rule.path);

    // Ensure subdirectory exists
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    await fs.promises.writeFile(filePath, rule.content, 'utf-8');
    written.push(`.context/${rule.path}`);
  }

  return written;
}
