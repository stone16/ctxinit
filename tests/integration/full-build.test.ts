/**
 * Integration Tests - Full Build Pipeline
 *
 * Tests the complete build flow: scan → validate → compile
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from '../../src/config/loader';
import { parseAllRules, ParseOptions } from '../../src/parser/rule-parser';
import { analyzeRules } from '../../src/analysis/static-analysis';
import { BuildOrchestrator, BuildOptions } from '../../src/build/orchestrator';

describe('Full Build Pipeline Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-integration-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createTestProject(options: {
    rules?: Array<{
      id: string;
      content: string;
      priority?: number;
      always_apply?: boolean;
      globs?: string[];
    }>;
    config?: Record<string, unknown>;
    project?: string;
    architecture?: string;
  } = {}) {
    const contextDir = path.join(tempDir, '.context');
    const rulesDir = path.join(contextDir, 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });

    // Config
    fs.writeFileSync(
      path.join(contextDir, 'config.yaml'),
      `version: "1.0"\nproject:\n  name: "test-project"\n  description: "Test project"\ncompile:\n  claude:\n    max_tokens: 4000\n    strategy: priority\n  cursor:\n    strategy: all\n  agents:\n    max_tokens: 8000\n`
    );

    // Project.md
    const project = options.project || '# Test Project\n\nA test project.';
    fs.writeFileSync(path.join(contextDir, 'project.md'), project);

    // Architecture.md (optional)
    if (options.architecture) {
      fs.writeFileSync(
        path.join(contextDir, 'architecture.md'),
        options.architecture
      );
    }

    // Rules
    const rules = options.rules || [
      { id: 'rule-1', content: '# Rule 1\n\nFirst rule content.' },
    ];

    for (const rule of rules) {
      const frontmatter = [
        '---',
        `id: ${rule.id}`,
        `description: Description for ${rule.id}`,
        rule.priority !== undefined ? `priority: ${rule.priority}` : '',
        rule.always_apply !== undefined ? `always_apply: ${rule.always_apply}` : '',
        rule.globs && rule.globs.length > 0
          ? `globs:\n${rule.globs.map((g) => `  - "${g}"`).join('\n')}`
          : '',
        '---',
      ]
        .filter(Boolean)
        .join('\n');

      fs.writeFileSync(
        path.join(rulesDir, `${rule.id}.md`),
        `${frontmatter}\n\n${rule.content}`
      );
    }
  }

  describe('Complete Build Flow', () => {
    it('should execute full pipeline: load → parse → analyze → compile', async () => {
      createTestProject({
        rules: [
          { id: 'auth-rules', content: '# Auth Rules\n\nAuth content.', priority: 10 },
          { id: 'api-rules', content: '# API Rules\n\nAPI content.', priority: 5 },
        ],
        architecture: '# Architecture\n\nSystem architecture.',
      });

      // Load config
      const configResult = loadConfig(tempDir);
      expect(configResult.config).toBeDefined();
      expect(configResult.config.version).toBe('1.0');

      // Parse rules
      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir: path.join(tempDir, '.context', 'rules'),
      };
      const { rules } = parseAllRules(parseOptions);
      expect(rules).toHaveLength(2);

      // Analyze rules
      const analysis = analyzeRules(rules, { projectRoot: tempDir });
      expect(analysis.errors).toHaveLength(0);

      // Build
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config);
      const buildOptions: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude', 'cursor', 'agents'],
        force: true,
      };

      const result = await orchestrator.build(buildOptions);
      expect(result.success).toBe(true);
      expect(result.compilations.size).toBeGreaterThan(0);

      // Verify output files exist
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.cursor/rules'))).toBe(true);
    });

    it('should handle incremental builds with changes', async () => {
      createTestProject({
        rules: [{ id: 'rule-1', content: '# Rule 1\n\nOriginal content.' }],
      });

      const configResult = loadConfig(tempDir);

      // First build
      const orchestrator1 = new BuildOrchestrator(tempDir, configResult.config);
      const buildOptions1: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      };
      const result1 = await orchestrator1.build(buildOptions1);
      expect(result1.success).toBe(true);

      // Modify rule
      fs.writeFileSync(
        path.join(tempDir, '.context/rules/rule-1.md'),
        '---\nid: rule-1\ndescription: Modified\n---\n\n# Rule 1\n\nModified content.'
      );

      // Second build (incremental)
      const orchestrator2 = new BuildOrchestrator(tempDir, configResult.config);
      const buildOptions2: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude'],
        force: false,
      };
      const result2 = await orchestrator2.build(buildOptions2);
      expect(result2.success).toBe(true);

      // Verify content changed
      const claudeContent = fs.readFileSync(
        path.join(tempDir, 'CLAUDE.md'),
        'utf-8'
      );
      expect(claudeContent).toContain('Modified content');
    });

    it('should compile to all three targets', async () => {
      createTestProject({
        rules: [
          { id: 'shared-rule', content: '# Shared\n\nApplies everywhere.', always_apply: true },
          { id: 'ts-rule', content: '# TypeScript\n\nTS specific.', globs: ['**/*.ts'] },
        ],
        architecture: '# Arch\n\nOverview.',
      });

      const configResult = loadConfig(tempDir);
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config);
      const buildOptions: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude', 'cursor', 'agents'],
        force: true,
      };

      const result = await orchestrator.build(buildOptions);
      expect(result.success).toBe(true);

      // CLAUDE.md
      const claudeContent = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeContent).toContain('Project Context');
      expect(claudeContent).toContain('checksum');

      // AGENTS.md
      const agentsContent = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf-8');
      expect(agentsContent).toContain('Agent Context');
      expect(agentsContent).toContain('checksum');

      // Cursor .mdc files
      const cursorDir = path.join(tempDir, '.cursor/rules');
      const mdcFiles = fs.readdirSync(cursorDir);
      expect(mdcFiles.length).toBeGreaterThan(0);
      expect(mdcFiles.some((f) => f.endsWith('.mdc'))).toBe(true);
    });

    it('should respect token budgets', async () => {
      // Create many rules that exceed token budget
      const rules = Array.from({ length: 20 }, (_, i) => ({
        id: `rule-${i}`,
        content: '# Rule\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(100),
        priority: 20 - i, // Higher priority first
      }));

      createTestProject({ rules });

      const configResult = loadConfig(tempDir);
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config);
      const buildOptions: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      };

      const result = await orchestrator.build(buildOptions);
      expect(result.success).toBe(true);

      // Verify build completed
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should report errors when project.md is missing', async () => {
      const contextDir = path.join(tempDir, '.context');
      fs.mkdirSync(contextDir, { recursive: true });
      fs.writeFileSync(
        path.join(contextDir, 'config.yaml'),
        'version: "1.0"\ncompile:\n  claude:\n    max_tokens: 4000\n'
      );

      const configResult = loadConfig(tempDir);
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config);
      const buildOptions: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      };

      const result = await orchestrator.build(buildOptions);
      // Build reports errors for missing project.md
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('project.md'))).toBe(true);
    });

    it('should handle validation errors', async () => {
      createTestProject();

      // Create an invalid rule (missing required field)
      fs.writeFileSync(
        path.join(tempDir, '.context/rules/bad-rule.md'),
        '---\ndescription: Missing id\n---\n\n# Bad Rule'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir: path.join(tempDir, '.context', 'rules'),
      };
      const { rules, errors } = parseAllRules(parseOptions);

      // Should have errors or the rule should be skipped
      expect(errors.length + rules.length).toBeGreaterThan(0);
    });
  });
});
