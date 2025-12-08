import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HuskyManager } from '../../src/git/husky';

describe('HuskyManager', () => {
  let tempDir: string;
  let huskyManager: HuskyManager;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'husky-test-'));
    huskyManager = new HuskyManager(tempDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('checkStatus', () => {
    it('should return all false for empty directory', async () => {
      const status = await huskyManager.checkStatus();

      expect(status.installed).toBe(false);
      expect(status.initialized).toBe(false);
      expect(status.hasPreCommitHook).toBe(false);
      expect(status.hasCtxHook).toBe(false);
    });

    it('should detect Husky in package.json devDependencies', async () => {
      const packageJson = {
        name: 'test',
        devDependencies: {
          husky: '^9.0.0',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const status = await huskyManager.checkStatus();

      expect(status.installed).toBe(true);
      expect(status.version).toBe('9.0.0');
    });

    it('should detect Husky in package.json dependencies', async () => {
      const packageJson = {
        name: 'test',
        dependencies: {
          husky: '~8.0.0',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const status = await huskyManager.checkStatus();

      expect(status.installed).toBe(true);
      expect(status.version).toBe('8.0.0');
    });

    it('should detect initialized .husky directory', async () => {
      await fs.promises.mkdir(path.join(tempDir, '.husky'), { recursive: true });

      const status = await huskyManager.checkStatus();

      expect(status.initialized).toBe(true);
    });

    it('should detect existing pre-commit hook', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(path.join(huskyDir, 'pre-commit'), '#!/bin/sh\necho "test"');

      const status = await huskyManager.checkStatus();

      expect(status.hasPreCommitHook).toBe(true);
      expect(status.hasCtxHook).toBe(false);
    });

    it('should detect ctx hook in pre-commit', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(path.join(huskyDir, 'pre-commit'), '#!/bin/sh\nnpx ctx build --incremental');

      const status = await huskyManager.checkStatus();

      expect(status.hasPreCommitHook).toBe(true);
      expect(status.hasCtxHook).toBe(true);
    });

    it('should handle malformed package.json gracefully', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), 'not valid json');

      const status = await huskyManager.checkStatus();

      expect(status.installed).toBe(false);
    });
  });

  describe('addPreCommitHook', () => {
    it('should create .husky directory if not exists', async () => {
      const hookContent = '#!/bin/sh\nctx build';

      const result = await huskyManager.addPreCommitHook(hookContent);

      expect(result).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.husky'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.husky', 'pre-commit'))).toBe(true);
    });

    it('should create pre-commit hook with content', async () => {
      const hookContent = '#!/bin/sh\nctx build --incremental';

      await huskyManager.addPreCommitHook(hookContent);

      const content = fs.readFileSync(path.join(tempDir, '.husky', 'pre-commit'), 'utf-8');
      expect(content).toContain('ctx build --incremental');
    });

    it('should append to existing pre-commit hook', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(path.join(huskyDir, 'pre-commit'), '#!/bin/sh\nnpm test');

      const hookContent = 'ctx build --incremental';
      await huskyManager.addPreCommitHook(hookContent);

      const content = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
      expect(content).toContain('npm test');
      expect(content).toContain('ctx build --incremental');
    });

    it('should not duplicate ctx hook if already present', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(path.join(huskyDir, 'pre-commit'), '#!/bin/sh\nctx build --incremental');

      const hookContent = 'ctx build --incremental';
      await huskyManager.addPreCommitHook(hookContent);

      const content = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
      const matches = content.match(/ctx build/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe('removeCtxHook', () => {
    it('should return true if no pre-commit hook exists', async () => {
      const result = await huskyManager.removeCtxHook();

      expect(result).toBe(true);
    });

    it('should remove ctx lines from pre-commit hook', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(
        path.join(huskyDir, 'pre-commit'),
        '#!/bin/sh\nnpm test\n# ctx pre-commit\nctx build --incremental'
      );

      await huskyManager.removeCtxHook();

      const content = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
      expect(content).toContain('npm test');
      expect(content).not.toContain('ctx build');
      expect(content).not.toContain('# ctx pre-commit');
    });

    it('should remove pre-commit file if empty after removal', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(path.join(huskyDir, 'pre-commit'), '#!/bin/sh\nctx build --incremental');

      await huskyManager.removeCtxHook();

      expect(fs.existsSync(path.join(huskyDir, 'pre-commit'))).toBe(false);
    });
  });
});
