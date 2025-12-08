# Change: Implement Cognitive Hypervisor for Unified Context Architecture

## Why

Modern AI coding assistants (Claude Code, Cursor, Codex) each require different context formats, creating "Context Schizophrenia" where developers must maintain multiple rule files manually. This proposal implements a "Cognitive Hypervisor" - a unified context architecture that maintains a **single source of truth** (`.context/` directory) and compiles it to target-specific formats (CLAUDE.md, .cursor/rules/*.mdc, AGENTS.md).

## What Changes

### New CLI Tool: `ctxinit`
- Project initialization wizard with agent selection
- Creates `.context/` directory structure with templates
- Sets up Git hooks for automated compilation
- Supports attach mode for existing projects with legacy context files

### New CLI Command: `ctx build`
- Compiles `.context/` rules to target formats
- Supports incremental builds via content hashing
- Validates rules with static analysis before compilation
- Configurable rule selection strategies (priority, glob, directory, tags)

### Compilation Targets
- **CLAUDE.md**: Token-budgeted entry file (default <4K tokens)
- **AGENTS.md**: Comprehensive context document (default <8K tokens)
- **.cursor/rules/*.mdc**: Per-rule files with glob-based activation

### Core Features
- YAML frontmatter-based rule format with id, description, domain, globs, priority, tags
- Static analysis: schema validation, dead link detection, duplicate ID detection
- Incremental compilation with build manifest tracking
- Git pre-commit hook for auto-rebuild
- Migration support for existing .cursorrules, CLAUDE.md, AGENTS.md

## Impact

### Affected Specs (New Capabilities)
- `core-config`: Directory structure and configuration schema
- `rule-parser`: Frontmatter parsing and validation
- `static-analysis`: Linting and validation rules
- `compilation-engine`: Target-specific compilation strategies
- `incremental-build`: Change detection and selective recompilation
- `cli-interface`: User-facing commands and prompts
- `git-integration`: Pre-commit hooks and automation
- `migration-support`: Legacy file detection and gradual migration
- `self-healing`: Meta-rules and checksum validation

### Affected Code (To Be Created)
- `src/config/` - Configuration parsing and schema
- `src/parser/` - Rule file parsing
- `src/analysis/` - Static analysis rules
- `src/compiler/` - Compilation engine with target strategies
- `src/build/` - Incremental build system
- `src/cli/` - CLI commands and interactive prompts
- `src/git/` - Git hook installation
- `src/migration/` - Legacy migration support
- `bin/ctx` - Main CLI entry point
- `bin/ctxinit` - Initialization CLI

### Dependencies Required
- `fast-glob`: File pattern matching (avoid CVE-2025-64756 in glob package)
- `gray-matter`: YAML frontmatter parsing
- `ajv` or `zod`: Schema validation
- `husky`: Git hooks management
- `commander` or `yargs`: CLI framework
- `chalk`: Terminal styling
- `inquirer`: Interactive prompts

### Breaking Changes
- **None**: This is a greenfield implementation

### Phase 2 (Out of Scope)
- GitHub Copilot, Windsurf, Amazon Q Developer support
- Team collaboration and rule inheritance
- Web UI / VSCode plugin
- Community rule marketplace
