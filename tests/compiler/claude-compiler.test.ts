import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClaudeCompiler } from '../../src/compiler/claude-compiler';
import { CompilerContext } from '../../src/compiler/base-compiler';
import { ParsedRule } from '../../src/schemas/rule';
import { Config } from '../../src/schemas/config';

// Helper to create mock rule
function createMockRule(overrides: Partial<ParsedRule['frontmatter']> & { rulePath?: string; content?: string } = {}): ParsedRule {
  const { rulePath, content = 'Rule content here.', ...frontmatterOverrides } = overrides;
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
    content,
    path: rulePath || `${id}.md`,
    absolutePath: `/project/.context/rules/${rulePath || `${id}.md`}`,
    inferredGlobs: ['**/*'],
    effectiveGlobs: ['**/*'],
  };
}

describe('ClaudeCompiler', () => {
  let tempDir: string;
  let compiler: ClaudeCompiler;
  let context: CompilerContext;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-compiler-test-'));

    // Create .context directory structure
    const contextDir = path.join(tempDir, '.context');
    fs.mkdirSync(contextDir, { recursive: true });
    fs.mkdirSync(path.join(contextDir, 'rules'), { recursive: true });

    // Create project.md (required)
    fs.writeFileSync(
      path.join(contextDir, 'project.md'),
      '# Test Project\n\nThis is a test project description.'
    );

    context = {
      projectRoot: tempDir,
      config: {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      } as Config,
      rules: [],
    };

    compiler = new ClaudeCompiler(context);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('targetName', () => {
    it('should return claude', () => {
      expect(compiler.targetName).toBe('claude');
    });
  });

  describe('compile', () => {
    it('should compile to single CLAUDE.md file', async () => {
      context.rules = [
        createMockRule({ id: 'rule-1' }),
        createMockRule({ id: 'rule-2' }),
      ];

      const result = await compiler.compile();

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].path).toBe('CLAUDE.md');
    });

    it('should include project content', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Test Project');
      expect(result.outputs[0].content).toContain('test project description');
    });

    it('should include architecture content when available', async () => {
      // Create architecture.md
      fs.writeFileSync(
        path.join(tempDir, '.context', 'architecture.md'),
        '# Architecture\n\nMicroservices architecture.'
      );

      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Architecture');
      expect(result.outputs[0].content).toContain('Microservices');
    });

    it('should fail when project.md is missing', async () => {
      // Remove project.md
      fs.unlinkSync(path.join(tempDir, '.context', 'project.md'));

      const result = await compiler.compile();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('missing_file');
    });

    it('should include meta-rule', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Context Hygiene');
    });

    it('should include directory index', async () => {
      const rule = createMockRule({ id: 'backend-auth', rulePath: 'backend/auth.md' });
      context.rules = [rule];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Directory');
    });

    it('should respect token budget', async () => {
      const rules = Array.from({ length: 20 }, (_, i) => {
        return createMockRule({ id: `rule-${i}`, content: 'x'.repeat(500) });
      });

      context.config.compile!.claude!.max_tokens = 500;
      context.rules = rules;

      const result = await compiler.compile();

      expect(result.stats.tokenBudget).toBe(500);
      expect(result.stats.rulesIncluded).toBeLessThan(rules.length);
    });

    it('should prioritize always-apply rules', async () => {
      context.rules = [
        createMockRule({ id: 'conditional', always_apply: false, priority: 20 }),
        createMockRule({ id: 'always', always_apply: true, priority: 20 }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('always');
    });

    it('should include rule descriptions', async () => {
      context.rules = [
        createMockRule({
          id: 'auth-rule',
          description: 'Authentication security guidelines',
        }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Authentication security guidelines');
    });

    it('should track statistics', async () => {
      context.rules = [
        createMockRule({ id: 'rule-1' }),
        createMockRule({ id: 'rule-2' }),
      ];

      const result = await compiler.compile();

      expect(result.stats.rulesProcessed).toBe(2);
      expect(result.stats.outputFiles).toBe(1);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('should warn when architecture.md is missing', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();

      expect(result.warnings.some(w => w.type === 'missing_optional')).toBe(true);
    });

    it('should warn when no rules selected due to budget', async () => {
      const rule = createMockRule({ id: 'large', always_apply: false, content: 'x'.repeat(10000) });
      context.rules = [rule];
      context.config.compile!.claude!.max_tokens = 100;

      const result = await compiler.compile();

      // Check that warning exists about budget exclusion
      const hasTokenWarning = result.warnings.some(
        w => w.type === 'token_limit' || w.type === 'empty_rules'
      );
      expect(hasTokenWarning).toBe(true);
    });
  });

  describe('output structure', () => {
    it('should have proper markdown structure', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('# Project Context');
      expect(content).toContain('## Rules');
    });

    it('should format rules with headers', async () => {
      context.rules = [
        createMockRule({ id: 'auth-rule' }),
        createMockRule({ id: 'api-rule' }),
      ];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('### auth-rule');
      expect(content).toContain('### api-rule');
    });
  });

  describe('selection strategies', () => {
    it('should apply priority strategy', async () => {
      context.rules = [
        createMockRule({ id: 'low', priority: 20 }),
        createMockRule({ id: 'high', priority: 80 }),
        createMockRule({ id: 'critical', priority: 100 }),
      ];
      context.config.compile!.claude!.strategy = 'priority';

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      // Critical should appear before low in the output
      const criticalIndex = content.indexOf('critical');
      const lowIndex = content.indexOf('### low');
      expect(criticalIndex).toBeLessThan(lowIndex);
    });

    it('should support always_include config', async () => {
      context.rules = [
        createMockRule({ id: 'optional', priority: 20 }),
        createMockRule({ id: 'required', priority: 20 }),
      ];
      context.config.compile!.claude!.always_include = ['required'];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('required');
    });
  });
});
