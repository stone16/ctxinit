import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CursorCompiler } from '../../src/compiler/cursor-compiler';
import { CompilerContext } from '../../src/compiler/base-compiler';
import { ParsedRule } from '../../src/schemas/rule';
import { Config } from '../../src/schemas/config';

// Helper to create mock rule
function createMockRule(overrides: Partial<ParsedRule['frontmatter']> & { rulePath?: string } = {}): ParsedRule {
  const { rulePath, ...frontmatterOverrides } = overrides;
  const id = frontmatterOverrides.id || 'test-rule';
  return {
    frontmatter: {
      id,
      description: 'A test rule',
      priority: 50,
      tags: [],
      always_apply: false,
      ...frontmatterOverrides,
    },
    content: 'Rule content here.',
    path: rulePath || `${id}.md`,
    absolutePath: `/project/.context/rules/${rulePath || `${id}.md`}`,
    inferredGlobs: ['**/*'],
    effectiveGlobs: frontmatterOverrides.globs
      ? (Array.isArray(frontmatterOverrides.globs) ? frontmatterOverrides.globs : [frontmatterOverrides.globs])
      : ['**/*'],
  };
}

describe('CursorCompiler', () => {
  let tempDir: string;
  let compiler: CursorCompiler;
  let context: CompilerContext;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-compiler-test-'));

    // Create .context directory structure
    const contextDir = path.join(tempDir, '.context');
    fs.mkdirSync(contextDir, { recursive: true });
    fs.mkdirSync(path.join(contextDir, 'rules'), { recursive: true });

    // Create project.md
    fs.writeFileSync(
      path.join(contextDir, 'project.md'),
      '# Test Project\n\nThis is a test project.'
    );

    context = {
      projectRoot: tempDir,
      config: {
        version: '1.0',
        compile: {
          cursor: {
            strategy: 'priority',
          },
        },
        conflict_resolution: {
          strategy: 'priority_wins',
        },
      } as Config,
      rules: [],
    };

    compiler = new CursorCompiler(context);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('targetName', () => {
    it('should return cursor', () => {
      expect(compiler.targetName).toBe('cursor');
    });
  });

  describe('compile', () => {
    it('should compile rules to .mdc files', async () => {
      context.rules = [
        createMockRule({ id: 'auth-rule', description: 'Authentication rule' }),
        createMockRule({ id: 'api-rule', description: 'API rule' }),
      ];

      const result = await compiler.compile();

      expect(result.success).toBe(true);
      expect(result.outputs.length).toBe(2);
      expect(result.outputs[0].path).toMatch(/\.mdc$/);
      expect(result.outputs[1].path).toMatch(/\.mdc$/);
    });

    it('should create .cursor/rules directory', async () => {
      context.rules = [createMockRule({ id: 'test-rule' })];

      await compiler.compile();

      const cursorRulesDir = path.join(tempDir, '.cursor', 'rules');
      expect(fs.existsSync(cursorRulesDir)).toBe(true);
    });

    it('should generate proper .mdc file content', async () => {
      context.rules = [
        createMockRule({
          id: 'auth-rule',
          description: 'Authentication rule',
          globs: ['src/auth/**/*'],
          always_apply: false,
        }),
      ];

      const result = await compiler.compile();

      expect(result.success).toBe(true);
      const output = result.outputs[0];

      // Check frontmatter
      expect(output.content).toContain('---');
      expect(output.content).toContain('description:');
      expect(output.content).toContain('globs:');
      expect(output.content).toContain('alwaysApply:');
    });

    it('should handle nested directory paths in filenames', async () => {
      const rule = createMockRule({ id: 'backend-auth', rulePath: 'backend/auth.md' });
      context.rules = [rule];

      const result = await compiler.compile();

      expect(result.success).toBe(true);
      expect(result.outputs[0].path).toContain('backend-auth');
    });

    it('should track token usage', async () => {
      context.rules = [
        createMockRule({ id: 'rule-1' }),
        createMockRule({ id: 'rule-2' }),
      ];

      const result = await compiler.compile();

      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.stats.totalTokens).toBeGreaterThan(0);
    });

    it('should report statistics', async () => {
      context.rules = [
        createMockRule({ id: 'rule-1' }),
        createMockRule({ id: 'rule-2' }),
        createMockRule({ id: 'rule-3' }),
      ];

      const result = await compiler.compile();

      expect(result.stats.rulesProcessed).toBe(3);
      expect(result.stats.rulesIncluded).toBeGreaterThan(0);
      expect(result.stats.outputFiles).toBe(result.outputs.length);
    });

    it('should handle empty rules array', async () => {
      context.rules = [];

      const result = await compiler.compile();

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(0);
      expect(result.stats.rulesProcessed).toBe(0);
    });
  });

  describe('file naming', () => {
    it('should convert nested paths to hyphenated names', async () => {
      const rule = createMockRule({ id: 'deep-nested', rulePath: 'backend/auth/login.md' });
      context.rules = [rule];

      const result = await compiler.compile();

      expect(result.outputs[0].path).toContain('backend-auth-login');
    });

    it('should use .mdc extension', async () => {
      context.rules = [createMockRule({ id: 'test-rule' })];

      const result = await compiler.compile();

      expect(result.outputs[0].path).toMatch(/\.mdc$/);
    });
  });

  describe('frontmatter generation', () => {
    it('should include description', async () => {
      context.rules = [
        createMockRule({
          id: 'test',
          description: 'Test description here',
        }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Test description here');
    });

    it('should include globs when present', async () => {
      context.rules = [
        createMockRule({
          id: 'test',
          globs: ['src/**/*.ts', 'lib/**/*.ts'],
        }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('src/**/*.ts');
      expect(result.outputs[0].content).toContain('lib/**/*.ts');
    });

    it('should include alwaysApply flag', async () => {
      context.rules = [
        createMockRule({
          id: 'always-rule',
          always_apply: true,
        }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('alwaysApply: true');
    });
  });
});
