import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AgentsCompiler } from '../../src/compiler/agents-compiler';
import { CompilerContext } from '../../src/compiler/base-compiler';
import { ParsedRule } from '../../src/schemas/rule';
import { Config } from '../../src/schemas/config';

// Helper to create mock rule
function createMockRule(overrides: Partial<ParsedRule['frontmatter']> & { rulePath?: string; content?: string } = {}): ParsedRule {
  const { rulePath, content = 'Rule content here. This is the first paragraph.\n\nSecond paragraph with more details.', ...frontmatterOverrides } = overrides;
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

describe('AgentsCompiler', () => {
  let tempDir: string;
  let compiler: AgentsCompiler;
  let context: CompilerContext;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-compiler-test-'));

    // Create .context directory structure
    const contextDir = path.join(tempDir, '.context');
    fs.mkdirSync(contextDir, { recursive: true });
    fs.mkdirSync(path.join(contextDir, 'rules'), { recursive: true });

    // Create project.md (required)
    fs.writeFileSync(
      path.join(contextDir, 'project.md'),
      '# Test Project\n\nThis is a comprehensive project description with details about the application.'
    );

    context = {
      projectRoot: tempDir,
      config: {
        version: '1.0',
        compile: {
          agents: {
            max_tokens: 8000,
            strategy: 'all',
            include_dirs: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      } as Config,
      rules: [],
    };

    compiler = new AgentsCompiler(context);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('targetName', () => {
    it('should return agents', () => {
      expect(compiler.targetName).toBe('agents');
    });
  });

  describe('compile', () => {
    it('should compile to single AGENTS.md file', async () => {
      context.rules = [
        createMockRule({ id: 'rule-1' }),
        createMockRule({ id: 'rule-2' }),
      ];

      const result = await compiler.compile();

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].path).toBe('AGENTS.md');
    });

    it('should include full project content', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Test Project');
      expect(result.outputs[0].content).toContain('comprehensive project description');
    });

    it('should include full architecture content when available', async () => {
      // Create architecture.md
      fs.writeFileSync(
        path.join(tempDir, '.context', 'architecture.md'),
        '# System Architecture\n\nDetailed architecture description with components and patterns.'
      );

      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('System Architecture');
      expect(result.outputs[0].content).toContain('Detailed architecture description');
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

    it('should use rule summaries instead of full content', async () => {
      const rule = createMockRule({ id: 'test', content: 'First paragraph summary.\n\nSecond paragraph should not appear in full.\n\nThird paragraph also hidden.' });
      context.rules = [rule];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('First paragraph summary');
      // The full content shouldn't be duplicated
    });

    it('should include rule descriptions', async () => {
      context.rules = [
        createMockRule({
          id: 'auth-rule',
          description: 'Authentication and authorization guidelines',
        }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('Authentication and authorization guidelines');
    });

    it('should include rule tags', async () => {
      context.rules = [
        createMockRule({
          id: 'security-rule',
          tags: ['security', 'authentication', 'authorization'],
        }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('security');
      expect(result.outputs[0].content).toContain('authentication');
    });

    it('should include rule domains', async () => {
      context.rules = [
        createMockRule({
          id: 'backend-rule',
          domain: 'backend',
        }),
      ];

      const result = await compiler.compile();

      expect(result.outputs[0].content).toContain('backend');
    });

    it('should respect token budget', async () => {
      const rules = Array.from({ length: 30 }, (_, i) => {
        return createMockRule({ id: `rule-${i}`, content: 'x'.repeat(500) });
      });

      context.config.compile!.agents!.max_tokens = 1000;
      context.rules = rules;

      const result = await compiler.compile();

      expect(result.stats.tokenBudget).toBe(1000);
      expect(result.stats.rulesIncluded).toBeLessThan(rules.length);
    });

    it('should track statistics', async () => {
      context.rules = [
        createMockRule({ id: 'rule-1' }),
        createMockRule({ id: 'rule-2' }),
        createMockRule({ id: 'rule-3' }),
      ];

      const result = await compiler.compile();

      expect(result.stats.rulesProcessed).toBe(3);
      expect(result.stats.outputFiles).toBe(1);
      expect(result.totalTokens).toBeGreaterThan(0);
    });

    it('should warn when architecture.md is missing', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();

      expect(result.warnings.some(w => w.type === 'missing_optional')).toBe(true);
    });

    it('should warn when rules excluded due to budget', async () => {
      const rules = Array.from({ length: 50 }, (_, i) => {
        return createMockRule({ id: `rule-${i}`, content: 'x'.repeat(1000) });
      });

      context.config.compile!.agents!.max_tokens = 500;
      context.rules = rules;

      const result = await compiler.compile();

      const hasTokenWarning = result.warnings.some(
        w => w.type === 'token_limit' || w.type === 'empty_rules'
      );
      expect(hasTokenWarning).toBe(true);
    });
  });

  describe('output structure', () => {
    it('should have Agent Context header', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('# Agent Context');
    });

    it('should have Project Overview section', async () => {
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('## Project Overview');
    });

    it('should have Architecture section when available', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.context', 'architecture.md'),
        '# Architecture\n\nDetails here.'
      );
      context.rules = [createMockRule({ id: 'test' })];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('## Architecture');
    });

    it('should have Rules and Guidelines section', async () => {
      context.rules = [
        createMockRule({ id: 'rule-1' }),
        createMockRule({ id: 'rule-2' }),
      ];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('## Rules and Guidelines');
    });

    it('should format rules with headers and metadata', async () => {
      context.rules = [
        createMockRule({
          id: 'auth-rule',
          description: 'Auth description',
          tags: ['security'],
          domain: 'backend',
        }),
      ];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      expect(content).toContain('### auth-rule');
      expect(content).toContain('**Description:**');
      expect(content).toContain('**Tags:**');
      expect(content).toContain('**Domain:**');
    });
  });

  describe('priority handling', () => {
    it('should sort rules by priority', async () => {
      context.rules = [
        createMockRule({ id: 'low', priority: 20 }),
        createMockRule({ id: 'critical', priority: 100 }),
        createMockRule({ id: 'high', priority: 80 }),
      ];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      // Critical should appear before low
      const criticalIndex = content.indexOf('### critical');
      const lowIndex = content.indexOf('### low');
      expect(criticalIndex).toBeLessThan(lowIndex);
    });
  });

  describe('comprehensive output', () => {
    it('should include all major sections in order', async () => {
      fs.writeFileSync(
        path.join(tempDir, '.context', 'architecture.md'),
        '# Architecture\n\nSystem design.'
      );

      context.rules = [
        createMockRule({ id: 'test-rule', description: 'Test description' }),
      ];

      const result = await compiler.compile();
      const content = result.outputs[0].content;

      // Check order of sections
      const headerIndex = content.indexOf('# Agent Context');
      const projectIndex = content.indexOf('## Project Overview');
      const archIndex = content.indexOf('## Architecture');
      const rulesIndex = content.indexOf('## Rules and Guidelines');
      const hygieneIndex = content.indexOf('Context Hygiene');

      expect(headerIndex).toBeLessThan(projectIndex);
      expect(projectIndex).toBeLessThan(archIndex);
      expect(archIndex).toBeLessThan(rulesIndex);
      expect(rulesIndex).toBeLessThan(hygieneIndex);
    });
  });
});
