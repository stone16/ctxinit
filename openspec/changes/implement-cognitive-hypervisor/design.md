# Design: Cognitive Hypervisor Architecture

## Context

AI coding assistants use different context formats:
- **Claude Code**: Hierarchical CLAUDE.md with tool-call driven navigation
- **Cursor**: `.cursor/rules/*.mdc` with glob-based activation
- **Codex/ChatGPT**: AGENTS.md with comprehensive project context

Developers currently maintain these separately, leading to drift and inconsistency. This design establishes a unified architecture where rules are authored once and compiled to multiple targets.

### Stakeholders
- **Developers**: Primary users authoring and maintaining context rules
- **AI Agents**: Consumers of compiled context files
- **Teams**: Share consistent context across projects

### Constraints
- Must work with existing Git workflows
- Cannot modify AI tool behavior (output format only)
- Must support gradual adoption for existing projects

## Goals / Non-Goals

### Goals
1. Single source of truth for all AI context rules
2. Zero-config quick start with `npx ctxinit`
3. Incremental builds for large projects
4. Static validation to catch errors early
5. Git integration for automated compilation
6. Migration path for existing projects

### Non-Goals
1. Real-time sync with AI tools (compile-time only)
2. Rule execution/interpretation (output generation only)
3. AI tool plugins/extensions (file generation only)
4. Team collaboration features (Phase 2)
5. Cloud storage or rule sharing (Phase 2)

## Decisions

### Decision 1: Directory Structure
**Choice**: `.context/` as root with flat rules directory

```
.context/
├── config.yaml            # Compilation configuration
├── project.md             # Global project context
├── architecture.md        # Global design patterns
└── rules/                 # Atomic rule library
    ├── backend/           # Domain directories
    │   ├── auth.md
    │   └── db.md
    ├── frontend/
    │   └── ui-kit.md
    └── style/
        └── python.md
```

**Rationale**:
- `.context/` is unique and unlikely to conflict
- Flat structure under `rules/` allows domain grouping without deep nesting
- Separates global context (project.md, architecture.md) from atomic rules
- config.yaml at root for easy discovery

**Alternatives Considered**:
- `.ai-context/`: More explicit but longer
- `.rules/`: Too generic, may conflict
- Nested rules hierarchy: Adds complexity without benefit

### Decision 2: Rule File Format
**Choice**: YAML frontmatter + Markdown body

```yaml
---
id: "auth-rules"                    # Required: Unique identifier
description: "Authentication rules"  # Required: Human description
domain: "backend"                   # Required: Domain classification
globs: ["**/auth/**"]               # Optional: File activation patterns
priority: 80                        # Optional: 0-100, default 50
tags: ["security", "critical"]      # Optional: For filtering
---

# Rule Content

Actual markdown content here...
```

**Rationale**:
- Frontmatter is widely understood (Jekyll, Hugo, etc.)
- Markdown body preserves rich formatting
- Schema validation possible via structured frontmatter
- Compatible with existing documentation tools

**Alternatives Considered**:
- Pure YAML: Loses markdown formatting benefits
- JSON: Less human-readable
- TOML: Less widespread adoption

### Decision 3: Compilation Strategy
**Choice**: Strategy pattern with three compilers

| Target | Strategy | Output |
|--------|----------|--------|
| Cursor | Per-file | `.cursor/rules/[domain]-[name].mdc` |
| Claude | Aggregated | `CLAUDE.md` with token budget |
| Agents | Comprehensive | `AGENTS.md` with full context |

**Rationale**:
- Cursor benefits from granular files with glob matching
- Claude needs token-efficient entry point
- Agents need comprehensive context
- Strategy pattern allows future target additions

### Decision 4: Token Counting
**Choice**: Content-aware character ratio with type multipliers

```javascript
// Base ratio: 1 token ≈ 3 characters (more conservative than 1:4)
// Content-type multipliers for accuracy
const estimateTokens = (text, contentType = 'mixed') => {
  const multipliers = {
    prose: 3.5,      // English text has higher chars/token
    code: 2.5,       // Code typically has lower chars/token
    mixed: 3.0,      // Default conservative estimate
    cjk: 1.5         // CJK characters often 1:1 with tokens
  };
  const ratio = multipliers[contentType] || multipliers.mixed;
  return Math.ceil(text.length / ratio);
};

// Content type detection heuristics
const detectContentType = (text) => {
  const codeIndicators = /^(import|export|function|class|const|let|var|def|async|=>)/m;
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/;
  if (cjkPattern.test(text)) return 'cjk';
  if (codeIndicators.test(text)) return 'code';
  return 'prose';
};
```

**Rationale**:
- 1:3 ratio is more conservative, reducing risk of over-budget outputs
- Content-type detection improves accuracy for code-heavy rules
- CJK support handles multilingual projects correctly
- Still avoids heavy tiktoken dependency
- Calibrated against real-world tokenizer measurements

**Alternatives Considered**:
- tiktoken: Heavy dependency, model-specific (reserved for optional validation mode)
- Word count: Less accurate for code
- Fixed 1:4 ratio: Too optimistic, causes budget overruns

### Decision 5: Incremental Build
**Choice**: Content hash with mtime fast-path, atomic writes, and build locking

```json
{
  "version": "1.0",
  "lastBuild": "2024-12-07T10:30:00Z",
  "files": {
    "rules/backend/auth.md": {
      "hash": "sha256:a1b2c3...",
      "mtime": 1701943800,
      "compiledTo": [".cursor/rules/backend-auth.mdc", "CLAUDE.md"]
    }
  }
}
```

**Process**:
1. Acquire build lock (`.context/.build.lock`)
2. Check mtime first (fast)
3. If changed, compute SHA-256 hash
4. If hash changed, mark for recompilation
5. Write outputs atomically (temp file → rename)
6. Track output dependencies for targeted rebuilds
7. Release build lock

**Atomic Write Strategy**:
```javascript
// Write to temp file first, then atomic rename
const atomicWrite = async (targetPath, content) => {
  const tempPath = `${targetPath}.tmp.${process.pid}`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, targetPath);
};

// Transaction for multiple files
const atomicTransaction = async (writes) => {
  const tempFiles = [];
  try {
    for (const { path, content } of writes) {
      const tempPath = `${path}.tmp.${process.pid}`;
      await fs.writeFile(tempPath, content, 'utf8');
      tempFiles.push({ temp: tempPath, target: path });
    }
    // Commit phase: rename all temp files
    for (const { temp, target } of tempFiles) {
      await fs.rename(temp, target);
    }
  } catch (error) {
    // Rollback: clean up temp files
    for (const { temp } of tempFiles) {
      await fs.unlink(temp).catch(() => {});
    }
    throw error;
  }
};
```

**Build Locking**:
```javascript
// Prevent concurrent builds with file lock
const acquireBuildLock = async () => {
  const lockPath = '.context/.build.lock';
  const lockContent = JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString(),
    hostname: os.hostname()
  });

  try {
    await fs.writeFile(lockPath, lockContent, { flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      const existingLock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
      // Check if stale (> 5 minutes old)
      if (Date.now() - new Date(existingLock.timestamp) > 300000) {
        await fs.unlink(lockPath);
        return acquireBuildLock(); // Retry
      }
      return false; // Active lock exists
    }
    throw err;
  }
};
```

**Rationale**:
- mtime is O(1) via stat() call
- Hash provides content-based verification
- Dependency tracking enables minimal rebuilds
- Atomic writes prevent partial/corrupt outputs on interruption
- Build locking prevents race conditions in concurrent environments

### Decision 6: Static Analysis Pipeline
**Choice**: Two-tier validation (blocking vs warning) with path traversal protection

**Blocking Errors**:
- Schema validation (missing required fields)
- Dead link detection (broken file references)
- Duplicate ID detection
- **Circular references** (previously warning, elevated to blocking)
- **Path traversal attempts** (security protection)

**Warnings**:
- Ghost rules (globs match no files)
- Token budget exceeded

**Path Traversal Protection**:
```javascript
const sanitizePath = (inputPath, baseDir = '.context') => {
  // Normalize and resolve the path
  const normalized = path.normalize(inputPath);
  const resolved = path.resolve(baseDir, normalized);
  const absoluteBase = path.resolve(baseDir);

  // Ensure path stays within base directory
  if (!resolved.startsWith(absoluteBase + path.sep) && resolved !== absoluteBase) {
    throw new SecurityError(`Path traversal detected: ${inputPath}`);
  }

  // Block dangerous patterns
  const dangerousPatterns = [
    /\.\./,           // Parent directory traversal
    /^\/(?!Users)/,   // Absolute paths (except allowed prefixes)
    /\0/,             // Null bytes
    /%2e%2e/i,        // URL-encoded traversal
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(inputPath)) {
      throw new SecurityError(`Dangerous path pattern: ${inputPath}`);
    }
  }

  return resolved;
};
```

**Rationale**:
- Blocking errors prevent broken output
- Circular references elevated to blocking (can cause infinite loops during build)
- Path traversal protection prevents reading/writing outside project scope
- Warnings inform without disrupting workflow for non-critical issues

### Decision 7: CLI Architecture
**Choice**: Single unified `ctx` binary with subcommands

```bash
# All operations through single binary
npx ctx init              # Interactive setup (was ctxinit)
ctx init --attach         # Preserve legacy files
ctx init --analyze        # Detect existing config
ctx init --wizard         # Guided migration wizard (P1)

# Build operations
ctx build                 # Full compilation
ctx build --incremental   # Incremental only

# Validation and comparison
ctx lint                  # Standalone validation
ctx lint --json           # Machine-readable output
ctx diff --legacy         # Compare with legacy files

# Migration operations
ctx migrate --analyze     # Analyze current state
ctx migrate --complete    # Finalize migration

# Utilities
ctx --version             # Version info
ctx --help                # Help text
ctx verify                # Verify checksums (optional)
```

**Rationale**:
- Single entry point reduces confusion (`ctx` vs `ctxinit`)
- Subcommand pattern is familiar (git, npm, docker)
- `npx ctx init` still provides zero-install quickstart
- Consistent experience across all operations
- Easier to extend with new commands

**Alternatives Considered**:
- Two binaries (ctxinit + ctx): Adds cognitive load, two install paths
- Flags only (ctx --init): Less discoverable than subcommands

### Decision 8: Glob Inference
**Choice**: Auto-infer from directory path if not specified

```yaml
# rules/backend/auth.md without explicit globs
# → inferred: ["**/backend/**"]
```

**Rationale**:
- Reduces configuration burden
- Directory structure already implies scope
- Explicit globs override when needed

### Decision 9: Conflict Resolution
**Choice**: Priority-based with optional merge

```yaml
conflict_resolution:
  strategy: "priority_wins"  # Higher priority wins
  fallback: "merge"          # Equal priority: merge content
```

**Rationale**:
- Clear deterministic behavior
- Priority system already exists
- Merge fallback preserves information

### Decision 10: Package Manager
**Choice**: npm package with single CLI binary

```json
{
  "name": "ctxinit",
  "bin": {
    "ctx": "./bin/ctx.js"
  }
}
```

**Rationale**:
- npm is ubiquitous in JS/TS ecosystem
- npx enables zero-install usage (`npx ctx init`)
- Single binary simplifies installation and PATH management
- Global install optional for convenience

## Glossary

Standardized terminology used throughout this specification.

| Term | Definition | Context |
|------|------------|---------|
| **Rule** | A single context instruction file in `.context/rules/` with YAML frontmatter and Markdown body | Core concept |
| **Compilation** | The process of transforming source rules into target output formats | Build system |
| **Target** | An output format (Cursor/Claude/Agents) that rules are compiled to | Compilation |
| **Glob** | A file pattern (e.g., `**/*.ts`) used to match project files for rule activation | Rule selection |
| **Frontmatter** | YAML metadata at the start of a rule file between `---` delimiters | Rule format |
| **Domain** | A category grouping for rules (e.g., "backend", "frontend", "security") | Organization |
| **Token Budget** | Maximum estimated tokens allowed in a compiled output file | Resource limit |
| **Blocking Error** | A validation issue that prevents compilation from completing | Static analysis |
| **Warning** | A validation issue that is reported but does not prevent compilation | Static analysis |
| **Manifest** | The `.build-manifest.json` file tracking build state for incremental compilation | Build system |
| **Attach Mode** | Migration mode where compiled content appends to existing legacy files | Migration |
| **Legacy Files** | Pre-existing context files (`.cursorrules`, `CLAUDE.md`) before ctxinit adoption | Migration |
| **Meta-rule** | The Context Hygiene notice embedded in compiled outputs | Self-healing |
| **Atomic Write** | A file write operation that either fully succeeds or leaves no partial file | Safety |
| **Build Lock** | A file-based lock preventing concurrent build operations | Concurrency |

## Risks / Trade-offs

### Risk 1: Token Estimation Accuracy
- **Risk**: Character-based estimation may still be inaccurate despite content-aware multipliers
- **Mitigation**: Use conservative 1:3 base ratio with content-type detection, allow config override
- **Monitoring**: Track actual token usage in production, consider optional tiktoken validation mode

### Risk 2: Build Performance at Scale
- **Risk**: Large projects with 100+ rules may have slow builds
- **Mitigation**: Incremental builds, parallel file processing
- **Monitoring**: Benchmark with synthetic large projects

### Risk 3: Format Compatibility Drift
- **Risk**: AI tools may change their expected formats
- **Mitigation**: Version-specific compilers, format detection
- **Monitoring**: Integration tests against actual tools

### Risk 4: Migration Complexity
- **Risk**: Complex legacy configs may not migrate cleanly
- **Mitigation**: Attach mode preserves originals, gradual migration
- **Monitoring**: User feedback during beta

## Migration Plan

### For New Projects
1. Run `npx ctxinit`
2. Select target agents (Cursor/Claude/All)
3. Edit `.context/project.md` and add rules
4. Run `ctx build` or let pre-commit handle it

### For Existing Projects
1. Run `ctxinit --analyze` to assess current state
2. Run `ctxinit --attach` to preserve legacy files
3. Gradually migrate rules to `.context/rules/`
4. Run `ctx diff --legacy` to verify parity
5. Run `ctxinit --complete-migration` to finalize

### Rollback Strategy
- Legacy files preserved in attach mode
- Git history allows reverting to pre-migration state
- No destructive operations during migration

## Open Questions

1. **Token Counter Library**: Should we use tiktoken for accuracy despite the dependency cost?
   - Current decision: No, use character ratio
   - Revisit if accuracy becomes a problem

2. **Watch Mode**: Should `ctx build --watch` be included in Phase 1?
   - Current decision: No, pre-commit hooks are sufficient
   - Consider for Phase 2 based on demand

3. **Rule Inheritance**: Should rules be able to extend/override other rules?
   - Current decision: No, keep it simple
   - Planned for Phase 2 team features

4. **Multi-Language Support**: Should the CLI support i18n?
   - Current decision: English only for Phase 1
   - Consider based on adoption patterns
