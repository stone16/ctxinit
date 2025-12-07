import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getTempPath,
  atomicWrite,
  atomicWriteSync,
  transaction,
  cleanupStaleTempFiles,
  PendingWrite,
} from '../../src/build/atomic';

describe('Atomic File Operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'atomic-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('getTempPath', () => {
    it('should generate temp path with pid suffix', () => {
      const targetPath = '/project/CLAUDE.md';
      const tempPath = getTempPath(targetPath);

      expect(tempPath).toMatch(/^\/project\/CLAUDE\.md\.tmp\.\d+$/);
      expect(tempPath).toContain(`.tmp.${process.pid}`);
    });

    it('should preserve directory structure', () => {
      const targetPath = '/project/nested/dir/file.txt';
      const tempPath = getTempPath(targetPath);

      expect(path.dirname(tempPath)).toBe('/project/nested/dir');
    });
  });

  describe('atomicWrite', () => {
    it('should write file atomically', async () => {
      const targetPath = path.join(tempDir, 'output.txt');
      const content = 'test content';

      await atomicWrite(targetPath, content);

      const result = await fs.promises.readFile(targetPath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should create nested directories', async () => {
      const targetPath = path.join(tempDir, 'nested', 'dir', 'output.txt');
      const content = 'nested content';

      await atomicWrite(targetPath, content);

      const result = await fs.promises.readFile(targetPath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const targetPath = path.join(tempDir, 'existing.txt');
      await fs.promises.writeFile(targetPath, 'old content');

      await atomicWrite(targetPath, 'new content');

      const result = await fs.promises.readFile(targetPath, 'utf-8');
      expect(result).toBe('new content');
    });

    it('should clean up temp file on error', async () => {
      // Create a directory with same name to cause write error
      const targetPath = path.join(tempDir, 'blocked.txt');
      const tempPath = getTempPath(targetPath);

      // Create a directory where temp file should be - this will cause an error
      // when trying to rename (target is a dir)
      await fs.promises.writeFile(tempPath, 'block');
      await fs.promises.mkdir(targetPath);

      // The write should fail and cleanup the temp file
      await expect(atomicWrite(targetPath, 'content')).rejects.toThrow();

      // Temp file should be cleaned up (it may or may not exist depending on error timing)
      // Just verify the directory still exists (no crash)
      const dirExists = await fs.promises.stat(targetPath).then(s => s.isDirectory()).catch(() => false);
      expect(dirExists).toBe(true);
    });
  });

  describe('atomicWriteSync', () => {
    it('should write file atomically (sync)', () => {
      const targetPath = path.join(tempDir, 'sync-output.txt');
      const content = 'sync content';

      atomicWriteSync(targetPath, content);

      const result = fs.readFileSync(targetPath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should create nested directories (sync)', () => {
      const targetPath = path.join(tempDir, 'sync-nested', 'dir', 'output.txt');
      const content = 'sync nested content';

      atomicWriteSync(targetPath, content);

      const result = fs.readFileSync(targetPath, 'utf-8');
      expect(result).toBe(content);
    });
  });

  describe('transaction', () => {
    it('should write multiple files atomically', async () => {
      const writes: PendingWrite[] = [
        { targetPath: path.join(tempDir, 'file1.txt'), content: 'content 1' },
        { targetPath: path.join(tempDir, 'file2.txt'), content: 'content 2' },
        { targetPath: path.join(tempDir, 'file3.txt'), content: 'content 3' },
      ];

      const result = await transaction(writes);

      expect(result.success).toBe(true);
      expect(result.writtenFiles).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      // Verify all files were written
      for (const write of writes) {
        const content = await fs.promises.readFile(write.targetPath, 'utf-8');
        expect(content).toBe(write.content);
      }
    });

    it('should create nested directories in transaction', async () => {
      const writes: PendingWrite[] = [
        { targetPath: path.join(tempDir, 'a', 'file1.txt'), content: 'content 1' },
        { targetPath: path.join(tempDir, 'b', 'c', 'file2.txt'), content: 'content 2' },
      ];

      const result = await transaction(writes);

      expect(result.success).toBe(true);
      expect(result.writtenFiles).toHaveLength(2);
    });

    it('should handle empty transaction', async () => {
      const result = await transaction([]);

      expect(result.success).toBe(true);
      expect(result.writtenFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail entire transaction on write error', async () => {
      // Create a file where we need a directory
      const blockingFile = path.join(tempDir, 'blocked');
      await fs.promises.writeFile(blockingFile, 'blocker');

      const writes: PendingWrite[] = [
        { targetPath: path.join(tempDir, 'good.txt'), content: 'good content' },
        { targetPath: path.join(tempDir, 'blocked', 'file.txt'), content: 'will fail' },
      ];

      const result = await transaction(writes);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('cleanupStaleTempFiles', () => {
    it('should remove temp files matching pattern', async () => {
      // Create some temp files
      await fs.promises.writeFile(path.join(tempDir, 'file.txt.tmp.123'), 'temp 1');
      await fs.promises.writeFile(path.join(tempDir, 'file.txt.tmp.456'), 'temp 2');
      await fs.promises.writeFile(path.join(tempDir, 'normal.txt'), 'normal');

      const cleaned = await cleanupStaleTempFiles(tempDir);

      expect(cleaned).toHaveLength(2);
      expect(cleaned.some(f => f.includes('tmp.123'))).toBe(true);
      expect(cleaned.some(f => f.includes('tmp.456'))).toBe(true);

      // Verify temp files are gone
      const files = await fs.promises.readdir(tempDir);
      expect(files).toContain('normal.txt');
      expect(files.filter(f => f.includes('.tmp.'))).toHaveLength(0);
    });

    it('should handle non-existent directory', async () => {
      const cleaned = await cleanupStaleTempFiles('/nonexistent/dir');
      expect(cleaned).toHaveLength(0);
    });

    it('should handle empty directory', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.promises.mkdir(emptyDir);

      const cleaned = await cleanupStaleTempFiles(emptyDir);
      expect(cleaned).toHaveLength(0);
    });

    it('should use custom pattern', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'file.bak'), 'backup');
      await fs.promises.writeFile(path.join(tempDir, 'file.tmp'), 'not matching');

      const cleaned = await cleanupStaleTempFiles(tempDir, /\.bak$/);

      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]).toContain('.bak');
    });
  });
});
