import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runDiff } from '../../src/cli/diff';

describe('Diff Command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'diff-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('runDiff', () => {
    it('should require --legacy flag', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({});

      expect(exitCode).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--legacy')
      );

      consoleSpy.mockRestore();
    });

    it('should report no legacy files found when none exist', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No legacy files found')
      );

      consoleSpy.mockRestore();
    });

    it('should compare CLAUDE.md.legacy with CLAUDE.md', async () => {
      // Create legacy and compiled files
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md.legacy'), '# Old content');
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# New content');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true });

      expect(exitCode).toBe(0);
      // Should show both files exist
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('Legacy:')
      )).toBe(true);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('Compiled:')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should detect identical files', async () => {
      const content = '# Same content';
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md.legacy'), content);
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), content);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('identical')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should show differences between files', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md.legacy'), 'Line 1\nLine 2');
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), 'Line 1\nLine 3');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('differ')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should show detailed diff with --verbose flag', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md.legacy'), 'Old line');
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), 'New line');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true, verbose: true });

      expect(exitCode).toBe(0);
      // Should show actual diff lines with + and -
      const hasDiffOutput = consoleSpy.mock.calls.some(call => {
        const str = call[0]?.toString() || '';
        return str.includes('Old line') || str.includes('New line');
      });
      expect(hasDiffOutput).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle AGENTS.md comparison', async () => {
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md.legacy'), '# Agent rules');
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# New agent rules');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('AGENTS.md')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle .cursorrules vs .cursor/rules comparison', async () => {
      fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor rules');
      await fs.promises.mkdir(path.join(tempDir, '.cursor', 'rules'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, '.cursor', 'rules', 'test.mdc'), '---\ndescription: Test\n---\nContent');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('.cursorrules')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should report when compiled file is missing', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md.legacy'), '# Legacy content');
      // No CLAUDE.md exists

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true });

      expect(exitCode).toBe(1);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('ctx build')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should limit diff output for large differences', async () => {
      // Create files with many different lines
      const legacyLines = Array.from({ length: 100 }, (_, i) => `Legacy line ${i}`).join('\n');
      const compiledLines = Array.from({ length: 100 }, (_, i) => `Compiled line ${i}`).join('\n');

      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md.legacy'), legacyLines);
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), compiledLines);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runDiff({ legacy: true, verbose: true });

      expect(exitCode).toBe(0);
      // Should have truncation indicator
      const hasTruncation = consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('more lines')
      );
      expect(hasTruncation).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
