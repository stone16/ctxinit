/**
 * Build Orchestration
 *
 * Coordinates the full build pipeline:
 * - Rule discovery and parsing
 * - Static analysis validation
 * - Multi-target compilation
 * - Incremental build support
 * - Error handling and recovery
 */

import * as path from 'path';
import { Config, BuildTarget } from '../schemas/config';
import { loadConfig } from '../config/loader';
import { parseAllRules, ParseOptions } from '../parser/rule-parser';
import { analyzeRules, AnalysisResult, AnalysisOptions } from '../analysis/static-analysis';
import { CursorCompiler } from '../compiler/cursor-compiler';
import { ClaudeCompiler } from '../compiler/claude-compiler';
import { AgentsCompiler } from '../compiler/agents-compiler';
import { CompilationResult, CompilerContext } from '../compiler/base-compiler';
import {
  readManifest,
  writeManifest,
  detectChanges,
  updateManifest,
  calculateHash,
  OutputDependency,
} from './manifest';
import { transaction, PendingWrite, cleanupStaleTempFiles } from './atomic';
import { withLock } from './lock';

/**
 * Build options
 */
export interface BuildOptions {
  /** Project root directory */
  projectRoot: string;
  /** Build target(s) */
  targets?: BuildTarget[];
  /** Force full rebuild (ignore incremental) */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Quiet mode (minimal output) */
  quiet?: boolean;
  /** Skip validation */
  skipValidation?: boolean;
  /** Parallel rule processing */
  parallel?: boolean;
}

/**
 * Build statistics
 */
export interface BuildStats {
  /** Total build duration in milliseconds */
  duration: number;
  /** Number of rules processed */
  rulesProcessed: number;
  /** Number of rules changed (incremental) */
  rulesChanged: number;
  /** Number of output files generated */
  filesGenerated: number;
  /** Total tokens in output */
  totalTokens: number;
  /** Whether this was an incremental build */
  incremental: boolean;
  /** Targets built */
  targets: BuildTarget[];
}

/**
 * Build result
 */
export interface BuildResult {
  /** Whether build succeeded */
  success: boolean;
  /** Build statistics */
  stats: BuildStats;
  /** Analysis result */
  analysis?: AnalysisResult;
  /** Compilation results by target */
  compilations: Map<BuildTarget, CompilationResult>;
  /** Errors encountered */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

/**
 * Build orchestrator
 */
export class BuildOrchestrator {
  private config: Config;
  private projectRoot: string;
  private quiet: boolean;

  constructor(projectRoot: string, config: Config, options?: Partial<BuildOptions>) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.quiet = options?.quiet ?? false;
  }

  /**
   * Execute full build pipeline
   */
  async build(options: BuildOptions): Promise<BuildResult> {
    const startTime = Date.now();
    const result: BuildResult = {
      success: false,
      stats: {
        duration: 0,
        rulesProcessed: 0,
        rulesChanged: 0,
        filesGenerated: 0,
        totalTokens: 0,
        incremental: !options.force,
        targets: options.targets || this.getDefaultTargets(),
      },
      compilations: new Map(),
      errors: [],
      warnings: [],
    };

    try {
      // Use lock guard for the entire build
      await withLock(this.projectRoot, result.stats.targets.join(','), async () => {
        // Clean up stale temp files from previous crashed builds
        const contextDir = path.join(this.projectRoot, '.context');
        await cleanupStaleTempFiles(contextDir);

        // Step 1: Discover and parse rules
        this.log('Discovering rules...');
        const parseOptions: ParseOptions = {
          projectRoot: this.projectRoot,
          rulesDir: path.join(this.projectRoot, '.context', 'rules'),
        };

        const { rules, errors: parseErrors } = parseAllRules(parseOptions);

        if (parseErrors.length > 0) {
          result.errors.push(...parseErrors.map(e => `Parse error: ${e.message} (${e.path}:${e.line || 0})`));
          // Fail build on any parse errors - invalid rules should block the build
          result.stats.duration = Date.now() - startTime;
          return;
        }

        result.stats.rulesProcessed = rules.length;
        this.log(`Found ${rules.length} rules`);

        // Step 2: Static analysis (unless skipped)
        if (!options.skipValidation) {
          this.log('Running static analysis...');
          const analysisOptions: AnalysisOptions = {
            projectRoot: this.projectRoot,
            config: this.config,
          };
          result.analysis = analyzeRules(rules, analysisOptions);

          // Check for blocking errors
          if (result.analysis.errors.length > 0) {
            result.errors.push(
              ...result.analysis.errors.map(e => `${e.type}: ${e.message} (${e.path}${e.line ? `:${e.line}` : ''})`)
            );
            result.stats.duration = Date.now() - startTime;
            return;
          }

          // Collect warnings
          result.warnings.push(
            ...result.analysis.warnings.map(w => `${w.type}: ${w.message} (${w.path})`)
          );
        }

        // Step 3: Check for incremental build
        const manifest = options.force ? null : await readManifest(this.projectRoot);
        let changedRules = rules;

        if (manifest && !options.force) {
          this.log('Checking for changes...');
          const ruleFiles = rules.map(r => r.absolutePath);
          const changes = await detectChanges(this.projectRoot, ruleFiles, manifest);

          const changedPaths = new Set([...changes.added, ...changes.modified]);
          changedRules = rules.filter(r => {
            const relativePath = path.relative(this.projectRoot, r.absolutePath);
            return changedPaths.has(relativePath);
          });

          result.stats.rulesChanged = changedRules.length;
          result.stats.incremental = true;

          if (changedRules.length === 0 && changes.removed.length === 0) {
            this.log('No changes detected, skipping compilation');
            result.success = true;
            result.stats.duration = Date.now() - startTime;
            return;
          }

          this.log(`${changedRules.length} rules changed, ${changes.removed.length} removed`);
        } else {
          result.stats.incremental = false;
          result.stats.rulesChanged = rules.length;
        }

        // Step 4: Compile for each target
        const targets = options.targets || this.getDefaultTargets();
        const pendingWrites: PendingWrite[] = [];
        const outputDependencies: OutputDependency[] = [];

        for (const target of targets) {
          this.log(`Compiling for ${target}...`);

          // Create compiler context
          const compilerContext: CompilerContext = {
            projectRoot: this.projectRoot,
            config: this.config,
            rules: rules,
          };

          let compilationResult: CompilationResult;

          switch (target) {
            case 'cursor': {
              const cursorCompiler = new CursorCompiler(compilerContext);
              compilationResult = await cursorCompiler.compile();
              break;
            }

            case 'claude': {
              const claudeCompiler = new ClaudeCompiler(compilerContext);
              compilationResult = await claudeCompiler.compile();
              break;
            }

            case 'agents': {
              const agentsCompiler = new AgentsCompiler(compilerContext);
              compilationResult = await agentsCompiler.compile();
              break;
            }

            default:
              result.errors.push(`Unknown target: ${target}`);
              continue;
          }

          result.compilations.set(target, compilationResult);

          // Collect errors and warnings
          result.errors.push(...compilationResult.errors.map(e => `[${target}] ${e.message}`));
          result.warnings.push(...compilationResult.warnings.map(w => `[${target}] ${w.message}`));

          // Prepare atomic writes
          for (const output of compilationResult.outputs) {
            pendingWrites.push({
              targetPath: output.path,
              content: output.content,
            });

            // Track output dependencies
            outputDependencies.push({
              outputPath: path.relative(this.projectRoot, output.path),
              sourceRules: rules.map(r => path.relative(this.projectRoot, r.absolutePath)),
              generatedAt: Date.now(),
            });
          }

          result.stats.filesGenerated += compilationResult.outputs.length;
          result.stats.totalTokens += compilationResult.stats.totalTokens;
        }

        // Step 5: Atomic write all outputs
        if (pendingWrites.length > 0) {
          this.log('Writing outputs atomically...');
          const txResult = await transaction(pendingWrites);

          if (!txResult.success) {
            result.errors.push(
              ...txResult.errors.map(e => `Failed to write ${e.path}: ${e.error.message}`)
            );
            result.stats.duration = Date.now() - startTime;
            return;
          }

          this.log(`Wrote ${txResult.writtenFiles.length} files`);
        }

        // Step 6: Update manifest
        const configContent = JSON.stringify(this.config);
        const configHash = calculateHash(configContent);
        const allRulePaths = rules.map(r => r.absolutePath);

        const newManifest = await updateManifest(
          this.projectRoot,
          allRulePaths,
          targets.join(','),
          outputDependencies,
          configHash
        );

        await writeManifest(this.projectRoot, newManifest);
        this.log('Updated build manifest');

        result.success = true;
      });
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Check if it's a lock error
      if (errorMessage.includes('Build already in progress')) {
        result.errors.push(errorMessage);
      } else {
        result.errors.push(`Build failed: ${errorMessage}`);
      }
    }

    result.stats.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Log message (respecting quiet/verbose modes)
   */
  private log(message: string): void {
    if (this.quiet) return;
    console.log(message);
  }

  /**
   * Get default targets based on config
   * Returns targets that have configuration, defaults to ['claude']
   */
  private getDefaultTargets(): BuildTarget[] {
    const targets: BuildTarget[] = [];

    if (this.config.compile?.claude) {
      targets.push('claude');
    }
    if (this.config.compile?.cursor) {
      targets.push('cursor');
    }
    if (this.config.compile?.agents) {
      targets.push('agents');
    }

    // Default to claude if no targets configured
    return targets.length > 0 ? targets : ['claude'];
  }
}

/**
 * Execute build with options
 *
 * Convenience function for CLI integration
 */
export async function executeBuild(options: BuildOptions): Promise<BuildResult> {
  // Load config
  const loadResult = loadConfig(options.projectRoot);

  // Create orchestrator
  const orchestrator = new BuildOrchestrator(options.projectRoot, loadResult.config, options);

  // Execute build
  return orchestrator.build(options);
}

/**
 * Format build result for display
 */
export function formatBuildResult(result: BuildResult): string {
  const lines: string[] = [];

  if (result.success) {
    lines.push('✅ Build completed successfully');
  } else {
    lines.push('❌ Build failed');
  }

  lines.push('');
  lines.push(`Duration: ${result.stats.duration}ms`);
  lines.push(`Rules processed: ${result.stats.rulesProcessed}`);

  if (result.stats.incremental) {
    lines.push(`Rules changed: ${result.stats.rulesChanged}`);
  }

  lines.push(`Files generated: ${result.stats.filesGenerated}`);
  lines.push(`Total tokens: ${result.stats.totalTokens}`);
  lines.push(`Targets: ${result.stats.targets.join(', ')}`);

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ❌ ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠️ ${warning}`);
    }
  }

  return lines.join('\n');
}
