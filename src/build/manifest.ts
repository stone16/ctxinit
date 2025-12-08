/**
 * Build Manifest
 *
 * Tracks file hashes and modification times for incremental builds.
 * Stored at `.context/.build-manifest.json`
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Entry for a tracked file in the manifest
 */
export interface ManifestEntry {
  /** SHA-256 content hash with "sha256:" prefix */
  hash: string;
  /** Last modification time (Unix timestamp in ms) */
  mtime: number;
  /** File size in bytes */
  size: number;
}

/**
 * Output dependency tracking
 */
export interface OutputDependency {
  /** Target output file path */
  outputPath: string;
  /** Source rule paths that contribute to this output */
  sourceRules: string[];
  /** Timestamp when output was generated */
  generatedAt: number;
}

/**
 * Build manifest structure
 */
export interface BuildManifest {
  /** Manifest version for compatibility */
  version: string;
  /** Timestamp of last successful build */
  lastBuildTime: number;
  /** Target that was built (cursor, claude, agents) */
  target: string;
  /** Source file entries (rule files, project.md, etc.) */
  sources: Record<string, ManifestEntry>;
  /** Config file hash */
  configHash: string;
  /** Output dependencies */
  outputs: OutputDependency[];
}

/**
 * Default manifest path
 */
const MANIFEST_FILENAME = '.build-manifest.json';

/**
 * Current manifest version
 */
const MANIFEST_VERSION = '1.0';

/**
 * Calculate SHA-256 hash of file content
 *
 * @param content - File content to hash
 * @returns Hash string with "sha256:" prefix
 */
export function calculateHash(content: string | Buffer): string {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Calculate SHA-256 hash of a file
 *
 * @param filePath - Path to file
 * @returns Hash string with "sha256:" prefix
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const content = await fs.promises.readFile(filePath);
  return calculateHash(content);
}

/**
 * Create a manifest entry for a file
 *
 * @param filePath - Path to file
 * @returns Manifest entry with hash, mtime, and size
 */
export async function createManifestEntry(filePath: string): Promise<ManifestEntry> {
  const stats = await fs.promises.stat(filePath);
  const content = await fs.promises.readFile(filePath);
  const hash = calculateHash(content);

  return {
    hash,
    mtime: stats.mtimeMs,
    size: stats.size,
  };
}

/**
 * Create an empty manifest
 *
 * @param target - Build target (cursor, claude, agents)
 * @returns Empty manifest
 */
export function createEmptyManifest(target: string): BuildManifest {
  return {
    version: MANIFEST_VERSION,
    lastBuildTime: 0,
    target,
    sources: {},
    configHash: '',
    outputs: [],
  };
}

/**
 * Get manifest file path
 *
 * @param projectRoot - Project root directory
 * @returns Manifest file path
 */
export function getManifestPath(projectRoot: string): string {
  return path.join(projectRoot, '.context', MANIFEST_FILENAME);
}

/**
 * Read manifest from disk
 *
 * @param projectRoot - Project root directory
 * @returns Manifest or null if not found
 */
export async function readManifest(projectRoot: string): Promise<BuildManifest | null> {
  const manifestPath = getManifestPath(projectRoot);

  try {
    const content = await fs.promises.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as BuildManifest;

    // Validate version
    if (manifest.version !== MANIFEST_VERSION) {
      return null; // Incompatible version, trigger full rebuild
    }

    return manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Write manifest to disk
 *
 * @param projectRoot - Project root directory
 * @param manifest - Manifest to write
 */
export async function writeManifest(projectRoot: string, manifest: BuildManifest): Promise<void> {
  const manifestPath = getManifestPath(projectRoot);
  const content = JSON.stringify(manifest, null, 2);
  await fs.promises.writeFile(manifestPath, content, 'utf-8');
}

/**
 * Check if a file has changed since last build
 *
 * Uses mtime for fast detection, falls back to hash comparison
 *
 * @param filePath - File to check
 * @param entry - Previous manifest entry
 * @returns true if file has changed
 */
export async function hasFileChanged(
  filePath: string,
  entry: ManifestEntry | undefined
): Promise<boolean> {
  if (!entry) {
    return true; // New file
  }

  try {
    const stats = await fs.promises.stat(filePath);

    // Fast path: mtime unchanged means file unchanged
    if (stats.mtimeMs === entry.mtime && stats.size === entry.size) {
      return false;
    }

    // Slow path: verify with hash
    const currentHash = await calculateFileHash(filePath);
    return currentHash !== entry.hash;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true; // File deleted
    }
    throw error;
  }
}

/**
 * Detect all changed files since last build
 *
 * @param projectRoot - Project root directory
 * @param currentFiles - Current source files
 * @param manifest - Previous build manifest
 * @returns Object with added, modified, and removed file lists
 */
export async function detectChanges(
  projectRoot: string,
  currentFiles: string[],
  manifest: BuildManifest
): Promise<{
  added: string[];
  modified: string[];
  removed: string[];
  unchanged: string[];
}> {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  // Check current files against manifest
  for (const file of currentFiles) {
    const relativePath = path.relative(projectRoot, file);
    const entry = manifest.sources[relativePath];

    if (!entry) {
      added.push(relativePath);
    } else if (await hasFileChanged(file, entry)) {
      modified.push(relativePath);
    } else {
      unchanged.push(relativePath);
    }
  }

  // Check for removed files
  const currentRelativePaths = new Set(
    currentFiles.map(f => path.relative(projectRoot, f))
  );

  for (const previousFile of Object.keys(manifest.sources)) {
    if (!currentRelativePaths.has(previousFile)) {
      removed.push(previousFile);
    }
  }

  return { added, modified, removed, unchanged };
}

/**
 * Update manifest with current file states
 *
 * @param projectRoot - Project root directory
 * @param files - Files to include in manifest
 * @param target - Build target
 * @param outputs - Output dependencies
 * @param configHash - Hash of config file
 * @returns Updated manifest
 */
export async function updateManifest(
  projectRoot: string,
  files: string[],
  target: string,
  outputs: OutputDependency[],
  configHash: string
): Promise<BuildManifest> {
  const sources: Record<string, ManifestEntry> = {};

  for (const file of files) {
    const relativePath = path.relative(projectRoot, file);
    sources[relativePath] = await createManifestEntry(file);
  }

  return {
    version: MANIFEST_VERSION,
    lastBuildTime: Date.now(),
    target,
    sources,
    configHash,
    outputs,
  };
}

/**
 * Find outputs affected by changed source files
 *
 * @param manifest - Build manifest
 * @param changedFiles - Files that have changed
 * @returns Output paths that need regeneration
 */
export function findAffectedOutputs(
  manifest: BuildManifest,
  changedFiles: string[]
): string[] {
  const changedSet = new Set(changedFiles);
  const affected: string[] = [];

  for (const output of manifest.outputs) {
    const hasChangedSource = output.sourceRules.some(
      source => changedSet.has(source)
    );
    if (hasChangedSource) {
      affected.push(output.outputPath);
    }
  }

  return affected;
}
