# Context Bootstrap Request

You are helping bootstrap AI coding rules for the project "{{projectName}}".

Your goal is to generate modular rule files for the `.context/rules/` directory that will compile into a production-grade CLAUDE.md (or equivalent agent instruction file).

---

## Critical Philosophy: Context Engineering Principles

Before generating rules, internalize these principles:

### 1. CLAUDE.md is NOT Documentation for Humans

It is a **system prompt injection mechanism** - the operating system for an AI agent. Every line must:
- Be **machine-actionable**, not human-readable prose
- Be **concise**, **imperative**, and **unambiguous**
- Purchase significant agentic behavior (treat context as high-value real estate)

### 2. Respect LLM Cognitive Architecture

LLMs are stateless with limited attention. Key constraints:
- **Lost in the middle**: Transformers degrade attention mid-context
- **Saturation point**: ~150-200 distinct instructions is the practical limit
- **Relevance filtering**: Claude Code ignores context that appears irrelevant to current task

**Therefore**: Less is more. Dense, actionable instructions beat verbose explanations.

### 3. Never Use CLAUDE.md as a Linter

LLMs are probabilistic engines. For deterministic rules (formatting, naming conventions), use actual linters. Reserve CLAUDE.md for:
- Architectural decisions
- Workflow patterns
- Domain-specific context
- Things that can't be automated

### 4. Progressive Disclosure Pattern

Don't load everything into root CLAUDE.md. Instead:
- Root file acts as **map and index**
- Detailed docs live in `agent_docs/` or `.context/` subdirectories
- Use referral instructions: "When modifying X, first read `@path/to/detail.md`"

---

## Project Analysis

**Project Name**: {{projectName}}
**Primary Languages**: {{languages}}
**Frameworks**: {{frameworks}}
**Build Tools**: {{buildTools}}
**Testing**: {{testingTools}}

## Directory Structure

**Top-level directories**: {{topLevelDirs}}
**Source structure**: {{srcStructure}}
**Has tests**: {{hasTests}}
**Has docs**: {{hasDocs}}

{{#packageInfo}}
## Package Information

**Type**: {{type}}
**Description**: {{description}}
**Key Dependencies**: {{dependencies}}
**Scripts**: {{scripts}}
{{/packageInfo}}

{{#existingDocs}}
## Existing Documentation

The following documentation already exists:

{{#docs}}
### {{path}}
```text
{{excerpt}}
```
{{/docs}}
{{/existingDocs}}

{{#sampleFiles}}
## Sample Code Files

These files represent the coding patterns in this project:

{{#files}}
### {{path}} ({{language}})
```{{languageLower}}
{{content}}
```
{{/files}}
{{/sampleFiles}}

---

## Your Task: Generate Production-Grade Rules

Create **3-7 rule files** following the architecture below. Each rule should be **dense and actionable**.

### Required Rule Categories

#### 1. Project Identity Rule (`project-identity.md`)
Must include:
- One-line mission statement
- Tech stack summary (language, framework, database, infra)
- Architectural style (monorepo/microservices/modular monolith)

#### 2. Architecture Map Rule (`architecture-map.md`)
Must include:
- ASCII tree or descriptive map of key directories
- Purpose of each major directory
- This prevents agents from wasting tokens running `ls`, `find`, `grep` to understand structure

#### 3. Operational Commands Rule (`commands.md`)
Must include authoritative commands for:
- Build
- Test (unit, integration, e2e)
- Lint/Format
- Database migrations (if applicable)
- Deployment (if applicable)

Format as imperative instructions:
```text
# Build
Run: `npm run build`

# Test
Run: `npm test` for unit tests
Run: `npm run test:e2e` for e2e tests
```

#### 4. Code Patterns Rule (language-specific, e.g., `typescript-patterns.md`)
Based on the sample files, document:
- Import organization
- Error handling patterns
- Async patterns
- Naming conventions (only if non-standard)

**Important**: Don't duplicate what linters enforce. Focus on patterns that require judgment.

#### 5. Do-Not Rules (`boundaries.md`)
Critical prohibitions. Format as imperative negatives:
```text
- Do NOT modify files in `dist/` or `build/` directly
- Do NOT commit `.env` files
- Do NOT add dependencies without approval
- Do NOT use `any` type in TypeScript
```

#### 6. Git Workflow Rule (`git-workflow.md`)
Must include:
- Always submit changes via Pull Request, never commit directly to main
- Do NOT include "Co-authored-by" in commit messages
- Commit message format and conventions
- Branch naming conventions

### Optional Rules (if applicable)

#### 7. Testing Conventions (`testing.md`)
If testing tools detected, document:
- Test file location pattern
- Mocking conventions
- Test naming conventions
- Coverage requirements

#### 8. Framework-Specific Patterns
If frameworks detected, create framework-specific rules.

---

## Rule File Format

Each rule must follow this exact format:

```markdown
---
id: unique-rule-id
description: Brief description (machine-readable)
globs:
  - "**/*.ts"
priority: 50
tags:
  - category
---

# Rule Title

[Dense, imperative instructions here]

## Section Name

- Bullet points preferred over paragraphs
- Each point is a discrete instruction
- Use code blocks for commands and examples

## Examples (if needed)

\`\`\`typescript
// GOOD: Brief explanation
code example
\`\`\`

\`\`\`typescript
// AVOID: Brief explanation
anti-pattern
\`\`\`
```

### Writing Style Guidelines

1. **Imperative voice**: "Use X" not "You should use X" or "X is recommended"
2. **Dense**: One instruction per line, no filler words
3. **Specific**: Include file paths, line number references where helpful
4. **Actionable**: Every sentence should change agent behavior
5. **No prose**: Avoid explanatory paragraphs. Use structured lists.

### Anti-Patterns to Avoid

- Generic advice ("write clean code", "follow best practices")
- Duplicating linter rules
- Long explanations of "why"
- Vague instructions ("be careful with X")
- Marketing language ("elegant", "robust", "scalable")

---

## Output Format

For each rule, output:

1. **Filename**: `rule-name.md` (kebab-case)
2. **Full content**: Complete rule file with frontmatter

Create files for `.context/rules/`. Be specific to THIS project's patterns, not generic advice.

---

## Generate Rules Now

Analyze the codebase information above. Generate dense, actionable rule files that will make an AI agent effective at working in this specific codebase.
