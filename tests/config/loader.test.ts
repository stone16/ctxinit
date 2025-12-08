import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  validateConfig,
  getDefaultConfig,
  mergeWithDefaults,
  ConfigError,
} from '../../src/config/loader';
import { DEFAULT_CONFIG } from '../../src/schemas/config';

describe('Config Loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createContextDir = (configContent?: string): void => {
    const contextDir = path.join(tempDir, '.context');
    fs.mkdirSync(contextDir, { recursive: true });
    if (configContent !== undefined) {
      fs.writeFileSync(path.join(contextDir, 'config.yaml'), configContent);
    }
  };

  describe('loadConfig', () => {
    it('should return defaults when no config file exists', () => {
      const result = loadConfig(tempDir);
      expect(result.source).toBe('defaults');
      expect(result.config).toEqual(DEFAULT_CONFIG);
      expect(result.warnings).toContain('No config.yaml found, using defaults');
    });

    it('should return defaults for empty config file', () => {
      createContextDir('');
      const result = loadConfig(tempDir);
      expect(result.source).toBe('defaults');
      expect(result.warnings).toContain('config.yaml is empty, using defaults');
    });

    it('should return defaults for whitespace-only config file', () => {
      createContextDir('   \n\n  ');
      const result = loadConfig(tempDir);
      expect(result.source).toBe('defaults');
    });

    it('should parse valid YAML config', () => {
      createContextDir(`
version: "2.0"
compile:
  claude:
    max_tokens: 5000
    strategy: tag
`);
      const result = loadConfig(tempDir);
      expect(result.source).toBe('file');
      expect(result.config.version).toBe('2.0');
      expect(result.config.compile.claude?.max_tokens).toBe(5000);
      expect(result.config.compile.claude?.strategy).toBe('tag');
    });

    it('should warn about unknown keys', () => {
      createContextDir(`
version: "1.0"
unknown_key: value
another_unknown: 123
`);
      const result = loadConfig(tempDir);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('unknown_key');
      expect(result.warnings[0]).toContain('another_unknown');
    });

    it('should throw ConfigError for invalid YAML syntax', () => {
      createContextDir(`
version: "1.0"
compile:
  claude:
    max_tokens: [invalid
`);
      expect(() => loadConfig(tempDir)).toThrow(ConfigError);
      expect(() => loadConfig(tempDir)).toThrow(/Invalid YAML syntax/);
    });

    it('should throw ConfigError for invalid configuration values', () => {
      createContextDir(`
compile:
  claude:
    max_tokens: -100
`);
      expect(() => loadConfig(tempDir)).toThrow(ConfigError);
      expect(() => loadConfig(tempDir)).toThrow(/validation failed/);
    });

    it('should throw ConfigError for invalid strategy', () => {
      createContextDir(`
compile:
  claude:
    strategy: invalid_strategy
`);
      expect(() => loadConfig(tempDir)).toThrow(ConfigError);
    });

    it('should handle complete valid configuration', () => {
      createContextDir(`
version: "1.0"
compile:
  claude:
    max_tokens: 4000
    strategy: priority
    always_include:
      - intro.md
  cursor:
    strategy: all
  agents:
    max_tokens: 8000
    strategy: directory
    include_dirs:
      - backend
      - frontend
conflict_resolution:
  strategy: merge
migration:
  mode: attach
  preserve_legacy: true
  legacy_files:
    - .cursorrules
`);
      const result = loadConfig(tempDir);
      expect(result.source).toBe('file');
      expect(result.config.compile.claude?.always_include).toEqual(['intro.md']);
      expect(result.config.compile.agents?.include_dirs).toEqual(['backend', 'frontend']);
      expect(result.config.migration?.mode).toBe('attach');
      expect(result.config.migration?.preserve_legacy).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const result = validateConfig(DEFAULT_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid config', () => {
      const result = validateConfig({
        compile: {
          claude: { max_tokens: -1 },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for invalid strategy', () => {
      const result = validateConfig({
        compile: {
          claude: { strategy: 'invalid' },
        },
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return a copy of DEFAULT_CONFIG', () => {
      const config = getDefaultConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
      expect(config).not.toBe(DEFAULT_CONFIG); // Should be a copy
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge partial config with defaults', () => {
      const partial = {
        compile: {
          claude: { max_tokens: 6000, strategy: 'priority' as const, always_include: [] },
        },
      };
      const merged = mergeWithDefaults(partial);
      expect(merged.compile.claude?.max_tokens).toBe(6000);
      expect(merged.compile.cursor?.strategy).toBe('all'); // Default
      expect(merged.conflict_resolution.strategy).toBe('priority_wins'); // Default
    });

    it('should override conflict resolution', () => {
      const partial = {
        conflict_resolution: { strategy: 'merge' as const },
      };
      const merged = mergeWithDefaults(partial);
      expect(merged.conflict_resolution.strategy).toBe('merge');
    });
  });
});

describe('ConfigError', () => {
  it('should have correct name', () => {
    const error = new ConfigError('test message');
    expect(error.name).toBe('ConfigError');
  });

  it('should store line number', () => {
    const error = new ConfigError('test message', 42);
    expect(error.line).toBe(42);
  });

  it('should store details', () => {
    const error = new ConfigError('test message', undefined, undefined);
    expect(error.details).toBeUndefined();
  });
});
