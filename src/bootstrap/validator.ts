/**
 * Bootstrap Output Validator
 *
 * Validates LLM-generated context files for:
 * - Valid file/directory references
 * - Valid glob patterns
 * - Correct YAML frontmatter structure
 * - LLM-specific best practices
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import fg from 'fast-glob';

import { BootstrapLLMOutput } from '../llm/types';
import { CodebaseAnalysis } from '../cli/bootstrap';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Frontmatter structure for rules
 */
interface RuleFrontmatter {
  id?: string;
  description?: string;
  globs?: string[];
  priority?: number;
  tags?: string[];
  always_apply?: boolean;
}

/**
 * Validate bootstrap output
 */
export async function validateBootstrapOutput(
  output: BootstrapLLMOutput,
  projectRoot: string,
  analysis: CodebaseAnalysis
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Validate project.md
  if (output.projectMd) {
    const projectValidation = validateMarkdownContent(
      output.projectMd,
      'project.md',
      projectRoot,
      analysis
    );
    errors.push(...projectValidation.errors);
    warnings.push(...projectValidation.warnings);
  }

  // Validate architecture.md
  if (output.architectureMd) {
    const archValidation = validateMarkdownContent(
      output.architectureMd,
      'architecture.md',
      projectRoot,
      analysis
    );
    errors.push(...archValidation.errors);
    warnings.push(...archValidation.warnings);
  }

  // Validate rules
  for (const rule of output.rules) {
    const ruleValidation = await validateRule(rule, projectRoot, analysis);
    errors.push(...ruleValidation.errors);
    warnings.push(...ruleValidation.warnings);
    suggestions.push(...ruleValidation.suggestions);
  }

  // Check for best practices
  const bestPractices = checkBestPractices(output, analysis);
  warnings.push(...bestPractices.warnings);
  suggestions.push(...bestPractices.suggestions);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate markdown content for file references
 */
function validateMarkdownContent(
  content: string,
  fileName: string,
  projectRoot: string,
  _analysis: CodebaseAnalysis
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract @file references
  const fileRefs = extractFileReferences(content);

  for (const ref of fileRefs) {
    const fullPath = path.join(projectRoot, ref);
    if (!fs.existsSync(fullPath)) {
      // Check if it's a directory
      const dirPath = fullPath.replace(/\/$/, '');
      if (!fs.existsSync(dirPath)) {
        errors.push(`${fileName}: Invalid file reference '@${ref}' - file does not exist`);
      }
    }
  }

  // Extract markdown links
  const links = extractMarkdownLinks(content);

  for (const link of links) {
    // Skip external URLs
    if (link.startsWith('http://') || link.startsWith('https://')) {
      continue;
    }

    // Check relative paths
    if (!link.startsWith('#')) {
      const fullPath = path.join(projectRoot, link);
      if (!fs.existsSync(fullPath)) {
        warnings.push(`${fileName}: Potentially broken link '${link}'`);
      }
    }
  }

  // Check for generic/vague content
  const genericPhrases = [
    'write clean code',
    'follow best practices',
    'be careful',
    'use appropriate',
    'ensure quality',
  ];

  for (const phrase of genericPhrases) {
    if (content.toLowerCase().includes(phrase)) {
      warnings.push(`${fileName}: Contains generic phrase '${phrase}' - be more specific`);
    }
  }

  return { errors, warnings };
}

/**
 * Validate a rule file
 */
async function validateRule(
  rule: { path: string; content: string },
  projectRoot: string,
  _analysis: CodebaseAnalysis
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Parse frontmatter
  const frontmatter = parseFrontmatter(rule.content);

  if (!frontmatter) {
    errors.push(`${rule.path}: Missing or invalid YAML frontmatter`);
    return { valid: false, errors, warnings, suggestions };
  }

  // Validate required frontmatter fields
  if (!frontmatter.id) {
    errors.push(`${rule.path}: Missing required 'id' in frontmatter`);
  } else if (!/^[a-z0-9-]+$/.test(frontmatter.id)) {
    warnings.push(`${rule.path}: Rule ID '${frontmatter.id}' should be lowercase with hyphens`);
  }

  if (!frontmatter.description) {
    warnings.push(`${rule.path}: Missing 'description' in frontmatter`);
  }

  // Validate globs
  if (frontmatter.globs && Array.isArray(frontmatter.globs)) {
    for (const glob of frontmatter.globs) {
      const globValidation = validateGlobPattern(glob, projectRoot);
      if (!globValidation.valid) {
        errors.push(`${rule.path}: Invalid glob pattern '${glob}': ${globValidation.reason}`);
      } else if (globValidation.warning) {
        warnings.push(`${rule.path}: Glob warning for '${glob}': ${globValidation.warning}`);
      }

      // Check if glob matches any files
      const matches = await fg(glob, { cwd: projectRoot, onlyFiles: true, dot: true });
      if (matches.length === 0) {
        warnings.push(`${rule.path}: Glob '${glob}' matches no files in project`);
      }
    }
  } else {
    warnings.push(`${rule.path}: Missing 'globs' array in frontmatter`);
  }

  // Validate priority
  if (frontmatter.priority !== undefined) {
    if (typeof frontmatter.priority !== 'number' || frontmatter.priority < 0 || frontmatter.priority > 100) {
      errors.push(`${rule.path}: Priority must be a number between 0 and 100`);
    }
  }

  // Validate content
  const contentValidation = validateMarkdownContent(
    rule.content,
    rule.path,
    projectRoot,
    _analysis
  );
  errors.push(...contentValidation.errors);
  warnings.push(...contentValidation.warnings);

  // Check content quality
  const bodyContent = rule.content.replace(/^---[\s\S]*?---/, '').trim();

  if (bodyContent.length < 100) {
    warnings.push(`${rule.path}: Rule content is very short (${bodyContent.length} chars)`);
  }

  // Check for imperative style
  const sentences = bodyContent.split(/[.!]\s+/);
  let nonImperativeCount = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > 10) {
      // Check for non-imperative patterns
      if (/^(you should|you must|we should|it is|there are|this is)/i.test(trimmed)) {
        nonImperativeCount++;
      }
    }
  }

  if (nonImperativeCount > 2) {
    suggestions.push(`${rule.path}: Consider using more imperative style (e.g., "Use X" instead of "You should use X")`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Parse YAML frontmatter from content
 */
function parseFrontmatter(content: string): RuleFrontmatter | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  try {
    const yaml = match[1];
    const frontmatter: RuleFrontmatter = {};

    // Simple YAML parser for frontmatter
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let inArray = false;
    let arrayValues: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('- ') && inArray && currentKey) {
        // Array item
        const value = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
        arrayValues.push(value);
      } else if (trimmed.includes(':')) {
        // Save previous array if exists
        if (inArray && currentKey && arrayValues.length > 0) {
          (frontmatter as Record<string, unknown>)[currentKey] = arrayValues;
          arrayValues = [];
          inArray = false;
        }

        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();

        if (value === '' || value === '|' || value === '>') {
          // Start of array or multiline
          currentKey = key;
          inArray = true;
          arrayValues = [];
        } else {
          // Simple value
          currentKey = key;
          let parsedValue: string | number | boolean = value.replace(/^["']|["']$/g, '');

          // Parse numbers and booleans
          if (parsedValue === 'true') parsedValue = true as unknown as string;
          else if (parsedValue === 'false') parsedValue = false as unknown as string;
          else if (/^\d+$/.test(parsedValue)) parsedValue = parseInt(parsedValue, 10) as unknown as string;

          (frontmatter as Record<string, unknown>)[key] = parsedValue;
          inArray = false;
        }
      }
    }

    // Save final array if exists
    if (inArray && currentKey && arrayValues.length > 0) {
      (frontmatter as Record<string, unknown>)[currentKey] = arrayValues;
    }

    return frontmatter;
  } catch {
    return null;
  }
}

/**
 * Validate a glob pattern
 */
function validateGlobPattern(
  pattern: string,
  _projectRoot: string
): { valid: boolean; reason?: string; warning?: string } {
  // Check for common glob syntax errors
  if (pattern.includes('[') && !pattern.includes(']')) {
    return { valid: false, reason: 'Unclosed bracket' };
  }

  if (pattern.includes('{') && !pattern.includes('}')) {
    return { valid: false, reason: 'Unclosed brace' };
  }

  // Check for overly broad patterns
  if (pattern === '**' || pattern === '**/*') {
    return { valid: true, warning: 'Pattern matches all files - consider being more specific' };
  }

  // Check for common mistakes
  if (pattern.includes('***')) {
    return { valid: false, reason: 'Invalid glob: ***' };
  }

  // Check for missing ** in deep patterns
  if (/^[^*]+\/\*\.[a-z]+$/.test(pattern) && !pattern.includes('**')) {
    return {
      valid: true,
      warning: `Pattern '${pattern}' only matches one level - use ** for recursive matching`,
    };
  }

  // Validate by trying to compile the pattern
  try {
    // Use os.tmpdir() for cross-platform compatibility (Windows support)
    fg.sync(pattern, { cwd: os.tmpdir(), onlyFiles: true });
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid glob syntax' };
  }
}

/**
 * Extract @file references from content
 */
function extractFileReferences(content: string): string[] {
  const refs: string[] = [];
  const regex = /@([a-zA-Z0-9_\-./]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Filter out common false positives
    const ref = match[1];
    if (!ref.includes('@') && !ref.startsWith('param') && !ref.startsWith('returns')) {
      refs.push(ref);
    }
  }

  return refs;
}

/**
 * Extract markdown links from content
 */
function extractMarkdownLinks(content: string): string[] {
  const links: string[] = [];

  // [text](url) style links
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[2]);
  }

  return links;
}

/**
 * Check for best practices in generated content
 */
function checkBestPractices(
  output: BootstrapLLMOutput,
  analysis: CodebaseAnalysis
): { warnings: string[]; suggestions: string[] } {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check rule coverage
  const hasProjectIdentity = output.rules.some((r) =>
    r.path.includes('project-identity') || r.content.includes('mission')
  );
  if (!hasProjectIdentity) {
    suggestions.push('Consider adding a project-identity rule with mission and tech stack');
  }

  const hasArchitectureMap = output.rules.some((r) =>
    r.path.includes('architecture') || r.path.includes('structure')
  );
  if (!hasArchitectureMap) {
    suggestions.push('Consider adding an architecture-map rule with directory purposes');
  }

  const hasCommands = output.rules.some((r) =>
    r.path.includes('command') || r.content.includes('npm run') || r.content.includes('yarn')
  );
  if (!hasCommands && analysis.packageInfo?.scripts) {
    suggestions.push('Consider adding a commands rule with available npm scripts');
  }

  // Check for language-specific rules
  const primaryLanguages = analysis.languages.slice(0, 2).map((l) => l.name.toLowerCase());
  for (const lang of primaryLanguages) {
    const hasLangRule = output.rules.some((r) =>
      r.path.toLowerCase().includes(lang) || r.content.toLowerCase().includes(`${lang} patterns`)
    );
    if (!hasLangRule) {
      suggestions.push(`Consider adding ${lang}-specific coding patterns rule`);
    }
  }

  // Check total rule count
  if (output.rules.length < 3) {
    warnings.push('Very few rules generated - consider adding more specific guidance');
  } else if (output.rules.length > 20) {
    warnings.push('Many rules generated - LLMs may struggle with too many instructions');
  }

  // Check for token efficiency
  const totalContent = (output.projectMd || '').length +
    (output.architectureMd || '').length +
    output.rules.reduce((sum, r) => sum + r.content.length, 0);

  if (totalContent > 50000) {
    warnings.push(`Total content is ${Math.round(totalContent / 1000)}KB - consider condensing for token efficiency`);
  }

  // Check for duplicate content
  const ruleContents = output.rules.map((r) => r.content.toLowerCase());
  for (let i = 0; i < ruleContents.length; i++) {
    for (let j = i + 1; j < ruleContents.length; j++) {
      const similarity = calculateSimilarity(ruleContents[i], ruleContents[j]);
      if (similarity > 0.7) {
        warnings.push(`Rules '${output.rules[i].path}' and '${output.rules[j].path}' have similar content (${Math.round(similarity * 100)}%)`);
      }
    }
  }

  return { warnings, suggestions };
}

/**
 * Calculate simple similarity between two strings
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 3));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}
