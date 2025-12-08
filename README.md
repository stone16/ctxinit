# ctxinit

A CLI tool for managing AI context files across multiple IDE targets. Compile your project context and rules into optimized formats for Claude Code, Cursor, and general AI agents.

## Features

- **Multi-Target Compilation**: Generate context files for Claude (`CLAUDE.md`), Cursor (`.cursor/rules/*.mdc`), and general agents (`AGENTS.md`)
- **Token Budget Management**: Intelligent rule selection to fit within configurable token limits
- **Rule Priority System**: Control which rules get included when space is limited
- **Glob-Based Filtering**: Apply rules conditionally based on file patterns
- **Incremental Builds**: Only rebuild when source files change
- **Self-Healing Verification**: Detect tampering with SHA-256 checksums
- **Watch Mode**: Automatically rebuild on file changes

## Installation

```bash
npm install -g ctxinit
```

Or use with npx:

```bash
npx ctxinit init
```

## Quick Start

```bash
# Initialize a new context project
ctx init

# Build context files for all targets
ctx build

# Verify output integrity
ctx verify

# Watch for changes
ctx build --watch
```

## Project Structure

After initialization, your project will have:

```
.context/
  config.yaml       # Main configuration file
  project.md        # Project description (required)
  architecture.md   # Architecture overview (optional)
  rules/            # Rule files
    *.md            # Individual rule files
```

## Configuration

The `.context/config.yaml` file controls compilation:

```yaml
version: '1.0'
project:
  name: my-project
  description: Project description

compile:
  claude:
    max_tokens: 4000
    strategy: priority
    always_include:
      - core-rules

  cursor:
    strategy: all

  agents:
    max_tokens: 8000
```

### Compilation Strategies

- **all**: Include all rules (default for Cursor)
- **priority**: Include rules by priority until token budget is reached
- **tags**: Filter rules by tags
- **domain**: Filter rules by domain

## Writing Rules

Rules are markdown files with YAML frontmatter:

```markdown
---
id: coding-standards
description: Project coding standards
priority: 10
always_apply: true
globs:
  - "**/*.ts"
  - "**/*.js"
tags:
  - code-quality
domain: backend
---

# Coding Standards

Your rule content here...
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique rule identifier (required) |
| `description` | string | Brief description |
| `priority` | number | Higher = more important (0-100) |
| `always_apply` | boolean | Always include regardless of globs |
| `globs` | string[] | File patterns for conditional application |
| `tags` | string[] | Categorization tags |
| `domain` | string | Domain category |

## Commands

### `ctx init`

Initialize a new context project in the current directory.

```bash
ctx init [--force]
```

Options:
- `--force`: Overwrite existing configuration

### `ctx build`

Compile rules to target formats.

```bash
ctx build [targets...] [options]
```

Options:
- `--watch, -w`: Watch for changes and rebuild
- `--force`: Force full rebuild
- `--skip-validation`: Skip rule validation
- `--verbose, -v`: Verbose output

Examples:
```bash
ctx build                    # Build all targets
ctx build claude cursor      # Build specific targets
ctx build --watch            # Watch mode
```

### `ctx verify`

Verify compiled output integrity using checksums.

```bash
ctx verify [file] [options]
```

Options:
- `--json`: Output in JSON format
- `--verbose, -v`: Show detailed information

Examples:
```bash
ctx verify                   # Verify all outputs
ctx verify CLAUDE.md         # Verify specific file
ctx verify --json            # JSON output
```

### `ctx validate`

Validate rules and configuration without building.

```bash
ctx validate [options]
```

Options:
- `--fix`: Auto-fix simple issues
- `--verbose, -v`: Show all validation details

### `ctx stats`

Show project statistics.

```bash
ctx stats [options]
```

Options:
- `--json`: Output in JSON format
- `--verbose, -v`: Show detailed breakdown

## Output Formats

### Claude (CLAUDE.md)

Single markdown file optimized for Claude Code:
- Project context and architecture
- Rule directory index
- Selected rules based on token budget
- Context hygiene meta-rule

### Cursor (.cursor/rules/*.mdc)

Individual `.mdc` files with Cursor-compatible frontmatter:
- One file per rule
- YAML frontmatter with description, globs, alwaysApply
- Full rule content

### Agents (AGENTS.md)

Comprehensive file for general AI agents:
- Full project overview
- Complete architecture documentation
- Rule summaries with metadata
- Navigation-friendly structure

## Self-Healing Features

ctxinit embeds metadata in compiled outputs for integrity verification:

```html
<!-- ctx build metadata -->
<!-- timestamp: 2024-01-15T10:30:00.000Z -->
<!-- checksum: sha256:abc123... -->
```

Use `ctx verify` to detect tampering or accidental modifications.

## Programmatic API

```typescript
import { ConfigLoader, RuleParser, ClaudeCompiler } from 'ctxinit';

// Load configuration
const configLoader = new ConfigLoader(projectRoot);
const config = configLoader.loadConfig();

// Parse rules
const parser = new RuleParser(projectRoot);
const rules = parser.discoverAndParse();

// Compile
const compiler = new ClaudeCompiler({
  projectRoot,
  config,
  rules
});
const result = await compiler.compile();
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run linting
npm run lint
```

## License

MIT
