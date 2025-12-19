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

import * as fs from 'fs';
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
  BuildManifest,
  writeManifest,
  detectChanges,
  updateManifest,
  calculateHash,
  OutputDependency,
} from './manifest';
import { transaction, PendingWrite, cleanupStaleTempFiles } from './atomic';
import { withLock } from './lock';

const BUILD_METADATA_FOOTER_REGEX =
  /\n<!-- ctx build metadata -->\n<!-- timestamp: [^\n]+ -->\n<!-- checksum: sha256:[a-f0-9]{64} -->\s*$/;

const EMBEDDED_CHECKSUM_REGEX = /<!--\s*checksum:\s*(sha256:[a-f0-9]{64})\s*-->/i;

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripBuildMetadataFooter(content: string): string {
  const withoutFooter = content.replace(BUILD_METADATA_FOOTER_REGEX, '');
  return normalizeNewlines(withoutFooter);
}

function hasBuildMetadataFooter(content: string): boolean {
  return BUILD_METADATA_FOOTER_REGEX.test(content);
}

function extractEmbeddedChecksum(content: string): string | null {
  const match = content.match(EMBEDDED_CHECKSUM_REGEX);
  return match ? match[1] : null;
}

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
  /** Check if outputs are up to date (no writes) */
  check?: boolean;
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

        const targets = options.targets || this.getDefaultTargets();

        // Track all relevant source files for incremental builds
        const sourceFiles: string[] = rules.map(r => r.absolutePath);
        const projectMdPath = path.join(this.projectRoot, '.context', 'project.md');
        const architectureMdPath = path.join(this.projectRoot, '.context', 'architecture.md');
        const configYamlPath = path.join(this.projectRoot, '.context', 'config.yaml');

        if (await fileExists(projectMdPath)) sourceFiles.push(projectMdPath);
        if (await fileExists(architectureMdPath)) sourceFiles.push(architectureMdPath);
        if (await fileExists(configYamlPath)) sourceFiles.push(configYamlPath);

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
          const changes = await detectChanges(this.projectRoot, sourceFiles, manifest);

          const changedPaths = new Set([...changes.added, ...changes.modified]);
          changedRules = rules.filter((r) => changedPaths.has(path.relative(this.projectRoot, r.absolutePath)));

          result.stats.rulesChanged = changedRules.length;
          result.stats.incremental = true;

          const hasAnySourceChanges =
            changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0;

          if (!options.check && !hasAnySourceChanges) {
            const okToSkip = await verifyAndHealOutputsForIncrementalSkip(
              this.projectRoot,
              targets,
              manifest,
              rules.length
            );
            if (okToSkip) {
              this.log('No changes detected, skipping compilation');
              result.success = true;
              result.stats.duration = Date.now() - startTime;
              return;
            }
            this.log('No source changes detected, but outputs need regeneration');
          }

          this.log(`${changedRules.length} rules changed, ${changes.removed.length} removed`);
        } else {
          result.stats.incremental = false;
          result.stats.rulesChanged = rules.length;
        }

        // Step 4: Compile for each target
        const pendingWrites: PendingWrite[] = [];
        const outputDependencies: OutputDependency[] = [];
        const cursorExpectedOutputs = new Set<string>();

        for (const target of targets) {
          this.log(`Compiling for ${target}...`);

          // Create compiler context
          const compilerContext: CompilerContext = {
            projectRoot: this.projectRoot,
            config: this.config,
            rules: rules,
            writeToDisk: false,
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

          // Track expected cursor outputs for cleanup/check
          if (target === 'cursor') {
            for (const output of compilationResult.outputs) {
              cursorExpectedOutputs.add(output.path);
            }
          }

          // Track output dependencies
          for (const output of compilationResult.outputs) {
            outputDependencies.push({
              outputPath: output.path,
              sourceRules: rules.map(r => path.relative(this.projectRoot, r.absolutePath)),
              generatedAt: Date.now(),
            });
          }

          result.stats.totalTokens += compilationResult.stats.totalTokens;
        }

        // Step 5: Compare with disk (check mode) or prepare writes
        for (const compilationResult of result.compilations.values()) {
          for (const output of compilationResult.outputs) {
            const absoluteTargetPath = path.join(this.projectRoot, output.path);

            if (options.check) {
              const existing = await readFileOrNull(absoluteTargetPath);
              if (existing === null) {
                result.errors.push(`[check] Missing output: ${output.path} (run \`ctx build\`)`);
                continue;
              }

              const existingNormalized = stripBuildMetadataFooter(existing);
              const generatedNormalized = stripBuildMetadataFooter(output.content);
              if (existingNormalized !== generatedNormalized) {
                result.errors.push(`[check] Output out of date: ${output.path} (run \`ctx build\`)`);
              }
              continue;
            }

            // Normal build: only write if "real content" changed (ignore metadata timestamp churn)
            const existing = await readFileOrNull(absoluteTargetPath);
            if (existing !== null) {
              const existingNormalized = stripBuildMetadataFooter(existing);
              const generatedNormalized = stripBuildMetadataFooter(output.content);
              if (existingNormalized === generatedNormalized) {
                continue;
              }
            }

            pendingWrites.push({
              targetPath: absoluteTargetPath,
              content: output.content,
            });
          }
        }

        // Check for stale generated Cursor outputs
        const cursorCompilation = result.compilations.get('cursor');
        if (targets.includes('cursor') && cursorCompilation?.success) {
          const stale = await findStaleGeneratedCursorOutputs(
            this.projectRoot,
            cursorExpectedOutputs
          );
          if (options.check) {
            for (const stalePath of stale) {
              result.errors.push(`[check] Stale generated output: ${stalePath} (run \`ctx build\`)`);
            }
          }
        }

        if (options.check) {
          result.success = result.errors.length === 0;
          result.stats.duration = Date.now() - startTime;
          return;
        }

        // Step 6: Atomic write all outputs
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
          result.stats.filesGenerated += txResult.writtenFiles.length;
        }

        // Cleanup stale generated Cursor outputs after successful write
        if (targets.includes('cursor') && cursorCompilation?.success) {
          const stale = await findStaleGeneratedCursorOutputs(
            this.projectRoot,
            cursorExpectedOutputs
          );
          for (const stalePath of stale) {
            try {
              await fs.promises.unlink(path.join(this.projectRoot, stalePath));
            } catch {
              // Ignore cleanup errors
            }
          }
        }

        // Step 7: Update manifest
        const configHash = await calculateConfigHash(this.projectRoot, this.config);
        const allSourcePaths = sourceFiles;

        const newManifest = await updateManifest(
          this.projectRoot,
          allSourcePaths,
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function calculateConfigHash(projectRoot: string, config: Config): Promise<string> {
  const configYamlPath = path.join(projectRoot, '.context', 'config.yaml');
  const raw = await readFileOrNull(configYamlPath);
  if (raw !== null) {
    return calculateHash(raw);
  }
  return calculateHash(JSON.stringify(config));
}

async function verifyGeneratedOutputFile(projectRoot: string, relPath: string): Promise<boolean> {
  const fullPath = path.join(projectRoot, relPath);
  const content = await readFileOrNull(fullPath);
  if (content === null) return false;

  const embedded = extractEmbeddedChecksum(content);
  if (!embedded) return false;

  const cleanContent = stripBuildMetadataFooter(content);
  const actual = calculateHash(cleanContent);
  return embedded === actual;
}

function filterExpectedOutputsForTargets(
  targets: BuildTarget[],
  manifest: BuildManifest
): Set<string> {
  const expected = new Set<string>();

  for (const output of manifest.outputs) {
    const outPath = output.outputPath;
    if (outPath === 'CLAUDE.md' && targets.includes('claude')) {
      expected.add(outPath);
    } else if (outPath === 'AGENTS.md' && targets.includes('agents')) {
      expected.add(outPath);
    } else if (outPath.startsWith('.cursor/rules/') && targets.includes('cursor')) {
      expected.add(outPath);
    }
  }

  return expected;
}

async function verifyAndHealOutputsForIncrementalSkip(
  projectRoot: string,
  targets: BuildTarget[],
  manifest: BuildManifest,
  ruleCount: number
): Promise<boolean> {
  const expected = filterExpectedOutputsForTargets(targets, manifest);

  // If user requests a target that has never been built (no outputs in manifest), we must build.
  if (targets.includes('claude') && !expected.has('CLAUDE.md')) return false;
  if (targets.includes('agents') && !expected.has('AGENTS.md')) return false;

  if (targets.includes('cursor')) {
    const hasAnyCursorOutput = Array.from(expected).some((p) => p.startsWith('.cursor/rules/'));
    if (ruleCount > 0 && !hasAnyCursorOutput) return false;
  }

  // Verify expected outputs are present and not tampered with
  for (const outPath of expected) {
    if (!(await verifyGeneratedOutputFile(projectRoot, outPath))) {
      return false;
    }
  }

  // Remove stale generated Cursor outputs (e.g., after a previous partial build)
  if (targets.includes('cursor')) {
    const expectedCursor = new Set<string>(
      Array.from(expected).filter((p) => p.startsWith('.cursor/rules/'))
    );
    const stale = await findStaleGeneratedCursorOutputs(projectRoot, expectedCursor);
    if (stale.length > 0) {
      for (const stalePath of stale) {
        try {
          await fs.promises.unlink(path.join(projectRoot, stalePath));
        } catch {
          return false;
        }
      }
    }
  }

  return true;
}

async function findStaleGeneratedCursorOutputs(
  projectRoot: string,
  expected: Set<string>
): Promise<string[]> {
  const cursorRulesDir = path.join(projectRoot, '.cursor', 'rules');
  const stale: string[] = [];

  if (!(await fileExists(cursorRulesDir))) {
    return stale;
  }

  let entries: string[];
  try {
    entries = await fs.promises.readdir(cursorRulesDir);
  } catch {
    return stale;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.mdc')) continue;
    const relPath = `.cursor/rules/${entry}`;

    if (expected.has(relPath)) continue;

    const fullPath = path.join(projectRoot, relPath);
    const content = await readFileOrNull(fullPath);
    if (content && hasBuildMetadataFooter(content)) {
      stale.push(relPath);
    }
  }

  return stale;
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
