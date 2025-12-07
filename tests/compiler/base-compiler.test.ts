import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  BaseCompiler,
  CompilerContext,
  CompilationResult,
} from '../../src/compiler/base-compiler';
import { ParsedRule } from '../../src/schemas/rule';
import { Config } from '../../src/schemas/config';

// Concrete implementation for testing abstract class
class TestCompiler extends BaseCompiler {
  get targetName(): string {
    return 'test';
  }

  async compile(): Promise<CompilationResult> {
    return {
      success: true,
      outputs: [],
      errors: [],
      warnings: [],
      totalTokens: 0,
      stats: {
        rulesProcessed: 0,
        rulesIncluded: 0,
        outputFiles: 0,
        totalTokens: 0,
      },
    };
  }

  // Expose protected methods for testing
  public async testLoadProjectContent(): Promise<string | undefined> {
    return this.loadProjectContent();
  }

  public async testLoadArchitectureContent(): Promise<string | undefined> {
    return this.loadArchitectureContent();
  }

  public testGenerateMetaRule(): string {
    return this.generateMetaRule();
  }

  public testGenerateDirectoryIndex(rules: ParsedRule[]): string {
    return this.generateDirectoryIndex(rules);
  }

  public testWriteOutput(outputPath: string, content: string): void {
    return this.writeOutput(outputPath, content);
  }

  public testGetRuleSummary(rule: ParsedRule): string {
    return this.getRuleSummary(rule);
  }
}

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

describe('BaseCompiler', () => {
  let tempDir: string;
  let compiler: TestCompiler;
  let context: CompilerContext;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compiler-test-'));

    // Create .context directory structure
    const contextDir = path.join(tempDir, '.context');
    fs.mkdirSync(contextDir, { recursive: true });
    fs.mkdirSync(path.join(contextDir, 'rules'), { recursive: true });

    context = {
      projectRoot: tempDir,
      config: {
        version: '1.0',
        compile: {},
        conflict_resolution: { strategy: 'priority_wins' },
      } as Config,
      rules: [],
    };

    compiler = new TestCompiler(context);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('targetName', () => {
    it('should return the target name', () => {
      expect(compiler.targetName).toBe('test');
    });
  });

  describe('loadProjectContent', () => {
    it('should load project.md when it exists', async () => {
      const projectPath = path.join(tempDir, '.context', 'project.md');
      fs.writeFileSync(projectPath, '# Project\n\nThis is the project description.');

      const content = await compiler.testLoadProjectContent();
      expect(content).toBe('# Project\n\nThis is the project description.');
    });

    it('should return undefined when project.md does not exist', async () => {
      const content = await compiler.testLoadProjectContent();
      expect(content).toBeUndefined();
    });
  });

  describe('loadArchitectureContent', () => {
    it('should load architecture.md when it exists', async () => {
      const archPath = path.join(tempDir, '.context', 'architecture.md');
      fs.writeFileSync(archPath, '# Architecture\n\nSystem architecture description.');

      const content = await compiler.testLoadArchitectureContent();
      expect(content).toBe('# Architecture\n\nSystem architecture description.');
    });

    it('should return undefined when architecture.md does not exist', async () => {
      const content = await compiler.testLoadArchitectureContent();
      expect(content).toBeUndefined();
    });
  });

  describe('generateMetaRule', () => {
    it('should generate context hygiene meta-rule', () => {
      const metaRule = compiler.testGenerateMetaRule();

      expect(metaRule).toContain('Context Hygiene');
      expect(metaRule).toContain('.context/rules/');
    });

    it('should include instructions for rule discovery', () => {
      const metaRule = compiler.testGenerateMetaRule();

      expect(metaRule).toContain('ctx');
    });
  });

  describe('generateDirectoryIndex', () => {
    it('should generate directory listing for rules', () => {
      const rules: ParsedRule[] = [
        createMockRule({ id: 'auth-rule', rulePath: 'security/auth.md' }),
        createMockRule({ id: 'api-rule', rulePath: 'api/endpoints.md' }),
      ];

      const index = compiler.testGenerateDirectoryIndex(rules);

      expect(index).toContain('Directory');
      expect(index).toContain('security');
      expect(index).toContain('api');
    });

    it('should handle empty rules array', () => {
      const index = compiler.testGenerateDirectoryIndex([]);
      expect(index).toContain('Directory');
    });
  });

  describe('writeOutput', () => {
    it('should write content to file', () => {
      const outputPath = 'output.md';
      const content = '# Output\n\nGenerated content.';

      compiler.testWriteOutput(outputPath, content);

      const writtenContent = fs.readFileSync(path.join(tempDir, outputPath), 'utf-8');
      expect(writtenContent).toBe(content);
    });

    it('should create directories if needed', () => {
      const outputPath = 'subdir/output.md';
      const content = 'Content in subdirectory.';

      compiler.testWriteOutput(outputPath, content);

      const writtenContent = fs.readFileSync(path.join(tempDir, outputPath), 'utf-8');
      expect(writtenContent).toBe(content);
    });

    it('should overwrite existing files', () => {
      const outputPath = 'output.md';
      fs.writeFileSync(path.join(tempDir, outputPath), 'Old content');

      compiler.testWriteOutput(outputPath, 'New content');

      const writtenContent = fs.readFileSync(path.join(tempDir, outputPath), 'utf-8');
      expect(writtenContent).toBe('New content');
    });
  });

  describe('getRuleSummary', () => {
    it('should return first paragraph as summary', () => {
      const rule = createMockRule({ content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.' });

      const summary = compiler.testGetRuleSummary(rule);
      expect(summary).toContain('First paragraph.');
    });

    it('should handle single paragraph content', () => {
      const rule = createMockRule({ content: 'Only one paragraph with some content.' });

      const summary = compiler.testGetRuleSummary(rule);
      expect(summary).toContain('Only one paragraph with some content.');
    });

    it('should include description', () => {
      const rule = createMockRule({ description: 'Rule description here', content: 'Content here.' });

      const summary = compiler.testGetRuleSummary(rule);
      expect(summary).toContain('Rule description here');
    });
  });
});
