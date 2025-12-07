import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseRule,
  parseAllRules,
  hasValidFrontmatter,
  RuleParseError,
} from '../../src/parser/rule-parser';
import { PathSecurityError } from '../../src/parser/path-security';

describe('Rule Parser', () => {
  let tempDir: string;
  let rulesDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-parser-test-'));
    rulesDir = path.join(tempDir, '.context', 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writeRule = (relativePath: string, content: string): void => {
    const fullPath = path.join(rulesDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  };

  describe('parseRule', () => {
    describe('valid rules', () => {
      it('should parse rule with all frontmatter fields', () => {
        writeRule('auth.md', `---
id: auth-rules
description: Authentication guidelines
domain: backend
globs:
  - "src/auth/**/*.ts"
priority: 80
tags:
  - security
  - auth
always_apply: false
---

# Authentication Rules

Always use secure password hashing.
`);

        const rule = parseRule('auth.md', { projectRoot: tempDir });

        expect(rule.path).toBe('auth.md');
        expect(rule.frontmatter.id).toBe('auth-rules');
        expect(rule.frontmatter.description).toBe('Authentication guidelines');
        expect(rule.frontmatter.domain).toBe('backend');
        expect(rule.frontmatter.priority).toBe(80);
        expect(rule.frontmatter.tags).toEqual(['security', 'auth']);
        expect(rule.frontmatter.globs).toEqual(['src/auth/**/*.ts']);
        expect(rule.content).toBe('# Authentication Rules\n\nAlways use secure password hashing.');
      });

      it('should parse rule with minimal frontmatter', () => {
        writeRule('simple.md', `---
id: simple-rule
---

Simple content.
`);

        const rule = parseRule('simple.md', { projectRoot: tempDir });

        expect(rule.frontmatter.id).toBe('simple-rule');
        expect(rule.frontmatter.priority).toBe(50); // Default
        expect(rule.frontmatter.tags).toEqual([]); // Default
        expect(rule.frontmatter.always_apply).toBe(false); // Default
      });

      it('should handle string glob', () => {
        writeRule('string-glob.md', `---
id: string-glob
globs: "**/*.ts"
---

Content.
`);

        const rule = parseRule('string-glob.md', { projectRoot: tempDir });
        expect(rule.effectiveGlobs).toEqual(['**/*.ts']);
      });

      it('should infer globs from directory path', () => {
        writeRule('backend/api/handlers.md', `---
id: handlers
---

Handler rules.
`);

        const rule = parseRule('backend/api/handlers.md', { projectRoot: tempDir });

        expect(rule.inferredGlobs).toContain('backend/api/**/*');
        expect(rule.inferredGlobs).toContain('src/backend/api/**/*');
        expect(rule.effectiveGlobs).toEqual(rule.inferredGlobs);
      });

      it('should use explicit globs over inferred', () => {
        writeRule('backend/explicit.md', `---
id: explicit
globs:
  - "custom/**/*.ts"
---

Content.
`);

        const rule = parseRule('backend/explicit.md', { projectRoot: tempDir });

        expect(rule.effectiveGlobs).toEqual(['custom/**/*.ts']);
        expect(rule.inferredGlobs).toContain('backend/**/*');
      });
    });

    describe('error handling', () => {
      it('should throw for empty file', () => {
        writeRule('empty.md', '');

        expect(() => parseRule('empty.md', { projectRoot: tempDir }))
          .toThrow(RuleParseError);
        expect(() => parseRule('empty.md', { projectRoot: tempDir }))
          .toThrow('empty');
      });

      it('should throw for whitespace-only file', () => {
        writeRule('whitespace.md', '   \n\n  ');

        expect(() => parseRule('whitespace.md', { projectRoot: tempDir }))
          .toThrow(RuleParseError);
      });

      it('should throw for missing frontmatter', () => {
        writeRule('no-frontmatter.md', '# Just a title\n\nNo frontmatter here.');

        expect(() => parseRule('no-frontmatter.md', { projectRoot: tempDir }))
          .toThrow(RuleParseError);
        expect(() => parseRule('no-frontmatter.md', { projectRoot: tempDir }))
          .toThrow('no frontmatter');
      });

      it('should throw for missing id field', () => {
        writeRule('no-id.md', `---
description: No ID field
---

Content.
`);

        expect(() => parseRule('no-id.md', { projectRoot: tempDir }))
          .toThrow(RuleParseError);
        expect(() => parseRule('no-id.md', { projectRoot: tempDir }))
          .toThrow('id');
      });

      it('should throw for invalid priority', () => {
        writeRule('bad-priority.md', `---
id: bad-priority
priority: 150
---

Content.
`);

        expect(() => parseRule('bad-priority.md', { projectRoot: tempDir }))
          .toThrow(RuleParseError);
      });

      it('should throw for non-existent file', () => {
        expect(() => parseRule('nonexistent.md', { projectRoot: tempDir }))
          .toThrow(RuleParseError);
      });

      it('should include path in error', () => {
        writeRule('error-path.md', '');

        try {
          parseRule('error-path.md', { projectRoot: tempDir });
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(RuleParseError);
          expect((error as RuleParseError).path).toBe('error-path.md');
        }
      });
    });

    describe('path security', () => {
      it('should reject path traversal', () => {
        expect(() => parseRule('../outside.md', { projectRoot: tempDir }))
          .toThrow(PathSecurityError);
      });

      it('should reject absolute paths', () => {
        expect(() => parseRule('/etc/passwd', { projectRoot: tempDir }))
          .toThrow(PathSecurityError);
      });

      it('should reject null bytes', () => {
        expect(() => parseRule('file\0.md', { projectRoot: tempDir }))
          .toThrow(PathSecurityError);
      });
    });
  });

  describe('parseAllRules', () => {
    it('should parse all markdown files recursively', () => {
      writeRule('rule1.md', `---
id: rule1
---
Content 1.
`);
      writeRule('nested/rule2.md', `---
id: rule2
---
Content 2.
`);
      writeRule('deep/nested/rule3.md', `---
id: rule3
---
Content 3.
`);

      const result = parseAllRules({ projectRoot: tempDir });

      expect(result.rules).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.rules.map(r => r.frontmatter.id).sort()).toEqual(['rule1', 'rule2', 'rule3']);
    });

    it('should collect errors without stopping', () => {
      writeRule('valid.md', `---
id: valid
---
Valid rule.
`);
      writeRule('invalid.md', `---
description: Missing ID
---
Invalid rule.
`);
      writeRule('empty.md', '');

      const result = parseAllRules({ projectRoot: tempDir });

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].frontmatter.id).toBe('valid');
      expect(result.errors).toHaveLength(2);
    });

    it('should handle empty rules directory', () => {
      const result = parseAllRules({ projectRoot: tempDir });

      expect(result.rules).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle non-existent rules directory', () => {
      const nonExistent = path.join(os.tmpdir(), 'nonexistent-' + Date.now());

      const result = parseAllRules({ projectRoot: nonExistent });

      expect(result.rules).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should ignore non-markdown files', () => {
      writeRule('valid.md', `---
id: valid
---
Content.
`);
      fs.writeFileSync(path.join(rulesDir, 'readme.txt'), 'text file');
      fs.writeFileSync(path.join(rulesDir, 'config.json'), '{}');

      const result = parseAllRules({ projectRoot: tempDir });

      expect(result.rules).toHaveLength(1);
    });
  });

  describe('hasValidFrontmatter', () => {
    it('should return true for valid frontmatter', () => {
      expect(hasValidFrontmatter(`---
id: test
---
Content.
`)).toBe(true);
    });

    it('should return false for no frontmatter', () => {
      expect(hasValidFrontmatter('# Just markdown')).toBe(false);
      expect(hasValidFrontmatter('No frontmatter here')).toBe(false);
    });

    it('should return false for unclosed frontmatter', () => {
      expect(hasValidFrontmatter(`---
id: test
Content without closing.
`)).toBe(false);
    });

    it('should return false for empty frontmatter', () => {
      expect(hasValidFrontmatter(`---
---
Content.
`)).toBe(false);
    });
  });
});

describe('RuleParseError', () => {
  it('should have correct name', () => {
    const error = new RuleParseError('test', 'file.md');
    expect(error.name).toBe('RuleParseError');
  });

  it('should store path and line', () => {
    const error = new RuleParseError('test', 'file.md', 42);
    expect(error.path).toBe('file.md');
    expect(error.line).toBe(42);
  });
});
