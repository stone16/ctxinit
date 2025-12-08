import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { runVerify } from '../../src/cli/verify';

describe('Verify Command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'verify-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  function createFileWithChecksum(filePath: string, content: string): void {
    // The verify code calculates checksum on content WITHOUT the checksum comment
    // So we hash the content first, then append the checksum
    const hash = crypto.createHash('sha256').update(content + '\n').digest('hex');
    const fullContent = `${content}\n<!-- checksum: sha256:${hash} -->`;
    fs.writeFileSync(filePath, fullContent);
  }

  function createFileWithInvalidChecksum(filePath: string, content: string): void {
    const fakeHash = crypto.createHash('sha256').update('fake').digest('hex');
    const fullContent = `${content}\n<!-- checksum: sha256:${fakeHash} -->`;
    fs.writeFileSync(filePath, fullContent);
  }

  describe('runVerify', () => {
    it('should return success when no verifiable files found', async () => {
      const exitCode = await runVerify({});
      expect(exitCode).toBe(0);
    });

    it('should verify valid CLAUDE.md file', async () => {
      const content = '# Project Context\n\nSome content here.';
      createFileWithChecksum(path.join(tempDir, 'CLAUDE.md'), content);

      const exitCode = await runVerify({});
      expect(exitCode).toBe(0);
    });

    it('should detect tampered CLAUDE.md file', async () => {
      createFileWithInvalidChecksum(path.join(tempDir, 'CLAUDE.md'), '# Original content');

      // Modify file after creating
      const filePath = path.join(tempDir, 'CLAUDE.md');
      const currentContent = fs.readFileSync(filePath, 'utf-8');
      fs.writeFileSync(filePath, currentContent.replace('Original', 'Modified'));

      const exitCode = await runVerify({});
      expect(exitCode).toBe(1);
    });

    it('should verify valid AGENTS.md file', async () => {
      const content = '# Agent Context\n\nAgent instructions here.';
      createFileWithChecksum(path.join(tempDir, 'AGENTS.md'), content);

      const exitCode = await runVerify({});
      expect(exitCode).toBe(0);
    });

    it('should verify .mdc files in .cursor/rules directory', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.cursor', 'rules'), { recursive: true });

      const content = '---\ndescription: Test rule\n---\n\n# Rule content';
      createFileWithChecksum(path.join(tempDir, '.cursor', 'rules', 'test.mdc'), content);

      const exitCode = await runVerify({});
      expect(exitCode).toBe(0);
    });

    it('should verify multiple files at once', async () => {
      const claudeContent = '# Claude Context';
      const agentsContent = '# Agents Context';
      createFileWithChecksum(path.join(tempDir, 'CLAUDE.md'), claudeContent);
      createFileWithChecksum(path.join(tempDir, 'AGENTS.md'), agentsContent);

      const exitCode = await runVerify({});
      expect(exitCode).toBe(0);
    });

    it('should fail if any file is tampered', async () => {
      const claudeContent = '# Valid Claude Context';
      createFileWithChecksum(path.join(tempDir, 'CLAUDE.md'), claudeContent);
      createFileWithInvalidChecksum(path.join(tempDir, 'AGENTS.md'), '# Invalid content');

      const exitCode = await runVerify({});
      expect(exitCode).toBe(1);
    });

    it('should handle files without checksum', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# No checksum here');

      const exitCode = await runVerify({});
      // Files without checksums are skipped (not counted as failures)
      expect(exitCode).toBe(0);
    });

    it('should output JSON when --json flag is set', async () => {
      const content = '# Project Context';
      createFileWithChecksum(path.join(tempDir, 'CLAUDE.md'), content);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runVerify({ json: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      const jsonOutput = consoleSpy.mock.calls.find(call => {
        try {
          JSON.parse(call[0]);
          return true;
        } catch {
          return false;
        }
      });

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput![0]);
      expect(parsed.success).toBe(true);
      expect(parsed.filesVerified).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it('should show verbose output when --verbose flag is set', async () => {
      const content = '# Project Context';
      createFileWithChecksum(path.join(tempDir, 'CLAUDE.md'), content);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await runVerify({ verbose: true });

      const checksumOutput = consoleSpy.mock.calls.some(call =>
        call[0]?.includes?.('sha256:')
      );
      expect(checksumOutput).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
