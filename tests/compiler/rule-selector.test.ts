import {
  filterByDirectory,
  filterByGlob,
  filterByTag,
  sortByPriority,
  selectByBudget,
  selectRules,
  partitionRules,
  SelectionContext,
} from '../../src/compiler/rule-selector';
import { ParsedRule } from '../../src/schemas/rule';

// Helper to create a mock parsed rule
function createMockRule(overrides: Partial<ParsedRule['frontmatter']> & { rulePath?: string; content?: string } = {}): ParsedRule {
  const { rulePath, content = 'Rule content here', ...frontmatterOverrides } = overrides;
  const id = frontmatterOverrides.id || 'test-rule';
  const globs = frontmatterOverrides.globs
    ? (Array.isArray(frontmatterOverrides.globs) ? frontmatterOverrides.globs : [frontmatterOverrides.globs])
    : ['**/*'];

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
    effectiveGlobs: globs,
  };
}

describe('Rule Selector', () => {
  describe('filterByDirectory', () => {
    const rules: ParsedRule[] = [
      createMockRule({ id: 'backend-auth', rulePath: 'backend/auth.md' }),
      createMockRule({ id: 'frontend-components', rulePath: 'frontend/components.md' }),
      createMockRule({ id: 'api-endpoints', rulePath: 'api/endpoints.md' }),
      createMockRule({ id: 'utils-helpers', rulePath: 'utils/helpers.md' }),
    ];

    it('should filter rules by single directory', () => {
      const result = filterByDirectory(rules, ['backend']);
      expect(result).toHaveLength(1);
      expect(result[0].frontmatter.id).toBe('backend-auth');
    });

    it('should filter rules by multiple directories', () => {
      const result = filterByDirectory(rules, ['backend', 'api']);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.frontmatter.id)).toContain('backend-auth');
      expect(result.map(r => r.frontmatter.id)).toContain('api-endpoints');
    });

    it('should return empty array for non-matching directories', () => {
      const result = filterByDirectory(rules, ['nonexistent']);
      expect(result).toHaveLength(0);
    });

    it('should return all rules when empty directory list', () => {
      const result = filterByDirectory(rules, []);
      expect(result).toHaveLength(4);
    });
  });

  describe('filterByGlob', () => {
    // Create rules with specific globs - no catch-all **/* for precise testing
    const rules: ParsedRule[] = [
      createMockRule({ id: 'auth-login', globs: ['src/auth/**/*'] }),
      createMockRule({ id: 'api-users', globs: ['src/api/users.ts'] }),
      createMockRule({ id: 'components', globs: ['src/components/**/*.tsx'] }),
      createMockRule({ id: 'tests-only', globs: ['tests/**/*'] }),
    ];

    it('should filter rules by matching glob patterns', () => {
      const context: SelectionContext = {
        projectRoot: '/project',
        contextFiles: ['src/auth/login.ts'],
      };
      const result = filterByGlob(rules, context);
      expect(result).toHaveLength(1);
      expect(result[0].frontmatter.id).toBe('auth-login');
    });

    it('should return empty array when no globs match', () => {
      const context: SelectionContext = {
        projectRoot: '/project',
        contextFiles: ['src/other/file.ts'],
      };
      const result = filterByGlob(rules, context);
      expect(result).toHaveLength(0);
    });

    it('should return all rules when no context files', () => {
      const context: SelectionContext = {
        projectRoot: '/project',
      };
      const result = filterByGlob(rules, context);
      expect(result).toHaveLength(4); // Returns all when no context files
    });

    it('should match component files', () => {
      const context: SelectionContext = {
        projectRoot: '/project',
        contextFiles: ['src/components/Button.tsx'],
      };
      const result = filterByGlob(rules, context);
      expect(result).toHaveLength(1);
      expect(result[0].frontmatter.id).toBe('components');
    });

    it('should match catch-all glob rules', () => {
      const rulesWithCatchAll: ParsedRule[] = [
        createMockRule({ id: 'specific', globs: ['src/auth/**/*'] }),
        createMockRule({ id: 'catch-all' }), // defaults to **/*
      ];
      const context: SelectionContext = {
        projectRoot: '/project',
        contextFiles: ['any/file/path.ts'],
      };
      const result = filterByGlob(rulesWithCatchAll, context);
      expect(result).toHaveLength(1);
      expect(result[0].frontmatter.id).toBe('catch-all');
    });
  });

  describe('filterByTag', () => {
    const rules: ParsedRule[] = [
      createMockRule({ id: 'security-rule', tags: ['security', 'auth'] }),
      createMockRule({ id: 'performance-rule', tags: ['performance', 'optimization'] }),
      createMockRule({ id: 'multi-tag', tags: ['security', 'performance'] }),
      createMockRule({ id: 'no-tags' }),
    ];

    it('should filter rules by single tag', () => {
      const result = filterByTag(rules, ['security']);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.frontmatter.id)).toContain('security-rule');
      expect(result.map(r => r.frontmatter.id)).toContain('multi-tag');
    });

    it('should filter rules by multiple tags (OR logic)', () => {
      const result = filterByTag(rules, ['security', 'performance']);
      expect(result).toHaveLength(3);
    });

    it('should return empty array for non-matching tags', () => {
      const result = filterByTag(rules, ['nonexistent']);
      expect(result).toHaveLength(0);
    });

    it('should return all rules when empty tag list', () => {
      const result = filterByTag(rules, []);
      expect(result).toHaveLength(4);
    });
  });

  describe('sortByPriority', () => {
    const rules: ParsedRule[] = [
      createMockRule({ id: 'low-priority', priority: 20 }),
      createMockRule({ id: 'high-priority', priority: 80 }),
      createMockRule({ id: 'medium-priority', priority: 50 }),
      createMockRule({ id: 'critical-priority', priority: 100 }),
      createMockRule({ id: 'default-priority' }), // Uses default 50
    ];

    it('should sort rules by priority (highest first)', () => {
      const result = sortByPriority(rules);
      expect(result[0].frontmatter.id).toBe('critical-priority');
      expect(result[1].frontmatter.id).toBe('high-priority');
    });

    it('should handle rules with same priority', () => {
      const result = sortByPriority(rules);
      // Rules without priority should be treated as medium (50)
      expect(result.length).toBe(5);
    });

    it('should not mutate original array', () => {
      const original = [...rules];
      sortByPriority(rules);
      expect(rules).toEqual(original);
    });
  });

  describe('selectByBudget', () => {
    const rules: ParsedRule[] = [
      createMockRule({ id: 'small-rule', content: 'Small' }),
      createMockRule({ id: 'medium-rule', content: 'Medium content here with more text' }),
      createMockRule({ id: 'large-rule', content: 'Large content '.repeat(100) }),
      createMockRule({ id: 'always-include', content: 'Always included' }),
    ];

    it('should select rules within token budget', () => {
      const result = selectByBudget(rules, 100, []);
      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.totalTokens).toBeLessThanOrEqual(100);
    });

    it('should always include specified rule IDs', () => {
      const result = selectByBudget(rules, 50, ['always-include']);
      expect(result.rules.map(r => r.frontmatter.id)).toContain('always-include');
    });

    it('should track excluded rules by budget', () => {
      const result = selectByBudget(rules, 10, []);
      expect(result.excludedByBudget.length).toBeGreaterThan(0);
    });

    it('should return empty result for zero budget', () => {
      const result = selectByBudget(rules, 0, []);
      expect(result.rules).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });
  });

  describe('selectRules', () => {
    const rules: ParsedRule[] = [
      createMockRule({ id: 'rule-1', priority: 80, tags: ['security'], rulePath: 'backend/rule-1.md' }),
      createMockRule({ id: 'rule-2', priority: 20, tags: ['performance'], rulePath: 'frontend/rule-2.md' }),
      createMockRule({ id: 'rule-3', priority: 50, tags: ['security'], rulePath: 'api/rule-3.md' }),
    ];

    it('should apply priority strategy', () => {
      const context: SelectionContext = { projectRoot: '/project' };
      const result = selectRules(rules, { strategy: 'priority', maxTokens: 1000 }, context);
      expect(result.rules[0].frontmatter.id).toBe('rule-1'); // high priority first
    });

    it('should apply directory strategy', () => {
      const context: SelectionContext = { projectRoot: '/project' };
      const result = selectRules(
        rules,
        { strategy: 'directory', maxTokens: 1000, includeDirs: ['backend'] },
        context
      );
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].frontmatter.id).toBe('rule-1');
    });

    it('should apply tag strategy', () => {
      const context: SelectionContext = { projectRoot: '/project' };
      const result = selectRules(
        rules,
        { strategy: 'tag', maxTokens: 1000, includeTags: ['security'] },
        context
      );
      expect(result.rules).toHaveLength(2);
    });

    it('should apply all strategy', () => {
      const context: SelectionContext = { projectRoot: '/project' };
      const result = selectRules(rules, { strategy: 'all', maxTokens: 10000 }, context);
      expect(result.rules).toHaveLength(3);
    });

    it('should respect max tokens constraint', () => {
      const context: SelectionContext = { projectRoot: '/project' };
      const result = selectRules(rules, { strategy: 'all', maxTokens: 10 }, context);
      expect(result.totalTokens).toBeLessThanOrEqual(10);
    });
  });

  describe('partitionRules', () => {
    const rules: ParsedRule[] = [
      createMockRule({ id: 'always-1', always_apply: true }),
      createMockRule({ id: 'conditional-1', always_apply: false }),
      createMockRule({ id: 'always-2', always_apply: true }),
      createMockRule({ id: 'conditional-2' }), // undefined means conditional (false default)
    ];

    it('should separate always-apply rules', () => {
      const result = partitionRules(rules);
      expect(result.alwaysApply).toHaveLength(2);
      expect(result.alwaysApply.map(r => r.frontmatter.id)).toContain('always-1');
      expect(result.alwaysApply.map(r => r.frontmatter.id)).toContain('always-2');
    });

    it('should separate conditional rules', () => {
      const result = partitionRules(rules);
      expect(result.conditional).toHaveLength(2);
      expect(result.conditional.map(r => r.frontmatter.id)).toContain('conditional-1');
      expect(result.conditional.map(r => r.frontmatter.id)).toContain('conditional-2');
    });

    it('should handle empty input', () => {
      const result = partitionRules([]);
      expect(result.alwaysApply).toHaveLength(0);
      expect(result.conditional).toHaveLength(0);
    });
  });
});
