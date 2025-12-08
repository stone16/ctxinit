/**
 * Atomic File Operations
 *
 * Provides safe file writing with:
 * - Temp file → atomic rename pattern
 * - Multi-file transactions (all-or-nothing)
 * - Cleanup on error
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Pending file write in a transaction
 */
export interface PendingWrite {
  /** Target file path */
  targetPath: string;
  /** Content to write */
  content: string;
  /** Temp file path (set during write) */
  tempPath?: string;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  /** Whether all files were written successfully */
  success: boolean;
  /** Files that were successfully written */
  writtenFiles: string[];
  /** Errors encountered */
  errors: Array<{ path: string; error: Error }>;
}

/**
 * Generate temp file path for atomic write
 *
 * @param targetPath - Target file path
 * @returns Temp file path with pid suffix
 */
export function getTempPath(targetPath: string): string {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  return path.join(dir, `${base}.tmp.${process.pid}`);
}

/**
 * Write file atomically using temp file + rename
 *
 * @param targetPath - Target file path
 * @param content - Content to write
 * @throws Error if write or rename fails
 */
export async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const tempPath = getTempPath(targetPath);
  const dir = path.dirname(targetPath);

  // Ensure directory exists
  await fs.promises.mkdir(dir, { recursive: true });

  try {
    // Write to temp file
    await fs.promises.writeFile(tempPath, content, 'utf-8');

    // Atomic rename
    await fs.promises.rename(tempPath, targetPath);
  } catch (error) {
    // Cleanup temp file on error
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Write file atomically (synchronous version)
 *
 * @param targetPath - Target file path
 * @param content - Content to write
 * @throws Error if write or rename fails
 */
export function atomicWriteSync(targetPath: string, content: string): void {
  const tempPath = getTempPath(targetPath);
  const dir = path.dirname(targetPath);

  // Ensure directory exists
  fs.mkdirSync(dir, { recursive: true });

  try {
    // Write to temp file
    fs.writeFileSync(tempPath, content, 'utf-8');

    // Atomic rename
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    // Cleanup temp file on error
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Execute a multi-file transaction (all-or-nothing)
 *
 * If any file fails to write, all temp files are cleaned up
 * and no target files are modified.
 *
 * @param writes - Array of pending writes
 * @returns Transaction result
 */
export async function transaction(writes: PendingWrite[]): Promise<TransactionResult> {
  const result: TransactionResult = {
    success: false,
    writtenFiles: [],
    errors: [],
  };

  // Track temp files for cleanup
  const tempFiles: string[] = [];

  try {
    // Phase 1: Write all temp files
    for (const write of writes) {
      const tempPath = getTempPath(write.targetPath);
      const dir = path.dirname(write.targetPath);

      try {
        // Ensure directory exists
        await fs.promises.mkdir(dir, { recursive: true });

        // Write to temp file
        await fs.promises.writeFile(tempPath, write.content, 'utf-8');
        write.tempPath = tempPath;
        tempFiles.push(tempPath);
      } catch (error) {
        result.errors.push({
          path: write.targetPath,
          error: error as Error,
        });
        // Cleanup all temp files on any error
        await cleanupTempFiles(tempFiles);
        return result;
      }
    }

    // Phase 2: Atomic rename all files
    for (const write of writes) {
      if (!write.tempPath) continue;

      try {
        await fs.promises.rename(write.tempPath, write.targetPath);
        result.writtenFiles.push(write.targetPath);
      } catch (error) {
        result.errors.push({
          path: write.targetPath,
          error: error as Error,
        });
        // Cleanup remaining temp files
        const remaining = tempFiles.filter(
          tf => !result.writtenFiles.some(wf => getTempPath(wf) === tf)
        );
        await cleanupTempFiles(remaining);
        return result;
      }
    }

    result.success = true;
    return result;
  } catch (error) {
    // Unexpected error - cleanup all temp files
    await cleanupTempFiles(tempFiles);
    result.errors.push({
      path: 'transaction',
      error: error as Error,
    });
    return result;
  }
}

/**
 * Cleanup temp files
 *
 * @param tempFiles - Array of temp file paths to cleanup
 */
async function cleanupTempFiles(tempFiles: string[]): Promise<void> {
  for (const tempPath of tempFiles) {
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Cleanup stale temp files from a previous crashed build
 *
 * @param directory - Directory to scan for temp files
 * @param pattern - Pattern to match temp files (default: *.tmp.*)
 */
export async function cleanupStaleTempFiles(
  directory: string,
  pattern: RegExp = /\.tmp\.\d+$/
): Promise<string[]> {
  const cleaned: string[] = [];

  try {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && pattern.test(entry.name)) {
        const filePath = path.join(directory, entry.name);
        try {
          await fs.promises.unlink(filePath);
          cleaned.push(filePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }

  return cleaned;
}
