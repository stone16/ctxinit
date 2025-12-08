import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitignoreManager } from '../../src/git/gitignore';

describe('GitignoreManager', () => {
  let tempDir: string;
  let gitignoreManager: GitignoreManager;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gitignore-test-'));
    gitignoreManager = new GitignoreManager(tempDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('exists', () => {
    it('should return false when .gitignore does not exist', () => {
      expect(gitignoreManager.exists()).toBe(false);
    });

    it('should return true when .gitignore exists', () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '');
      expect(gitignoreManager.exists()).toBe(true);
    });
  });

  describe('read', () => {
    it('should return empty string when .gitignore does not exist', async () => {
      const content = await gitignoreManager.read();
      expect(content).toBe('');
    });

    it('should return content when .gitignore exists', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n.env');

      const content = await gitignoreManager.read();

      expect(content).toBe('node_modules/\n.env');
    });
  });

  describe('hasCtxEntries', () => {
    it('should return false when no ctx entries exist', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n.env');

      const hasEntries = await gitignoreManager.hasCtxEntries();

      expect(hasEntries).toBe(false);
    });

    it('should return true when ctx entries exist', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.gitignore'),
        'node_modules/\n.context/.build-manifest.json\n.env'
      );

      const hasEntries = await gitignoreManager.hasCtxEntries();

      expect(hasEntries).toBe(true);
    });
  });

  describe('getMissingEntries', () => {
    it('should return all default entries for empty .gitignore', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '');

      const missing = await gitignoreManager.getMissingEntries();

      expect(missing).toContain('.context/.build-manifest.json');
      expect(missing).toContain('.context/.build.lock');
    });

    it('should return empty array when all entries present', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.gitignore'),
        '.context/.build-manifest.json\n.context/.build.lock'
      );

      const missing = await gitignoreManager.getMissingEntries();

      expect(missing).toEqual([]);
    });

    it('should include compiled outputs when option is set', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '');

      const missing = await gitignoreManager.getMissingEntries({ ignoreCompiledOutputs: true });

      expect(missing).toContain('CLAUDE.md');
      expect(missing).toContain('AGENTS.md');
      expect(missing).toContain('.cursor/rules/');
    });
  });

  describe('addCtxEntries', () => {
    it('should add entries to empty .gitignore', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '');

      const result = await gitignoreManager.addCtxEntries();

      expect(result.added).toContain('.context/.build-manifest.json');
      expect(result.added).toContain('.context/.build.lock');

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('.context/.build-manifest.json');
      expect(content).toContain('.context/.build.lock');
    });

    it('should add entries to existing .gitignore', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n.env\n');

      await gitignoreManager.addCtxEntries();

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
      expect(content).toContain('.context/.build-manifest.json');
    });

    it('should skip existing entries', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.gitignore'),
        'node_modules/\n.context/.build-manifest.json'
      );

      const result = await gitignoreManager.addCtxEntries();

      expect(result.skipped).toContain('.context/.build-manifest.json');
      expect(result.added).toContain('.context/.build.lock');
    });

    it('should add compiled output entries when requested', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '');

      await gitignoreManager.addCtxEntries({ ignoreCompiledOutputs: true });

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('AGENTS.md');
      expect(content).toContain('.cursor/rules/');
    });

    it('should add header comment', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '');

      await gitignoreManager.addCtxEntries();

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('# ctx build artifacts');
    });
  });

  describe('removeCtxEntries', () => {
    it('should return empty array when .gitignore does not exist', async () => {
      const removed = await gitignoreManager.removeCtxEntries();

      expect(removed).toEqual([]);
    });

    it('should remove ctx entries', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.gitignore'),
        'node_modules/\n# ctx build artifacts\n.context/.build-manifest.json\n.context/.build.lock\n.env'
      );

      const removed = await gitignoreManager.removeCtxEntries();

      expect(removed).toContain('.context/.build-manifest.json');
      expect(removed).toContain('.context/.build.lock');

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
      expect(content).not.toContain('.build-manifest.json');
      expect(content).not.toContain('# ctx build artifacts');
    });

    it('should remove compiled output entries', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.gitignore'),
        'node_modules/\nCLAUDE.md\nAGENTS.md\n.cursor/rules/'
      );

      const removed = await gitignoreManager.removeCtxEntries();

      expect(removed).toContain('CLAUDE.md');
      expect(removed).toContain('AGENTS.md');
      expect(removed).toContain('.cursor/rules/');

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).not.toContain('CLAUDE.md');
      expect(content).not.toContain('AGENTS.md');
    });
  });

  describe('createWithCtxEntries', () => {
    it('should create .gitignore with ctx entries', async () => {
      const created = await gitignoreManager.createWithCtxEntries();

      expect(created).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.gitignore'))).toBe(true);

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('.context/.build-manifest.json');
      expect(content).toContain('.context/.build.lock');
    });

    it('should return false if .gitignore already exists', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'existing content');

      const created = await gitignoreManager.createWithCtxEntries();

      expect(created).toBe(false);
    });

    it('should include compiled outputs when requested', async () => {
      await gitignoreManager.createWithCtxEntries({ ignoreCompiledOutputs: true });

      const content = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(content).toContain('CLAUDE.md');
      expect(content).toContain('AGENTS.md');
      expect(content).toContain('.cursor/rules/');
    });
  });

  describe('getRecommendedEntries', () => {
    it('should return default recommended entries', () => {
      const entries = GitignoreManager.getRecommendedEntries();

      expect(entries).toContain('.context/.build-manifest.json');
      expect(entries).toContain('.context/.build.lock');
    });

    it('should include compiled outputs when requested', () => {
      const entries = GitignoreManager.getRecommendedEntries(true);

      expect(entries).toContain('CLAUDE.md');
    });
  });
});
