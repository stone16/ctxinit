import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runHooks } from '../../src/cli/hooks';

// Mock inquirer to avoid interactive prompts
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ confirmInstall: true }),
}));

describe('Hooks Command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hooks-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Create package.json
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-project' }, null, 2)
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('runHooks install', () => {
    it('should create .husky directory and pre-commit hook', async () => {
      // Create .husky to simulate initialized state
      await fs.promises.mkdir(path.join(tempDir, '.husky'), { recursive: true });

      // Add husky to package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            devDependencies: { husky: '^9.0.0' },
          },
          null,
          2
        )
      );

      const exitCode = await runHooks({ install: true });

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, '.husky', 'pre-commit'))).toBe(true);
    });

    it('should skip if ctx hook already exists', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(
        path.join(huskyDir, 'pre-commit'),
        '#!/bin/sh\nctx build --incremental'
      );

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            devDependencies: { husky: '^9.0.0' },
          },
          null,
          2
        )
      );

      const exitCode = await runHooks({});

      expect(exitCode).toBe(0);
    });

    it('should update .gitignore with ctx entries', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            devDependencies: { husky: '^9.0.0' },
          },
          null,
          2
        )
      );

      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n');

      await runHooks({ install: true });

      const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignoreContent).toContain('.context/.build-manifest.json');
    });

    it('should dry-run without making changes', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            devDependencies: { husky: '^9.0.0' },
          },
          null,
          2
        )
      );

      const exitCode = await runHooks({ install: true, dryRun: true });

      expect(exitCode).toBe(0);
      // Should not create pre-commit hook in dry-run mode
      expect(fs.existsSync(path.join(tempDir, '.husky', 'pre-commit'))).toBe(false);
    });

    it('should skip gitignore updates when --skip-gitignore is set', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            devDependencies: { husky: '^9.0.0' },
          },
          null,
          2
        )
      );

      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n');

      await runHooks({ install: true, skipGitignore: true });

      const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignoreContent).not.toContain('.context/.build-manifest.json');
    });

    it('should force overwrite existing hook when --force is set', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(
        path.join(huskyDir, 'pre-commit'),
        '#!/bin/sh\nctx build --incremental'
      );

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            devDependencies: { husky: '^9.0.0' },
          },
          null,
          2
        )
      );

      const exitCode = await runHooks({ install: true, force: true });

      expect(exitCode).toBe(0);
      const hookContent = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
      expect(hookContent).toContain('ctx build');
    });
  });

  describe('runHooks remove', () => {
    it('should remove ctx hook from pre-commit', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(
        path.join(huskyDir, 'pre-commit'),
        '#!/bin/sh\nnpm test\n# ctx pre-commit\nctx build --incremental'
      );

      const exitCode = await runHooks({ remove: true });

      expect(exitCode).toBe(0);
      const hookContent = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
      expect(hookContent).toContain('npm test');
      expect(hookContent).not.toContain('ctx build');
    });

    it('should remove ctx entries from .gitignore', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.gitignore'),
        'node_modules/\n# ctx build artifacts\n.context/.build-manifest.json\n'
      );

      const exitCode = await runHooks({ remove: true });

      expect(exitCode).toBe(0);
      const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
      expect(gitignoreContent).toContain('node_modules/');
      expect(gitignoreContent).not.toContain('.build-manifest.json');
    });

    it('should handle remove when no hooks exist', async () => {
      const exitCode = await runHooks({ remove: true });
      expect(exitCode).toBe(0);
    });

    it('should dry-run remove without making changes', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });
      fs.writeFileSync(
        path.join(huskyDir, 'pre-commit'),
        '#!/bin/sh\nctx build --incremental'
      );

      const exitCode = await runHooks({ remove: true, dryRun: true });

      expect(exitCode).toBe(0);
      // Should still exist in dry-run mode
      const hookContent = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
      expect(hookContent).toContain('ctx build');
    });
  });

  describe('verbose output', () => {
    it('should show detailed output when --verbose is set', async () => {
      const huskyDir = path.join(tempDir, '.husky');
      await fs.promises.mkdir(huskyDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            devDependencies: { husky: '^9.0.0' },
          },
          null,
          2
        )
      );

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await runHooks({ install: true, verbose: true });

      const hasVerboseOutput = consoleSpy.mock.calls.some(
        (call) => call[0]?.includes?.('Husky status:') || call[0]?.includes?.('Installed:')
      );
      expect(hasVerboseOutput).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
