import {
  ConfigSchema,
  ClaudeTargetSchema,
  CursorTargetSchema,
  AgentsTargetSchema,
  SelectionStrategySchema,
  ConflictResolutionStrategySchema,
  DEFAULT_CONFIG,
} from '../../src/schemas/config';

describe('ConfigSchema', () => {
  describe('SelectionStrategySchema', () => {
    it('should accept valid strategies', () => {
      expect(SelectionStrategySchema.parse('priority')).toBe('priority');
      expect(SelectionStrategySchema.parse('directory')).toBe('directory');
      expect(SelectionStrategySchema.parse('glob')).toBe('glob');
      expect(SelectionStrategySchema.parse('tag')).toBe('tag');
      expect(SelectionStrategySchema.parse('all')).toBe('all');
    });

    it('should reject invalid strategies', () => {
      expect(() => SelectionStrategySchema.parse('invalid')).toThrow();
      expect(() => SelectionStrategySchema.parse('')).toThrow();
      expect(() => SelectionStrategySchema.parse(123)).toThrow();
    });
  });

  describe('ConflictResolutionStrategySchema', () => {
    it('should accept valid strategies', () => {
      expect(ConflictResolutionStrategySchema.parse('priority_wins')).toBe('priority_wins');
      expect(ConflictResolutionStrategySchema.parse('merge')).toBe('merge');
    });

    it('should reject invalid strategies', () => {
      expect(() => ConflictResolutionStrategySchema.parse('invalid')).toThrow();
    });
  });

  describe('ClaudeTargetSchema', () => {
    it('should apply default values', () => {
      const result = ClaudeTargetSchema.parse({});
      expect(result.max_tokens).toBe(4000);
      expect(result.strategy).toBe('priority');
      expect(result.always_include).toEqual([]);
    });

    it('should accept valid configuration', () => {
      const result = ClaudeTargetSchema.parse({
        max_tokens: 8000,
        strategy: 'glob',
        always_include: ['project.md'],
      });
      expect(result.max_tokens).toBe(8000);
      expect(result.strategy).toBe('glob');
      expect(result.always_include).toEqual(['project.md']);
    });

    it('should reject negative max_tokens', () => {
      expect(() => ClaudeTargetSchema.parse({ max_tokens: -1 })).toThrow();
    });

    it('should reject non-integer max_tokens', () => {
      expect(() => ClaudeTargetSchema.parse({ max_tokens: 1.5 })).toThrow();
    });
  });

  describe('CursorTargetSchema', () => {
    it('should apply default strategy', () => {
      const result = CursorTargetSchema.parse({});
      expect(result.strategy).toBe('all');
    });

    it('should accept custom strategy', () => {
      const result = CursorTargetSchema.parse({ strategy: 'directory' });
      expect(result.strategy).toBe('directory');
    });
  });

  describe('AgentsTargetSchema', () => {
    it('should apply default values', () => {
      const result = AgentsTargetSchema.parse({});
      expect(result.max_tokens).toBe(8000);
      expect(result.strategy).toBe('priority');
      expect(result.include_dirs).toEqual([]);
    });

    it('should accept valid configuration', () => {
      const result = AgentsTargetSchema.parse({
        max_tokens: 16000,
        strategy: 'directory',
        include_dirs: ['backend', 'frontend'],
      });
      expect(result.max_tokens).toBe(16000);
      expect(result.strategy).toBe('directory');
      expect(result.include_dirs).toEqual(['backend', 'frontend']);
    });
  });

  describe('Full ConfigSchema', () => {
    it('should parse empty object with defaults', () => {
      const result = ConfigSchema.parse({});
      expect(result.version).toBe('1.0');
      expect(result.compile).toEqual({});
      expect(result.conflict_resolution.strategy).toBe('priority_wins');
    });

    it('should parse complete configuration', () => {
      const config = {
        version: '2.0',
        compile: {
          claude: { max_tokens: 5000, strategy: 'tag', always_include: ['intro.md'] },
          cursor: { strategy: 'directory' },
          agents: { max_tokens: 10000, strategy: 'glob', include_dirs: ['api'] },
        },
        conflict_resolution: { strategy: 'merge' },
        migration: { mode: 'attach', preserve_legacy: true, legacy_files: ['.cursorrules'] },
      };
      const result = ConfigSchema.parse(config);
      expect(result.version).toBe('2.0');
      expect(result.compile.claude?.max_tokens).toBe(5000);
      expect(result.compile.cursor?.strategy).toBe('directory');
      expect(result.migration?.mode).toBe('attach');
    });

    it('should accept partial configuration', () => {
      const config = {
        compile: {
          claude: { max_tokens: 6000 },
        },
      };
      const result = ConfigSchema.parse(config);
      expect(result.compile.claude?.max_tokens).toBe(6000);
      expect(result.compile.cursor).toBeUndefined();
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should be a valid configuration', () => {
      expect(() => ConfigSchema.parse(DEFAULT_CONFIG)).not.toThrow();
    });

    it('should have expected default values', () => {
      expect(DEFAULT_CONFIG.version).toBe('1.0');
      expect(DEFAULT_CONFIG.compile.claude?.max_tokens).toBe(4000);
      expect(DEFAULT_CONFIG.compile.cursor?.strategy).toBe('all');
      expect(DEFAULT_CONFIG.compile.agents?.max_tokens).toBe(8000);
      expect(DEFAULT_CONFIG.conflict_resolution.strategy).toBe('priority_wins');
    });
  });
});
