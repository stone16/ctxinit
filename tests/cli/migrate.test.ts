import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runMigrate } from '../../src/cli/migrate';

// Mock inquirer to avoid interactive prompts in tests
jest.mock('inquirer', () => ({
  default: {
    prompt: jest.fn().mockResolvedValue({ confirm: true }),
  },
}));

describe('Migrate Command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'migrate-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('runMigrate without flags', () => {
    it('should display usage help when no flags provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({});

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Migration Tool'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--analyze'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--attach'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--complete'));

      consoleSpy.mockRestore();
    });
  });

  describe('runMigrate --analyze', () => {
    it('should report no legacy files when none exist', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ analyze: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No legacy context files found'));

      consoleSpy.mockRestore();
    });

    it('should detect .cursorrules file', async () => {
      fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor rules\nSome content');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ analyze: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('.cursorrules')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should detect CLAUDE.md file', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Claude context');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ analyze: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('CLAUDE.md')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should detect AGENTS.md file', async () => {
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Agents context');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ analyze: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('AGENTS.md')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should detect multiple legacy files', async () => {
      fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Rules');
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Claude');
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Agents');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ analyze: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Found legacy context files'));

      consoleSpy.mockRestore();
    });

    it('should recommend attach mode for large files', async () => {
      // Create a large file (>50KB)
      const largeContent = 'x'.repeat(60 * 1024);
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), largeContent);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ analyze: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('Attach Mode')
      )).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should recommend direct migration for small files', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Small file');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ analyze: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy.mock.calls.some(call =>
        call[0]?.toString().includes('Direct Migration')
      )).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('runMigrate --attach', () => {
    it('should fail when no legacy files exist', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ attach: true });

      expect(exitCode).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No legacy files found'));

      consoleSpy.mockRestore();
    });

    it('should fail when .context already exists without --force', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy');
      await fs.promises.mkdir(path.join(tempDir, '.context'));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ attach: true });

      expect(exitCode).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('.context directory already exists'));

      consoleSpy.mockRestore();
    });

    it('should create .context directory in attach mode', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy content');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ attach: true });

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, '.context'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.context', 'rules'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should create legacy.md rule file from existing content', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy claude rules');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ attach: true });

      expect(exitCode).toBe(0);
      const legacyRulePath = path.join(tempDir, '.context', 'rules', 'legacy.md');
      expect(fs.existsSync(legacyRulePath)).toBe(true);

      const content = fs.readFileSync(legacyRulePath, 'utf-8');
      expect(content).toContain('Legacy claude rules');
      expect(content).toContain('From CLAUDE.md');

      consoleSpy.mockRestore();
    });

    it('should update config.yaml with migration settings', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ attach: true });

      expect(exitCode).toBe(0);
      const configPath = path.join(tempDir, '.context', 'config.yaml');
      const config = fs.readFileSync(configPath, 'utf-8');
      expect(config).toContain('migration:');
      expect(config).toContain('mode: attach');

      consoleSpy.mockRestore();
    });

    it('should import content from all legacy files', async () => {
      fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor content');
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Claude content');
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Agents content');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ attach: true });

      expect(exitCode).toBe(0);
      const legacyContent = fs.readFileSync(
        path.join(tempDir, '.context', 'rules', 'legacy.md'),
        'utf-8'
      );
      expect(legacyContent).toContain('Cursor content');
      expect(legacyContent).toContain('Claude content');
      expect(legacyContent).toContain('Agents content');

      consoleSpy.mockRestore();
    });

    it('should support dry run mode', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ attach: true, dryRun: true });

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, '.context'))).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Dry run'));

      consoleSpy.mockRestore();
    });
  });

  describe('runMigrate --complete', () => {
    it('should report no legacy files when none exist', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.context'));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ complete: true });

      expect(exitCode).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No legacy files to remove'));

      consoleSpy.mockRestore();
    });

    it('should fail when .context does not exist', async () => {
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ complete: true });

      expect(exitCode).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('.context directory not found'));

      consoleSpy.mockRestore();
    });

    it('should backup and remove legacy files with --force', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.context'));
      // Simulate post-attach state: .legacy backup files exist
      // CLAUDE.md and AGENTS.md are now generated files (not removed)
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md.legacy'), '# Legacy CLAUDE backup');
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md.legacy'), '# Legacy AGENTS backup');
      fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor rules');
      // Generated files should NOT be removed
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Generated by ctx build');
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Generated by ctx build');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ complete: true, force: true });

      expect(exitCode).toBe(0);
      // .legacy backup files should be removed
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md.legacy'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md.legacy'))).toBe(false);
      // .cursorrules should be removed
      expect(fs.existsSync(path.join(tempDir, '.cursorrules'))).toBe(false);
      // Generated files should NOT be removed
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);

      // Check backup directory was created
      const backupDirs = fs.readdirSync(tempDir).filter(f =>
        f.startsWith('.context-migration-backup-')
      );
      expect(backupDirs.length).toBe(1);

      // Check files were backed up
      const backupDir = path.join(tempDir, backupDirs[0]);
      expect(fs.existsSync(path.join(backupDir, 'CLAUDE.md.legacy'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'AGENTS.md.legacy'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, '.cursorrules'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should remove .cursorrules file', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.context'));
      fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Rules');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ complete: true, force: true });

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, '.cursorrules'))).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should support dry run mode', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.context'));
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ complete: true, dryRun: true });

      expect(exitCode).toBe(0);
      // File should still exist
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Dry run'));

      consoleSpy.mockRestore();
    });

    it('should update config.yaml to remove migration settings', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.context'));
      fs.writeFileSync(path.join(tempDir, '.context', 'config.yaml'), `
targets:
  claude:
    enabled: true

# Migration configuration
migration:
  mode: attach
  preserve_legacy: true
  legacy_files:
    - CLAUDE.md
`);
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Legacy');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await runMigrate({ complete: true, force: true });

      expect(exitCode).toBe(0);
      const config = fs.readFileSync(path.join(tempDir, '.context', 'config.yaml'), 'utf-8');
      expect(config).not.toContain('migration:');
      expect(config).not.toContain('mode: attach');

      consoleSpy.mockRestore();
    });
  });
});
