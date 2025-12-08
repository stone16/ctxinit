/**
 * Gitignore Manager
 *
 * Manages .gitignore entries for ctx build artifacts.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Gitignore management options
 */
export interface GitignoreOptions {
  /** Ignore build manifest (default: true) */
  ignoreBuildManifest?: boolean;
  /** Ignore build lock file (default: true) */
  ignoreBuildLock?: boolean;
  /** Ignore compiled outputs - only if user wants source-of-truth in .context/ */
  ignoreCompiledOutputs?: boolean;
}

/**
 * Default entries to add to .gitignore
 */
const DEFAULT_IGNORE_ENTRIES = [
  '# ctx build artifacts',
  '.context/.build-manifest.json',
  '.context/.build.lock',
];

/**
 * Optional entries for compiled outputs
 */
const COMPILED_OUTPUT_ENTRIES = [
  '# ctx compiled outputs (source of truth is in .context/)',
  '# Uncomment if you want to ignore compiled files:',
  '# CLAUDE.md',
  '# AGENTS.md',
  '# .cursor/rules/',
];

/**
 * Gitignore Manager class
 */
export class GitignoreManager {
  private gitignorePath: string;

  constructor(projectRoot: string) {
    this.gitignorePath = path.join(projectRoot, '.gitignore');
  }

  /**
   * Check if .gitignore exists
   */
  exists(): boolean {
    return fs.existsSync(this.gitignorePath);
  }

  /**
   * Read current .gitignore content
   */
  async read(): Promise<string> {
    if (!this.exists()) {
      return '';
    }
    return fs.promises.readFile(this.gitignorePath, 'utf-8');
  }

  /**
   * Check if ctx entries are already present
   */
  async hasCtxEntries(): Promise<boolean> {
    const content = await this.read();
    return content.includes('.context/.build-manifest.json');
  }

  /**
   * Get entries that need to be added
   */
  async getMissingEntries(options: GitignoreOptions = {}): Promise<string[]> {
    const {
      ignoreBuildManifest = true,
      ignoreBuildLock = true,
      ignoreCompiledOutputs = false,
    } = options;

    const content = await this.read();
    const lines = content.split('\n');
    const missing: string[] = [];

    // Check default entries
    if (ignoreBuildManifest && !lines.some((l) => l.includes('.build-manifest.json'))) {
      missing.push('.context/.build-manifest.json');
    }
    if (ignoreBuildLock && !lines.some((l) => l.includes('.build.lock'))) {
      missing.push('.context/.build.lock');
    }

    // Check compiled output entries if requested
    if (ignoreCompiledOutputs) {
      if (!lines.some((l) => l.trim() === 'CLAUDE.md')) {
        missing.push('CLAUDE.md');
      }
      if (!lines.some((l) => l.trim() === 'AGENTS.md')) {
        missing.push('AGENTS.md');
      }
      if (!lines.some((l) => l.includes('.cursor/rules'))) {
        missing.push('.cursor/rules/');
      }
    }

    return missing;
  }

  /**
   * Add ctx entries to .gitignore
   */
  async addCtxEntries(options: GitignoreOptions = {}): Promise<{ added: string[]; skipped: string[] }> {
    const {
      ignoreBuildManifest = true,
      ignoreBuildLock = true,
      ignoreCompiledOutputs = false,
    } = options;

    const added: string[] = [];
    const skipped: string[] = [];

    let content = await this.read();
    const lines = content.split('\n');

    // Build entries to add
    const entriesToAdd: string[] = [];

    // Add header if no ctx entries exist
    if (!content.includes('# ctx')) {
      entriesToAdd.push('');
      entriesToAdd.push('# ctx build artifacts');
    }

    // Add build manifest
    if (ignoreBuildManifest) {
      if (!lines.some((l) => l.includes('.build-manifest.json'))) {
        entriesToAdd.push('.context/.build-manifest.json');
        added.push('.context/.build-manifest.json');
      } else {
        skipped.push('.context/.build-manifest.json');
      }
    }

    // Add build lock
    if (ignoreBuildLock) {
      if (!lines.some((l) => l.includes('.build.lock'))) {
        entriesToAdd.push('.context/.build.lock');
        added.push('.context/.build.lock');
      } else {
        skipped.push('.context/.build.lock');
      }
    }

    // Add compiled outputs if requested
    if (ignoreCompiledOutputs) {
      if (!content.includes('# ctx compiled outputs')) {
        entriesToAdd.push('');
        entriesToAdd.push('# ctx compiled outputs');
      }

      if (!lines.some((l) => l.trim() === 'CLAUDE.md')) {
        entriesToAdd.push('CLAUDE.md');
        added.push('CLAUDE.md');
      } else {
        skipped.push('CLAUDE.md');
      }

      if (!lines.some((l) => l.trim() === 'AGENTS.md')) {
        entriesToAdd.push('AGENTS.md');
        added.push('AGENTS.md');
      } else {
        skipped.push('AGENTS.md');
      }

      if (!lines.some((l) => l.includes('.cursor/rules'))) {
        entriesToAdd.push('.cursor/rules/');
        added.push('.cursor/rules/');
      } else {
        skipped.push('.cursor/rules/');
      }
    }

    // Write updates if there are entries to add
    if (entriesToAdd.length > 0) {
      // Ensure content ends with newline
      if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
      }

      content += entriesToAdd.join('\n') + '\n';
      await fs.promises.writeFile(this.gitignorePath, content, 'utf-8');
    }

    return { added, skipped };
  }

  /**
   * Remove ctx entries from .gitignore
   */
  async removeCtxEntries(): Promise<string[]> {
    if (!this.exists()) {
      return [];
    }

    const content = await this.read();
    const lines = content.split('\n');
    const removed: string[] = [];

    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();

      // Remove ctx comments
      if (trimmed.startsWith('# ctx')) {
        return false;
      }

      // Remove ctx-specific entries
      if (
        trimmed === '.context/.build-manifest.json' ||
        trimmed === '.context/.build.lock' ||
        trimmed === 'CLAUDE.md' ||
        trimmed === 'AGENTS.md' ||
        trimmed === '.cursor/rules/' ||
        trimmed === '.cursor/rules'
      ) {
        removed.push(trimmed);
        return false;
      }

      return true;
    });

    // Write back
    await fs.promises.writeFile(this.gitignorePath, filteredLines.join('\n'), 'utf-8');

    return removed;
  }

  /**
   * Create .gitignore with ctx entries if it doesn't exist
   */
  async createWithCtxEntries(options: GitignoreOptions = {}): Promise<boolean> {
    if (this.exists()) {
      return false;
    }

    const {
      ignoreBuildManifest = true,
      ignoreBuildLock = true,
      ignoreCompiledOutputs = false,
    } = options;

    const lines: string[] = [];

    lines.push('# ctx build artifacts');
    if (ignoreBuildManifest) {
      lines.push('.context/.build-manifest.json');
    }
    if (ignoreBuildLock) {
      lines.push('.context/.build.lock');
    }

    if (ignoreCompiledOutputs) {
      lines.push('');
      lines.push('# ctx compiled outputs');
      lines.push('CLAUDE.md');
      lines.push('AGENTS.md');
      lines.push('.cursor/rules/');
    }

    lines.push('');

    await fs.promises.writeFile(this.gitignorePath, lines.join('\n'), 'utf-8');
    return true;
  }

  /**
   * Get recommended .gitignore entries as a string
   */
  static getRecommendedEntries(includeCompiledOutputs = false): string {
    const lines = [...DEFAULT_IGNORE_ENTRIES];

    if (includeCompiledOutputs) {
      lines.push('');
      lines.push(...COMPILED_OUTPUT_ENTRIES);
    }

    return lines.join('\n');
  }
}
