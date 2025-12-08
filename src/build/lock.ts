/**
 * Build Locking
 *
 * Prevents concurrent builds with:
 * - Lock file with pid, timestamp, hostname
 * - Stale lock detection (>5 minutes old)
 * - Automatic cleanup on build completion
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Lock file content structure
 */
export interface LockInfo {
  /** Process ID that holds the lock */
  pid: number;
  /** Timestamp when lock was acquired (Unix ms) */
  timestamp: number;
  /** Hostname of the machine holding the lock */
  hostname: string;
  /** Target being built */
  target: string;
}

/**
 * Lock acquisition result
 */
export interface LockResult {
  /** Whether lock was acquired */
  acquired: boolean;
  /** Path to lock file */
  lockPath: string;
  /** If not acquired, info about existing lock */
  existingLock?: LockInfo;
  /** If stale lock was removed */
  staleRemoved?: boolean;
}

/**
 * Default stale lock threshold (5 minutes in ms)
 */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Lock file name
 */
const LOCK_FILENAME = '.build.lock';

/**
 * Get lock file path
 *
 * @param projectRoot - Project root directory
 * @returns Lock file path
 */
export function getLockPath(projectRoot: string): string {
  return path.join(projectRoot, '.context', LOCK_FILENAME);
}

/**
 * Create lock info for current process
 *
 * @param target - Build target
 * @returns Lock info
 */
export function createLockInfo(target: string): LockInfo {
  return {
    pid: process.pid,
    timestamp: Date.now(),
    hostname: os.hostname(),
    target,
  };
}

/**
 * Read existing lock file
 *
 * @param lockPath - Path to lock file
 * @returns Lock info or null if not found/invalid
 */
export async function readLock(lockPath: string): Promise<LockInfo | null> {
  try {
    const content = await fs.promises.readFile(lockPath, 'utf-8');
    return JSON.parse(content) as LockInfo;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    // Invalid JSON or other error - treat as no lock
    return null;
  }
}

/**
 * Check if a lock is stale (older than threshold)
 *
 * @param lock - Lock info to check
 * @param thresholdMs - Stale threshold in milliseconds
 * @returns true if lock is stale
 */
export function isLockStale(lock: LockInfo, thresholdMs: number = STALE_THRESHOLD_MS): boolean {
  const age = Date.now() - lock.timestamp;
  return age > thresholdMs;
}

/**
 * Check if process with given PID is still running
 *
 * @param pid - Process ID to check
 * @returns true if process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // kill with signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means process exists but we don't have permission
    // ESRCH means process doesn't exist
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Acquire build lock
 *
 * @param projectRoot - Project root directory
 * @param target - Build target
 * @param staleThresholdMs - Stale lock threshold in milliseconds
 * @returns Lock acquisition result
 */
export async function acquireLock(
  projectRoot: string,
  target: string,
  staleThresholdMs: number = STALE_THRESHOLD_MS
): Promise<LockResult> {
  const lockPath = getLockPath(projectRoot);
  const lockDir = path.dirname(lockPath);

  // Ensure directory exists
  await fs.promises.mkdir(lockDir, { recursive: true });

  // Check for existing lock
  const existingLock = await readLock(lockPath);

  if (existingLock) {
    // Check if lock is stale
    if (isLockStale(existingLock, staleThresholdMs)) {
      // Remove stale lock
      try {
        await fs.promises.unlink(lockPath);
      } catch {
        // Ignore removal errors
      }

      // Try to acquire
      return await tryAcquireLock(lockPath, target, true);
    }

    // Check if holding process is still running (same hostname only)
    if (existingLock.hostname === os.hostname()) {
      if (!isProcessRunning(existingLock.pid)) {
        // Process is dead, remove lock
        try {
          await fs.promises.unlink(lockPath);
        } catch {
          // Ignore removal errors
        }

        // Try to acquire
        return await tryAcquireLock(lockPath, target, true);
      }
    }

    // Lock is active - cannot acquire
    return {
      acquired: false,
      lockPath,
      existingLock,
    };
  }

  // No existing lock - try to acquire
  return await tryAcquireLock(lockPath, target, false);
}

/**
 * Try to acquire the lock (internal helper)
 */
async function tryAcquireLock(
  lockPath: string,
  target: string,
  staleRemoved: boolean
): Promise<LockResult> {
  const lockInfo = createLockInfo(target);

  try {
    // Write lock file with exclusive flag
    const fd = await fs.promises.open(lockPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL);
    try {
      await fd.writeFile(JSON.stringify(lockInfo, null, 2), 'utf-8');
    } finally {
      await fd.close();
    }

    return {
      acquired: true,
      lockPath,
      staleRemoved,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      // Race condition - another process acquired the lock
      const existingLock = await readLock(lockPath);
      return {
        acquired: false,
        lockPath,
        existingLock: existingLock || undefined,
      };
    }
    throw error;
  }
}

/**
 * Release build lock
 *
 * @param projectRoot - Project root directory
 * @returns true if lock was released
 */
export async function releaseLock(projectRoot: string): Promise<boolean> {
  const lockPath = getLockPath(projectRoot);

  try {
    // Verify we own the lock before releasing
    const existingLock = await readLock(lockPath);

    if (!existingLock) {
      // Lock doesn't exist - nothing to release
      return false;
    }

    // Only release if we own the lock
    if (existingLock.pid !== process.pid || existingLock.hostname !== os.hostname()) {
      // We don't own this lock
      return false;
    }

    await fs.promises.unlink(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Format lock info for display
 *
 * @param lock - Lock info to format
 * @returns Human-readable lock description
 */
export function formatLockInfo(lock: LockInfo): string {
  const age = Date.now() - lock.timestamp;
  const ageStr = formatDuration(age);
  return `Build in progress by PID ${lock.pid} on ${lock.hostname} (${ageStr} ago) for target: ${lock.target}`;
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Create a lock guard for RAII-style lock management
 *
 * @param projectRoot - Project root directory
 * @param target - Build target
 * @returns Lock guard with release method
 */
export async function withLock<T>(
  projectRoot: string,
  target: string,
  fn: () => Promise<T>
): Promise<T> {
  const result = await acquireLock(projectRoot, target);

  if (!result.acquired) {
    throw new Error(
      result.existingLock
        ? `Build already in progress: ${formatLockInfo(result.existingLock)}`
        : 'Failed to acquire build lock'
    );
  }

  try {
    return await fn();
  } finally {
    await releaseLock(projectRoot);
  }
}
