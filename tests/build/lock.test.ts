import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getLockPath,
  createLockInfo,
  readLock,
  isLockStale,
  isProcessRunning,
  acquireLock,
  releaseLock,
  formatLockInfo,
  withLock,
  LockInfo,
} from '../../src/build/lock';

describe('Build Locking', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lock-test-'));
    await fs.promises.mkdir(path.join(tempDir, '.context'), { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('getLockPath', () => {
    it('should return path to .context/.build.lock', () => {
      const lockPath = getLockPath('/project');
      expect(lockPath).toBe('/project/.context/.build.lock');
    });
  });

  describe('createLockInfo', () => {
    it('should create lock info with current process details', () => {
      const lock = createLockInfo('claude');

      expect(lock.pid).toBe(process.pid);
      expect(lock.hostname).toBe(os.hostname());
      expect(lock.target).toBe('claude');
      expect(lock.timestamp).toBeGreaterThan(0);
      expect(lock.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('readLock', () => {
    it('should read existing lock file', async () => {
      const lockPath = getLockPath(tempDir);
      const lockInfo = createLockInfo('cursor');
      await fs.promises.writeFile(lockPath, JSON.stringify(lockInfo));

      const read = await readLock(lockPath);

      expect(read).toEqual(lockInfo);
    });

    it('should return null for non-existent lock', async () => {
      const lockPath = getLockPath(tempDir);
      const read = await readLock(lockPath);
      expect(read).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      const lockPath = getLockPath(tempDir);
      await fs.promises.writeFile(lockPath, 'invalid json');

      const read = await readLock(lockPath);
      expect(read).toBeNull();
    });
  });

  describe('isLockStale', () => {
    it('should return true for old locks', () => {
      const lock: LockInfo = {
        pid: 123,
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        hostname: 'test-host',
        target: 'claude',
      };

      expect(isLockStale(lock)).toBe(true);
    });

    it('should return false for recent locks', () => {
      const lock: LockInfo = {
        pid: 123,
        timestamp: Date.now() - 60 * 1000, // 1 minute ago
        hostname: 'test-host',
        target: 'claude',
      };

      expect(isLockStale(lock)).toBe(false);
    });

    it('should respect custom threshold', () => {
      const lock: LockInfo = {
        pid: 123,
        timestamp: Date.now() - 2000, // 2 seconds ago
        hostname: 'test-host',
        target: 'claude',
      };

      expect(isLockStale(lock, 1000)).toBe(true);
      expect(isLockStale(lock, 3000)).toBe(false);
    });
  });

  describe('isProcessRunning', () => {
    it('should return true for current process', () => {
      expect(isProcessRunning(process.pid)).toBe(true);
    });

    it('should return false for non-existent process', () => {
      // Use a very high PID that's unlikely to exist
      expect(isProcessRunning(999999999)).toBe(false);
    });
  });

  describe('acquireLock', () => {
    it('should acquire lock when none exists', async () => {
      const result = await acquireLock(tempDir, 'claude');

      expect(result.acquired).toBe(true);
      expect(result.lockPath).toBe(getLockPath(tempDir));

      // Verify lock file was created
      const lockContent = await fs.promises.readFile(result.lockPath, 'utf-8');
      const lock = JSON.parse(lockContent) as LockInfo;
      expect(lock.pid).toBe(process.pid);
      expect(lock.target).toBe('claude');
    });

    it('should fail to acquire when lock exists (different process)', async () => {
      // Create an existing lock from a "different" process
      const lockPath = getLockPath(tempDir);
      const existingLock: LockInfo = {
        pid: process.pid + 1, // Different PID
        timestamp: Date.now(),
        hostname: os.hostname(),
        target: 'cursor',
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(existingLock));

      const result = await acquireLock(tempDir, 'claude');

      expect(result.acquired).toBe(false);
      expect(result.existingLock).toBeDefined();
      expect(result.existingLock?.target).toBe('cursor');
    });

    it('should remove stale lock and acquire', async () => {
      // Create a stale lock
      const lockPath = getLockPath(tempDir);
      const staleLock: LockInfo = {
        pid: 999999,
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        hostname: os.hostname(),
        target: 'old-target',
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(staleLock));

      const result = await acquireLock(tempDir, 'claude');

      expect(result.acquired).toBe(true);
      expect(result.staleRemoved).toBe(true);
    });

    it('should remove lock from dead process', async () => {
      // Create a lock from a dead process
      const lockPath = getLockPath(tempDir);
      const deadProcessLock: LockInfo = {
        pid: 999999, // Very unlikely to be running
        timestamp: Date.now() - 1000, // Recent but dead process
        hostname: os.hostname(),
        target: 'dead-target',
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(deadProcessLock));

      const result = await acquireLock(tempDir, 'claude');

      expect(result.acquired).toBe(true);
      expect(result.staleRemoved).toBe(true);
    });
  });

  describe('releaseLock', () => {
    it('should release lock owned by current process', async () => {
      // First acquire the lock
      await acquireLock(tempDir, 'claude');

      const released = await releaseLock(tempDir);

      expect(released).toBe(true);

      // Verify lock file is gone
      const exists = await fs.promises.access(getLockPath(tempDir)).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should not release lock owned by different process', async () => {
      // Create a lock from a different process
      const lockPath = getLockPath(tempDir);
      const otherLock: LockInfo = {
        pid: process.pid + 1,
        timestamp: Date.now(),
        hostname: os.hostname(),
        target: 'other',
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(otherLock));

      const released = await releaseLock(tempDir);

      expect(released).toBe(false);

      // Lock should still exist
      const exists = await fs.promises.access(lockPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should return false when no lock exists', async () => {
      const released = await releaseLock(tempDir);
      expect(released).toBe(false);
    });
  });

  describe('formatLockInfo', () => {
    it('should format lock info for display', () => {
      const lock: LockInfo = {
        pid: 12345,
        timestamp: Date.now() - 120000, // 2 minutes ago
        hostname: 'build-server',
        target: 'claude',
      };

      const formatted = formatLockInfo(lock);

      expect(formatted).toContain('PID 12345');
      expect(formatted).toContain('build-server');
      expect(formatted).toContain('claude');
      expect(formatted).toMatch(/\d+m.*\d+s.*ago/);
    });
  });

  describe('withLock', () => {
    it('should execute function with lock held', async () => {
      let executed = false;

      await withLock(tempDir, 'claude', async () => {
        executed = true;

        // Verify lock is held during execution
        const lockExists = await fs.promises.access(getLockPath(tempDir)).then(() => true).catch(() => false);
        expect(lockExists).toBe(true);
      });

      expect(executed).toBe(true);

      // Verify lock is released after execution
      const lockExists = await fs.promises.access(getLockPath(tempDir)).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('should release lock even on error', async () => {
      await expect(
        withLock(tempDir, 'claude', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Verify lock is released
      const lockExists = await fs.promises.access(getLockPath(tempDir)).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('should throw when lock cannot be acquired', async () => {
      // Create an existing active lock
      const lockPath = getLockPath(tempDir);
      const activeLock: LockInfo = {
        pid: process.pid + 1,
        timestamp: Date.now(),
        hostname: os.hostname(),
        target: 'other',
      };
      await fs.promises.writeFile(lockPath, JSON.stringify(activeLock));

      await expect(
        withLock(tempDir, 'claude', async () => {
          return 'should not execute';
        })
      ).rejects.toThrow(/Build already in progress/);
    });

    it('should return function result', async () => {
      const result = await withLock(tempDir, 'claude', async () => {
        return 'test result';
      });

      expect(result).toBe('test result');
    });
  });
});
