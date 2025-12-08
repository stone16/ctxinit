import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  contextExists,
  detectExistingFiles,
  initializeContext,
} from '../../src/cli/init';

describe('Init Command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'init-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('contextExists', () => {
    it('should return false when .context does not exist', () => {
      expect(contextExists(tempDir)).toBe(false);
    });

    it('should return true when .context exists', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.context'));
      expect(contextExists(tempDir)).toBe(true);
    });
  });

  describe('detectExistingFiles', () => {
    it('should detect no existing files', () => {
      const result = detectExistingFiles(tempDir);
      expect(result.cursorrules).toBe(false);
      expect(result.claudeMd).toBe(false);
      expect(result.agentsMd).toBe(false);
    });

    it('should detect .cursorrules', async () => {
      await fs.promises.writeFile(path.join(tempDir, '.cursorrules'), 'test');
      const result = detectExistingFiles(tempDir);
      expect(result.cursorrules).toBe(true);
      expect(result.claudeMd).toBe(false);
      expect(result.agentsMd).toBe(false);
    });

    it('should detect CLAUDE.md', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'CLAUDE.md'), 'test');
      const result = detectExistingFiles(tempDir);
      expect(result.cursorrules).toBe(false);
      expect(result.claudeMd).toBe(true);
      expect(result.agentsMd).toBe(false);
    });

    it('should detect AGENTS.md', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'AGENTS.md'), 'test');
      const result = detectExistingFiles(tempDir);
      expect(result.cursorrules).toBe(false);
      expect(result.claudeMd).toBe(false);
      expect(result.agentsMd).toBe(true);
    });

    it('should detect multiple existing files', async () => {
      await fs.promises.writeFile(path.join(tempDir, '.cursorrules'), 'test');
      await fs.promises.writeFile(path.join(tempDir, 'CLAUDE.md'), 'test');
      const result = detectExistingFiles(tempDir);
      expect(result.cursorrules).toBe(true);
      expect(result.claudeMd).toBe(true);
      expect(result.agentsMd).toBe(false);
    });
  });

  describe('initializeContext', () => {
    it('should create .context directory structure', async () => {
      const { created, skipped } = await initializeContext(tempDir, 'all');

      expect(created.length).toBeGreaterThan(0);
      expect(skipped.length).toBe(0);

      // Verify directories exist
      expect(fs.existsSync(path.join(tempDir, '.context'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.context', 'rules'))).toBe(true);

      // Verify files exist
      expect(fs.existsSync(path.join(tempDir, '.context', 'project.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.context', 'architecture.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.context', 'config.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.context', 'rules', 'example.md'))).toBe(true);
    });

    it('should generate config for all agents', async () => {
      await initializeContext(tempDir, 'all');

      const configPath = path.join(tempDir, '.context', 'config.yaml');
      const content = await fs.promises.readFile(configPath, 'utf-8');

      expect(content).toContain('claude');
      expect(content).toContain('cursor');
      expect(content).toContain('agents');
    });

    it('should generate config for cursor only', async () => {
      await initializeContext(tempDir, 'cursor');

      const configPath = path.join(tempDir, '.context', 'config.yaml');
      const content = await fs.promises.readFile(configPath, 'utf-8');

      expect(content).toContain('cursor');
      expect(content).not.toContain('claude:');
    });

    it('should generate config for claude only', async () => {
      await initializeContext(tempDir, 'claude');

      const configPath = path.join(tempDir, '.context', 'config.yaml');
      const content = await fs.promises.readFile(configPath, 'utf-8');

      expect(content).toContain('claude');
      expect(content).not.toContain('cursor:');
    });

    it('should skip existing files', async () => {
      // Create .context with some files
      await fs.promises.mkdir(path.join(tempDir, '.context', 'rules'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, '.context', 'project.md'),
        'existing content'
      );

      const result = await initializeContext(tempDir, 'all');

      expect(result.skipped).toContain(path.join(tempDir, '.context', 'project.md'));
      expect(result.created.length).toBeGreaterThan(0);

      // Verify existing file wasn't overwritten
      const content = await fs.promises.readFile(
        path.join(tempDir, '.context', 'project.md'),
        'utf-8'
      );
      expect(content).toBe('existing content');
    });

    it('should support dry run mode', async () => {
      const result = await initializeContext(tempDir, 'all', { dryRun: true });

      expect(result.created.length).toBeGreaterThan(0);
      expect(result.skipped.length).toBe(0);

      // Verify nothing was actually created
      expect(fs.existsSync(path.join(tempDir, '.context'))).toBe(false);
    });
  });
});
