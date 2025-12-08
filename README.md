# ctxinit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![npm version](https://img.shields.io/npm/v/ctxinit.svg)](https://www.npmjs.com/package/ctxinit)

A CLI tool for managing AI context files across multiple IDE targets. Compile your project context and rules into optimized formats for Claude Code, Cursor, and general AI agents.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Writing Rules](#writing-rules)
- [Commands](#commands)
- [Output Formats](#output-formats)
- [Self-Healing Features](#self-healing-features)
- [Programmatic API](#programmatic-api)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

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

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/stone16/ctxinit.git
cd ctxinit

# Install dependencies
npm install

# Build the project
npm run build
```

### Local Testing with npm pack

To test your changes as an end user would experience them, use `npm pack` to create a tarball and install it in a separate directory:

```bash
# 1. Build and pack the project
npm run build
npm pack
# Creates ctxinit-x.x.x.tgz

# 2. In a separate test directory, install from the tarball
mkdir ~/test-project && cd ~/test-project
npm install /path/to/ctxinit/ctxinit-x.x.x.tgz

# 3. Test the CLI commands
npx ctx init
npx ctx build
npx ctx verify
```

For global installation testing:

```bash
npm install -g /path/to/ctxinit/ctxinit-x.x.x.tgz
ctx init
ctx build
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch

# Run a specific test file
npm test -- tests/compiler/claude-compiler.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should compile"
```

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check code formatting
npm run format:check

# Format code
npm run format
```

### Development Workflow

```bash
# Watch mode for TypeScript compilation
npm run dev

# In another terminal, test your changes
ctx build --verbose
```

### Project Structure

```
ctxinit/
├── bin/                  # CLI entry point
│   └── ctx.js
├── src/                  # Source code
│   ├── cli/              # CLI commands
│   ├── compiler/         # Target compilers
│   ├── config/           # Configuration loading
│   ├── parser/           # Rule parsing
│   ├── build/            # Build orchestration
│   ├── schemas/          # Zod schemas
│   └── index.ts          # Public API exports
├── tests/                # Test files
│   ├── cli/              # CLI command tests
│   ├── compiler/         # Compiler tests
│   ├── config/           # Config tests
│   ├── parser/           # Parser tests
│   ├── build/            # Build tests
│   ├── integration/      # Integration tests
│   ├── performance/      # Performance benchmarks
│   └── __mocks__/        # Test mocks
├── templates/            # Template files for ctx init
├── docs/                 # Documentation
└── examples/             # Example projects
```

### Writing Tests

Tests use Jest and follow this structure:

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Test
    expect(result).toBe(expected);
  });
});
```

### Debugging

```bash
# Run with Node.js inspector
node --inspect-brk bin/ctx.js build

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues

- Search [existing issues](https://github.com/stone16/ctxinit/issues) first
- Include reproduction steps, expected vs actual behavior
- Provide your environment details (Node.js version, OS, etc.)

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add or update tests as needed
5. Ensure all tests pass: `npm test`
6. Ensure linting passes: `npm run lint`
7. Commit with a clear message
8. Push and open a Pull Request

### Development Guidelines

- Follow existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits focused and atomic
- Use conventional commit messages when possible

### Areas for Contribution

- Bug fixes and improvements
- New compilation targets
- Documentation improvements
- Performance optimizations
- Test coverage improvements

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Questions?** Open an issue or start a discussion on GitHub.
