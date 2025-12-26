/**
 * Bootstrap Prompt Template
 *
 * Internal prompt for LLM to generate/enhance .context files.
 * This is NOT saved to a file - it's used directly with the LLM provider.
 */

import { CodebaseAnalysis } from '../../cli/bootstrap';

/**
 * System prompt for bootstrap operation
 */
export const BOOTSTRAP_SYSTEM_PROMPT = `You are an expert AI context engineer. Your task is to generate high-quality context files for AI coding assistants (Claude Code, Cursor, Codex).

## Critical Philosophy

### 1. Context Files are System Prompts, Not Documentation
Every line must be:
- Machine-actionable, not human-readable prose
- Concise, imperative, and unambiguous
- High-value (context is limited real estate)

### 2. LLM Cognitive Constraints
- Lost in the middle: Transformers degrade attention mid-context
- Saturation point: ~150-200 distinct instructions is practical limit
- Relevance filtering: LLMs ignore context that appears irrelevant

### 3. Never Use Context as a Linter
LLMs are probabilistic. For deterministic rules (formatting, naming), use actual linters.
Reserve context for:
- Architectural decisions
- Workflow patterns
- Domain-specific context
- Things that can't be automated

### 4. Progressive Disclosure
- Root files act as map and index
- Detailed docs live in subdirectories
- Use referral: "When modifying X, first read @path/to/detail.md"

## Output Format

You MUST respond with a valid JSON object in this exact structure:

{
  "projectMd": "# Project Content\\n...",
  "architectureMd": "# Architecture\\n...",
  "rules": [
    {
      "path": "rules/project-identity.md",
      "content": "---\\nid: project-identity\\n...\\n---\\n# Content"
    }
  ],
  "suggestions": ["Optional suggestions for the user"]
}

## Rule File Format

Each rule must have YAML frontmatter:

\`\`\`markdown
---
id: unique-rule-id
description: Brief machine-readable description
globs:
  - "**/*.ts"
  - "src/**/*"
priority: 50
tags:
  - category
always_apply: false
---

# Rule Title

[Dense, imperative instructions]

## Section

- Bullet points preferred
- Each point is discrete instruction
- Use code blocks for examples
\`\`\`

## Writing Style

1. Imperative voice: "Use X" not "You should use X"
2. Dense: One instruction per line, no filler
3. Specific: Include file paths where helpful
4. Actionable: Every sentence changes behavior
5. No prose: Use structured lists

## Anti-Patterns to Avoid

- Generic advice ("write clean code")
- Duplicating linter rules
- Long explanations of "why"
- Vague instructions ("be careful with X")
- Marketing language ("elegant", "robust")`;

/**
 * Build the user prompt with analysis data
 */
export function buildBootstrapUserPrompt(
  analysis: CodebaseAnalysis,
  existingContext?: {
    scaffolds?: string[];
    projectMd?: string;
    architectureMd?: string;
    existingRules?: Array<{ path: string; content: string }>;
    bootstrapGuidance?: string;
  }
): string {
  const sections: string[] = [];

  // Project Analysis Section
  sections.push(`# Project Analysis

**Project Name**: ${analysis.projectName}
**Primary Languages**: ${analysis.languages.map(l => `${l.name} (${l.percentage}%)`).join(', ') || 'Unknown'}
**Frameworks**: ${analysis.frameworks.join(', ') || 'None detected'}
**Build Tools**: ${analysis.buildTools.join(', ') || 'None detected'}
**Testing Tools**: ${analysis.testingTools.join(', ') || 'None detected'}

## Directory Structure

**Top-level directories**: ${analysis.structure.topLevel.join(', ') || 'None'}
**Source structure**: ${analysis.structure.srcStructure.length > 0 ? analysis.structure.srcStructure.map(d => `src/${d}`).join(', ') : 'Flat or no src/'}
**Has tests**: ${analysis.structure.hasTests ? 'Yes' : 'No'}
**Has docs**: ${analysis.structure.hasDocs ? 'Yes' : 'No'}`);

  // Package Info Section
  if (analysis.packageInfo) {
    const pkg = analysis.packageInfo;
    sections.push(`
## Package Information

**Type**: ${pkg.type}
**Description**: ${pkg.description || 'None'}
**Key Dependencies**: ${pkg.dependencies.slice(0, 20).join(', ')}${pkg.dependencies.length > 20 ? '...' : ''}
**Scripts**: ${Object.keys(pkg.scripts).join(', ') || 'None'}`);
  }

  // Existing Documentation
  if (analysis.existingDocs.length > 0) {
    sections.push(`
## Existing Documentation

The following documentation exists in the project:`);

    for (const doc of analysis.existingDocs) {
      sections.push(`
### ${doc.path} (${doc.type})
\`\`\`
${doc.excerpt}
\`\`\``);
    }
  }

  // Sample Code Files
  if (analysis.sampleFiles.length > 0) {
    sections.push(`
## Sample Code Files

These files represent the coding patterns in this project:`);

    for (const sample of analysis.sampleFiles) {
      sections.push(`
### ${sample.path} (${sample.language})
\`\`\`${sample.language.toLowerCase()}
${sample.content}
\`\`\``);
    }
  }

  // Existing Context (to preserve user edits)
  if (existingContext) {
    if (existingContext.bootstrapGuidance?.trim()) {
      sections.push(`
## Bootstrap Guidance (USER-PROVIDED)

These instructions are highest priority for generation. Follow them, but keep outputs machine-actionable and project-specific.

\`\`\`markdown
${existingContext.bootstrapGuidance.trim()}
\`\`\``);
    }

    if (existingContext.scaffolds && existingContext.scaffolds.length > 0) {
      sections.push(`
## Unedited ctx init scaffolds (SAFE TO OVERWRITE)

These files exist but appear to be unmodified templates. You MAY rewrite them completely:
${existingContext.scaffolds.map((p) => `- \`.context/${p}\``).join('\n')}`);
    }

    const hasUserEdits =
      !!existingContext.projectMd ||
      !!existingContext.architectureMd ||
      (existingContext.existingRules && existingContext.existingRules.length > 0);

    if (hasUserEdits) {
      sections.push(`
## Existing Context Files (PRESERVE USER EDITS)

The user has already created/edited these files. Enhance them while preserving their custom content:`);

      if (existingContext.projectMd) {
        sections.push(`
### Current .context/project.md
\`\`\`markdown
${existingContext.projectMd}
\`\`\``);
      }

      if (existingContext.architectureMd) {
        sections.push(`
### Current .context/architecture.md
\`\`\`markdown
${existingContext.architectureMd}
\`\`\``);
      }

      if (existingContext.existingRules && existingContext.existingRules.length > 0) {
        sections.push(`
### Existing Rules (enhance, don't replace):`);
        for (const rule of existingContext.existingRules) {
          sections.push(`
#### ${rule.path}
\`\`\`markdown
${rule.content.slice(0, 1000)}${rule.content.length > 1000 ? '\n... (truncated)' : ''}
\`\`\``);
        }
      }
    }
  }

  // Task Instructions
  sections.push(`
---

## Your Task

Generate context files for this project. Create:

### 1. Enhanced project.md
- One-line mission statement
- Accurate tech stack
- Key directories with purposes
- Common commands
${existingContext?.projectMd ? '- PRESERVE existing user content, enhance with detected info' : ''}
${existingContext?.scaffolds?.includes('project.md') ? '- project.md is an unedited scaffold; rewrite freely' : ''}

### 2. Enhanced architecture.md
- System overview
- Key components and their responsibilities
- Data flow patterns
- Important design decisions
${existingContext?.architectureMd ? '- PRESERVE existing user content, enhance with detected info' : ''}
${existingContext?.scaffolds?.includes('architecture.md') ? '- architecture.md is an unedited scaffold; rewrite freely' : ''}

### 3. Rules (create these if they don't exist, enhance if they do)

Required rules:
- \`rules/project-identity.md\` - Mission, tech stack, architecture style
- \`rules/architecture-map.md\` - Directory structure with purposes
- \`rules/commands.md\` - Build, test, lint, deploy commands
- \`rules/agent-output-style.md\` - How the agent should communicate and deliver work
- \`rules/boundaries.md\` - Do-NOT rules and prohibitions
- \`rules/git-workflow.md\` - Commit, branch, PR conventions

Language-specific rules (based on detected languages):
${analysis.languages.slice(0, 3).map(l => `- \`rules/${l.name.toLowerCase()}-patterns.md\` - ${l.name} coding patterns`).join('\n')}

Directory-specific rules (for major directories):
${analysis.structure.srcStructure.slice(0, 5).map(d => `- \`rules/src/${d}.md\` - Rules specific to src/${d}/`).join('\n')}

### Important Guidelines

1. **Use valid glob patterns** in frontmatter (e.g., "src/**/*.ts", not "src/*.ts")
2. **Reference real files** - only mention files/dirs that exist
3. **Be specific to THIS project** - no generic advice
4. **Imperative style** - "Use X" not "You should use X"
5. **Dense content** - no filler, every line is actionable

Respond with JSON only. No markdown code blocks around the JSON.`);

  return sections.join('\n');
}

/**
 * Build prompt for validating generated output
 */
export function buildValidationPrompt(
  generatedOutput: string,
  analysis: CodebaseAnalysis
): string {
  return `Review this generated context output for issues:

## Generated Output
${generatedOutput}

## Validation Checklist

1. **File References**: Do all @file references point to files that exist in the project?
   - Known directories: ${analysis.structure.topLevel.join(', ')}
   - Source structure: ${analysis.structure.srcStructure.join(', ')}

2. **Glob Patterns**: Are all glob patterns syntactically valid?
   - Valid: "**/*.ts", "src/**/*", "*.md"
   - Invalid: "src/*.ts" (missing **), "[invalid"

3. **Frontmatter**: Does each rule have valid YAML frontmatter with:
   - id (string)
   - description (string)
   - globs (array of strings)
   - priority (number 0-100)

4. **Content Quality**:
   - Imperative style?
   - Project-specific (not generic)?
   - Dense and actionable?

Respond with JSON:
{
  "valid": true/false,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1"]
}`;
}
