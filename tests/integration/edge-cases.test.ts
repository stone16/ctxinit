/**
 * Edge Case Tests
 *
 * Tests for unusual but valid scenarios and boundary conditions
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseAllRules, ParseOptions } from '../../src/parser/rule-parser';
import { loadConfig } from '../../src/config/loader';
import { BuildOrchestrator, BuildOptions } from '../../src/build/orchestrator';
import { estimateTokens } from '../../src/compiler/token-estimator';

describe('Edge Cases', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-edge-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function setupContextDir() {
    const contextDir = path.join(tempDir, '.context');
    const rulesDir = path.join(contextDir, 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(contextDir, 'config.yaml'),
      'version: "1.0"\nproject:\n  name: test\n  description: Test\ncompile:\n  claude:\n    max_tokens: 4000\n    strategy: all\n'
    );
    fs.writeFileSync(
      path.join(contextDir, 'project.md'),
      '# Test Project\n\nDescription.'
    );
    return { contextDir, rulesDir };
  }

  describe('Empty Rules Directory', () => {
    it('should handle empty rules directory gracefully', () => {
      setupContextDir();

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir: path.join(tempDir, '.context', 'rules'),
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(0);
    });

    it('should build with empty rules producing valid output', async () => {
      setupContextDir();

      const configResult = loadConfig(tempDir);
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config);
      const buildOptions: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      };

      const result = await orchestrator.build(buildOptions);
      // Should succeed even with no rules
      expect(result.success).toBe(true);
    });
  });

  describe('Large Rule Files', () => {
    it('should handle very large rule files (>100KB)', () => {
      const { rulesDir } = setupContextDir();

      // Create a rule file with ~150KB of content
      const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(5000);
      fs.writeFileSync(
        path.join(rulesDir, 'large-rule.md'),
        `---\nid: large-rule\ndescription: Very large rule\n---\n\n# Large Rule\n\n${largeContent}`
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].content.length).toBeGreaterThan(100000);
    });

    it('should estimate tokens for large content', () => {
      const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(5000);
      const estimate = estimateTokens(largeContent);

      expect(estimate.tokens).toBeGreaterThan(10000);
      expect(estimate.characters).toBe(largeContent.length);
    });
  });

  describe('Deep Nesting', () => {
    it('should handle deeply nested rule directories (>10 levels)', () => {
      const { rulesDir } = setupContextDir();

      // Create deeply nested path
      const deepPath = Array.from({ length: 12 }, (_, i) => `level${i}`).join('/');
      const fullPath = path.join(rulesDir, deepPath);
      fs.mkdirSync(fullPath, { recursive: true });

      fs.writeFileSync(
        path.join(fullPath, 'deep-rule.md'),
        '---\nid: deep-rule\ndescription: Deeply nested rule\n---\n\n# Deep Rule\n\nContent.'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.id).toBe('deep-rule');
      expect(rules[0].path).toContain('level11');
    });
  });

  describe('Unicode Support', () => {
    it('should handle Unicode in file names', () => {
      const { rulesDir } = setupContextDir();

      // Create rule with Unicode filename
      fs.writeFileSync(
        path.join(rulesDir, '日本語ルール.md'),
        '---\nid: japanese-rule\ndescription: Japanese rule\n---\n\n# 日本語ルール\n\n内容です。'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.id).toBe('japanese-rule');
    });

    it('should handle Unicode in content', () => {
      const { rulesDir } = setupContextDir();

      const unicodeContent = `
# Multilingual Rule

## English
This is English content.

## 日本語
これは日本語のコンテンツです。

## Emoji 🚀
Rules can include emojis!

## Chinese
这是中文内容。

## Arabic
هذا محتوى عربي
      `.trim();

      fs.writeFileSync(
        path.join(rulesDir, 'unicode-rule.md'),
        `---\nid: unicode-rule\ndescription: Unicode content\n---\n\n${unicodeContent}`
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].content).toContain('日本語');
      expect(rules[0].content).toContain('🚀');
      expect(rules[0].content).toContain('中文');
    });

    it('should handle emojis in frontmatter', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'emoji-rule.md'),
        '---\nid: emoji-rule\ndescription: "🚀 Rocket rule with emojis 🎉"\n---\n\n# Emoji Rule\n\nContent.'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.description).toContain('🚀');
    });
  });

  describe('Special Characters', () => {
    it('should handle special characters in rule content', () => {
      const { rulesDir } = setupContextDir();

      const specialContent = `
# Special Characters Rule

## Code Examples
\`\`\`typescript
const regex = /[a-z]+/g;
const template = \`Hello \${name}\`;
const chars = '<>&"\\';
\`\`\`

## Symbols
→ Arrow
• Bullet
— Em dash
" " Quotes
< > Angle brackets
& Ampersand
      `.trim();

      fs.writeFileSync(
        path.join(rulesDir, 'special-chars.md'),
        `---\nid: special-chars\ndescription: Special characters test\n---\n\n${specialContent}`
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].content).toContain('regex');
      expect(rules[0].content).toContain('→');
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle rule with only frontmatter (empty content)', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'empty-content.md'),
        '---\nid: empty-content\ndescription: Rule with no content\n---\n\n'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].content.trim()).toBe('');
    });

    it('should handle rule with minimal valid frontmatter', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'minimal.md'),
        '---\nid: minimal\n---\n\nMinimal rule.'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.id).toBe('minimal');
    });

    it('should handle rule with maximum frontmatter fields', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'maximal.md'),
        `---
id: maximal
description: Maximal frontmatter
priority: 100
always_apply: true
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.tsx"
tags:
  - tag1
  - tag2
  - tag3
domain: backend
---

# Maximal Rule

Content with all fields populated.`
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.priority).toBe(100);
      expect(rules[0].frontmatter.always_apply).toBe(true);
      expect(rules[0].frontmatter.globs).toHaveLength(3);
      expect(rules[0].frontmatter.tags).toHaveLength(3);
    });

    it('should handle priority of 0', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'zero-priority.md'),
        '---\nid: zero-priority\npriority: 0\n---\n\nZero priority rule.'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.priority).toBe(0);
    });

    it('should handle maximum valid priority value (100)', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'high-priority.md'),
        '---\nid: high-priority\npriority: 100\n---\n\nMaximum priority rule.'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.priority).toBe(100);
    });

    it('should reject priority values exceeding 100', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'invalid-priority.md'),
        '---\nid: invalid-priority\npriority: 999999\n---\n\nInvalid priority rule.'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules, errors } = parseAllRules(parseOptions);

      // Rule should be rejected due to invalid priority
      expect(rules).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Rules', () => {
    it('should handle 100 rules', () => {
      const { rulesDir } = setupContextDir();

      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(
          path.join(rulesDir, `rule-${i}.md`),
          `---\nid: rule-${i}\ndescription: Rule number ${i}\npriority: ${i}\n---\n\n# Rule ${i}\n\nContent for rule ${i}.`
        );
      }

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(100);
    });
  });

  describe('Whitespace Handling', () => {
    it('should handle rule with excessive whitespace', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'whitespace.md'),
        `---
id: whitespace
description: "  Spaces around  "
---



# Lots of Whitespace



Content with        multiple       spaces.



And blank lines.


`
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].frontmatter.id).toBe('whitespace');
    });

    it('should handle tabs in content', () => {
      const { rulesDir } = setupContextDir();

      fs.writeFileSync(
        path.join(rulesDir, 'tabs.md'),
        '---\nid: tabs\n---\n\n# Tabs\n\n\tIndented with tab\n\t\tDouble indent'
      );

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir,
      };
      const { rules } = parseAllRules(parseOptions);

      expect(rules).toHaveLength(1);
      expect(rules[0].content).toContain('\t');
    });
  });
});
