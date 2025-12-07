import {
  RuleFrontmatterSchema,
  DEFAULT_PRIORITY,
  inferGlobsFromPath,
} from '../../src/schemas/rule';

describe('RuleFrontmatterSchema', () => {
  describe('required fields', () => {
    it('should require id field', () => {
      expect(() => RuleFrontmatterSchema.parse({})).toThrow();
      expect(() => RuleFrontmatterSchema.parse({ id: '' })).toThrow();
    });

    it('should accept valid id', () => {
      const result = RuleFrontmatterSchema.parse({ id: 'my-rule' });
      expect(result.id).toBe('my-rule');
    });
  });

  describe('optional fields', () => {
    it('should accept description', () => {
      const result = RuleFrontmatterSchema.parse({
        id: 'test',
        description: 'A test rule',
      });
      expect(result.description).toBe('A test rule');
    });

    it('should accept domain', () => {
      const result = RuleFrontmatterSchema.parse({
        id: 'test',
        domain: 'backend',
      });
      expect(result.domain).toBe('backend');
    });
  });

  describe('globs field', () => {
    it('should accept string glob', () => {
      const result = RuleFrontmatterSchema.parse({
        id: 'test',
        globs: '**/*.ts',
      });
      expect(result.globs).toBe('**/*.ts');
    });

    it('should accept array of globs', () => {
      const result = RuleFrontmatterSchema.parse({
        id: 'test',
        globs: ['**/*.ts', '**/*.js'],
      });
      expect(result.globs).toEqual(['**/*.ts', '**/*.js']);
    });

    it('should be optional', () => {
      const result = RuleFrontmatterSchema.parse({ id: 'test' });
      expect(result.globs).toBeUndefined();
    });
  });

  describe('priority field', () => {
    it('should default to 50', () => {
      const result = RuleFrontmatterSchema.parse({ id: 'test' });
      expect(result.priority).toBe(DEFAULT_PRIORITY);
    });

    it('should accept valid priority (0-100)', () => {
      expect(RuleFrontmatterSchema.parse({ id: 'test', priority: 0 }).priority).toBe(0);
      expect(RuleFrontmatterSchema.parse({ id: 'test', priority: 50 }).priority).toBe(50);
      expect(RuleFrontmatterSchema.parse({ id: 'test', priority: 100 }).priority).toBe(100);
    });

    it('should reject priority below 0', () => {
      expect(() => RuleFrontmatterSchema.parse({ id: 'test', priority: -1 })).toThrow();
    });

    it('should reject priority above 100', () => {
      expect(() => RuleFrontmatterSchema.parse({ id: 'test', priority: 101 })).toThrow();
    });

    it('should reject non-integer priority', () => {
      expect(() => RuleFrontmatterSchema.parse({ id: 'test', priority: 50.5 })).toThrow();
    });
  });

  describe('tags field', () => {
    it('should default to empty array', () => {
      const result = RuleFrontmatterSchema.parse({ id: 'test' });
      expect(result.tags).toEqual([]);
    });

    it('should accept array of tags', () => {
      const result = RuleFrontmatterSchema.parse({
        id: 'test',
        tags: ['security', 'performance'],
      });
      expect(result.tags).toEqual(['security', 'performance']);
    });
  });

  describe('always_apply field', () => {
    it('should default to false', () => {
      const result = RuleFrontmatterSchema.parse({ id: 'test' });
      expect(result.always_apply).toBe(false);
    });

    it('should accept true', () => {
      const result = RuleFrontmatterSchema.parse({
        id: 'test',
        always_apply: true,
      });
      expect(result.always_apply).toBe(true);
    });
  });

  describe('complete frontmatter', () => {
    it('should parse complete valid frontmatter', () => {
      const frontmatter = {
        id: 'auth-rules',
        description: 'Authentication related guidelines',
        domain: 'backend',
        globs: ['src/auth/**/*.ts'],
        priority: 80,
        tags: ['security', 'auth'],
        always_apply: false,
      };
      const result = RuleFrontmatterSchema.parse(frontmatter);
      expect(result).toEqual(frontmatter);
    });
  });
});

describe('inferGlobsFromPath', () => {
  it('should return wildcard for root level rules', () => {
    const globs = inferGlobsFromPath('my-rule.md');
    expect(globs).toEqual(['**/*']);
  });

  it('should infer globs from single directory', () => {
    const globs = inferGlobsFromPath('backend/auth.md');
    expect(globs).toContain('backend/**/*');
    expect(globs).toContain('src/backend/**/*');
    expect(globs).toContain('lib/backend/**/*');
  });

  it('should infer globs from nested directories', () => {
    const globs = inferGlobsFromPath('backend/auth/login.md');
    expect(globs).toContain('backend/auth/**/*');
    expect(globs).toContain('src/backend/auth/**/*');
    expect(globs).toContain('lib/backend/auth/**/*');
  });

  it('should infer globs from deep nesting', () => {
    const globs = inferGlobsFromPath('api/v2/handlers/users.md');
    expect(globs).toContain('api/v2/handlers/**/*');
    expect(globs).toContain('src/api/v2/handlers/**/*');
  });
});
