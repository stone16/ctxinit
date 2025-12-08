import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { z } from 'zod';
import {
  RuleFrontmatterSchema,
  RuleFrontmatter,
  ParsedRule,
  inferGlobsFromPath,
} from '../schemas/rule';
import { validatePath, validateSymlink, PathSecurityError } from './path-security';

/**
 * Error thrown when rule parsing fails
 */
export class RuleParseError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly line?: number,
    public readonly details?: z.ZodError
  ) {
    super(message);
    this.name = 'RuleParseError';
  }
}

/**
 * Options for parsing rules
 */
export interface ParseOptions {
  /** Project root directory */
  projectRoot: string;
  /** Path to the rules directory (default: .context/rules) */
  rulesDir?: string;
  /** Whether to validate symlinks (default: true) */
  validateSymlinks?: boolean;
}

/**
 * Parse a single rule file
 *
 * @param filePath - Path to the rule file (relative to rulesDir)
 * @param options - Parse options
 * @returns Parsed rule
 * @throws RuleParseError if parsing fails
 * @throws PathSecurityError if path is unsafe
 */
export function parseRule(filePath: string, options: ParseOptions): ParsedRule {
  const rulesDir = options.rulesDir || path.join(options.projectRoot, '.context', 'rules');

  // Validate path security
  validatePath(filePath, options.projectRoot);

  const absolutePath = path.join(rulesDir, filePath);

  // Validate symlink if enabled
  if (options.validateSymlinks !== false) {
    validateSymlink(absolutePath, options.projectRoot);
  }

  // Read file content
  let rawContent: string;
  try {
    rawContent = fs.readFileSync(absolutePath, 'utf-8');
  } catch (error) {
    throw new RuleParseError(
      `Failed to read rule file: ${(error as Error).message}`,
      filePath
    );
  }

  // Handle empty files
  if (!rawContent.trim()) {
    throw new RuleParseError(
      'Rule file is empty',
      filePath
    );
  }

  // Parse frontmatter using gray-matter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(rawContent);
  } catch (error) {
    throw new RuleParseError(
      `Failed to parse frontmatter: ${(error as Error).message}`,
      filePath
    );
  }

  // Handle missing frontmatter
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    throw new RuleParseError(
      'Rule file has no frontmatter. Add YAML frontmatter with at least an "id" field.',
      filePath
    );
  }

  // Validate frontmatter against schema
  const validation = RuleFrontmatterSchema.safeParse(parsed.data);

  if (!validation.success) {
    const firstError = validation.error.issues[0];
    throw new RuleParseError(
      `Invalid frontmatter at '${firstError.path.join('.')}': ${firstError.message}`,
      filePath,
      undefined,
      validation.error
    );
  }

  const frontmatter: RuleFrontmatter = validation.data;

  // Determine effective globs
  const inferredGlobs = inferGlobsFromPath(filePath);
  let effectiveGlobs: string[];

  if (frontmatter.globs) {
    // Use explicit globs
    effectiveGlobs = Array.isArray(frontmatter.globs)
      ? frontmatter.globs
      : [frontmatter.globs];
  } else {
    // Use inferred globs from directory path
    effectiveGlobs = inferredGlobs;
  }

  return {
    path: filePath,
    absolutePath,
    frontmatter,
    content: parsed.content.trim(),
    inferredGlobs,
    effectiveGlobs,
  };
}

/**
 * Parse all rule files in a directory
 *
 * @param options - Parse options
 * @returns Array of parsed rules and any errors encountered
 */
export function parseAllRules(options: ParseOptions): {
  rules: ParsedRule[];
  errors: RuleParseError[];
} {
  const rulesDir = options.rulesDir || path.join(options.projectRoot, '.context', 'rules');
  const rules: ParsedRule[] = [];
  const errors: RuleParseError[] = [];

  // Find all .md files recursively
  const findMarkdownFiles = (dir: string, baseDir: string): string[] => {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        files.push(...findMarkdownFiles(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(relativePath);
      }
    }

    return files;
  };

  const markdownFiles = findMarkdownFiles(rulesDir, rulesDir);

  for (const file of markdownFiles) {
    try {
      const rule = parseRule(file, { ...options, rulesDir });
      rules.push(rule);
    } catch (error) {
      if (error instanceof RuleParseError) {
        errors.push(error);
      } else if (error instanceof PathSecurityError) {
        errors.push(new RuleParseError(
          `Security violation: ${error.message}`,
          file
        ));
      } else {
        errors.push(new RuleParseError(
          `Unexpected error: ${(error as Error).message}`,
          file
        ));
      }
    }
  }

  return { rules, errors };
}

/**
 * Check if a file has valid frontmatter without fully parsing
 *
 * @param content - File content
 * @returns true if frontmatter appears valid
 */
export function hasValidFrontmatter(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) {
    return false;
  }

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex <= 3) {
    return false;
  }

  // Check that frontmatter is not empty (has actual content between delimiters)
  const frontmatterContent = trimmed.slice(3, endIndex).trim();
  return frontmatterContent.length > 0;
}
