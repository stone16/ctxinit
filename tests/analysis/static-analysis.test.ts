import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  analyzeRules,
  findDuplicateIds,
  findDeadLinks,
  findGhostRules,
  checkTokenLimits,
  findCircularReferences,
  validateRule,
} from '../../src/analysis/static-analysis';
import { ParsedRule } from '../../src/schemas/rule';
import { Config, DEFAULT_CONFIG } from '../../src/schemas/config';

describe('Static Analysis', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-analysis-test-'));
    // Create a simple file for dead link tests
    fs.writeFileSync(path.join(tempDir, 'existing.md'), '# Existing file');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createMockRule = (overrides: Partial<ParsedRule> = {}): ParsedRule => ({
    path: 'test-rule.md',
    absolutePath: path.join(tempDir, 'test-rule.md'),
    frontmatter: {
      id: 'test-rule',
      priority: 50,
      tags: [],
      always_apply: false,
    },
    content: '# Test Rule\n\nSome content.',
    inferredGlobs: ['**/*'],
    effectiveGlobs: ['**/*'],
    ...overrides,
  });

  describe('findDuplicateIds', () => {
    it('should detect duplicate rule IDs', () => {
      const rules = [
        createMockRule({ path: 'rule1.md', frontmatter: { id: 'duplicate', priority: 50, tags: [], always_apply: false } }),
        createMockRule({ path: 'rule2.md', frontmatter: { id: 'duplicate', priority: 50, tags: [], always_apply: false } }),
        createMockRule({ path: 'rule3.md', frontmatter: { id: 'unique', priority: 50, tags: [], always_apply: false } }),
      ];

      const errors = findDuplicateIds(rules);

      expect(errors).toHaveLength(2);
      expect(errors[0].type).toBe('duplicate_id');
      expect(errors[0].message).toContain('duplicate');
    });

    it('should return empty for unique IDs', () => {
      const rules = [
        createMockRule({ frontmatter: { id: 'rule1', priority: 50, tags: [], always_apply: false } }),
        createMockRule({ frontmatter: { id: 'rule2', priority: 50, tags: [], always_apply: false } }),
      ];

      const errors = findDuplicateIds(rules);

      expect(errors).toHaveLength(0);
    });

    it('should handle empty rules array', () => {
      const errors = findDuplicateIds([]);
      expect(errors).toHaveLength(0);
    });
  });

  describe('findDeadLinks', () => {
    it('should detect dead links', () => {
      const rule = createMockRule({
        content: 'Check [this link](./nonexistent.md) for details.',
      });

      const errors = findDeadLinks(rule, tempDir);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('dead_link');
      expect(errors[0].message).toContain('nonexistent.md');
    });

    it('should not flag existing files', () => {
      const rule = createMockRule({
        content: 'Check [this link](./existing.md) for details.',
        absolutePath: path.join(tempDir, 'rule.md'),
      });

      const errors = findDeadLinks(rule, tempDir);

      expect(errors).toHaveLength(0);
    });

    it('should ignore external URLs', () => {
      const rule = createMockRule({
        content: `
Check [Google](https://google.com) and [HTTP](http://example.com).
Also [email](mailto:test@example.com) and [anchor](#section).
`,
      });

      const errors = findDeadLinks(rule, tempDir);

      expect(errors).toHaveLength(0);
    });

    it('should include line numbers', () => {
      const rule = createMockRule({
        content: 'Line 1\nLine 2\n[dead link](./missing.md)\nLine 4',
      });

      const errors = findDeadLinks(rule, tempDir);

      expect(errors).toHaveLength(1);
      expect(errors[0].line).toBe(3);
    });
  });

  describe('findGhostRules', () => {
    it('should detect globs matching no files', () => {
      const rule = createMockRule({
        effectiveGlobs: ['nonexistent/**/*.xyz'],
      });

      const warnings = findGhostRules(rule, tempDir);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('ghost_rule');
    });

    it('should not warn for globs matching files', () => {
      // Create a matching file
      fs.writeFileSync(path.join(tempDir, 'test.md'), 'content');

      const rule = createMockRule({
        effectiveGlobs: ['*.md'],
      });

      const warnings = findGhostRules(rule, tempDir);

      expect(warnings).toHaveLength(0);
    });

    it('should skip rules with always_apply', () => {
      const rule = createMockRule({
        frontmatter: { id: 'test', priority: 50, tags: [], always_apply: true },
        effectiveGlobs: ['nonexistent/**/*.xyz'],
      });

      const warnings = findGhostRules(rule, tempDir);

      expect(warnings).toHaveLength(0);
    });
  });

  describe('checkTokenLimits', () => {
    it('should warn when approaching token limit', () => {
      // Create rules with lots of content
      const longContent = 'x'.repeat(20000); // ~5000 tokens
      const rules = [
        createMockRule({ content: longContent }),
      ];

      const config: Config = {
        ...DEFAULT_CONFIG,
        compile: {
          claude: { max_tokens: 4000, strategy: 'priority', always_include: [] },
        },
      };

      const warnings = checkTokenLimits(rules, config);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('token_limit');
    });

    it('should not warn when within limits', () => {
      const rules = [
        createMockRule({ content: 'Short content.' }),
      ];

      const config: Config = {
        ...DEFAULT_CONFIG,
        compile: {
          claude: { max_tokens: 10000, strategy: 'priority', always_include: [] },
        },
      };

      const warnings = checkTokenLimits(rules, config);

      expect(warnings).toHaveLength(0);
    });

    it('should handle missing config', () => {
      const rules = [createMockRule()];

      const warnings = checkTokenLimits(rules, undefined);

      expect(warnings).toHaveLength(0);
    });
  });

  describe('findCircularReferences', () => {
    it('should detect circular imports', () => {
      const rules = [
        createMockRule({
          frontmatter: { id: 'rule-a', priority: 50, tags: [], always_apply: false },
          content: '@import "rule-b"',
        }),
        createMockRule({
          frontmatter: { id: 'rule-b', priority: 50, tags: [], always_apply: false },
          content: '@import "rule-a"',
        }),
      ];

      const errors = findCircularReferences(rules);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('circular_reference');
    });

    it('should allow non-circular imports', () => {
      const rules = [
        createMockRule({
          frontmatter: { id: 'rule-a', priority: 50, tags: [], always_apply: false },
          content: '@import "rule-b"',
        }),
        createMockRule({
          frontmatter: { id: 'rule-b', priority: 50, tags: [], always_apply: false },
          content: 'No imports here.',
        }),
      ];

      const errors = findCircularReferences(rules);

      expect(errors).toHaveLength(0);
    });
  });

  describe('validateRule', () => {
    it('should return valid for good rule', () => {
      fs.writeFileSync(path.join(tempDir, 'linked.md'), 'content');

      const rule = createMockRule({
        absolutePath: path.join(tempDir, 'rule.md'),
        content: 'Good content with [valid link](./linked.md).',
        effectiveGlobs: ['*.md'],
      });

      const result = validateRule(rule, { projectRoot: tempDir });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors and warnings', () => {
      const rule = createMockRule({
        content: 'Content with [dead link](./missing.md).',
        effectiveGlobs: ['nonexistent/**/*.xyz'],
      });

      const result = validateRule(rule, { projectRoot: tempDir });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeRules', () => {
    it('should run all analysis checks', () => {
      const rules = [
        createMockRule({
          frontmatter: { id: 'duplicate', priority: 50, tags: [], always_apply: false },
          path: 'rule1.md',
        }),
        createMockRule({
          frontmatter: { id: 'duplicate', priority: 50, tags: [], always_apply: false },
          path: 'rule2.md',
        }),
      ];

      const result = analyzeRules(rules, { projectRoot: tempDir });

      expect(result.rulesAnalyzed).toBe(2);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_id')).toBe(true);
    });

    it('should return valid for clean rules', () => {
      fs.writeFileSync(path.join(tempDir, 'file.ts'), 'content');

      const rules = [
        createMockRule({
          frontmatter: { id: 'unique-1', priority: 50, tags: [], always_apply: false },
          effectiveGlobs: ['*.ts'],
        }),
        createMockRule({
          frontmatter: { id: 'unique-2', priority: 50, tags: [], always_apply: false },
          effectiveGlobs: ['*.ts'],
        }),
      ];

      const result = analyzeRules(rules, { projectRoot: tempDir });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
