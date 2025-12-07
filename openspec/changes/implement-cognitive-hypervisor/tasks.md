# Implementation Tasks

Ordered implementation checklist organized by phases. Each phase ends with validation tasks that generate proof-of-work documentation in `docs/validation/`.

## Phase 1: Project Foundation

### 1.1 Project Setup
- [ ] 1.1.1 Initialize npm package with TypeScript
- [ ] 1.1.2 Configure ESLint and Prettier
- [ ] 1.1.3 Set up Jest for testing with coverage reporting
- [ ] 1.1.4 Install core dependencies: `fast-glob`, `gray-matter`, `zod`, `commander`, `chalk`, `inquirer`
- [ ] 1.1.5 Create directory structure: `src/`, `bin/`, `tests/`, `templates/`
- [ ] 1.1.6 Configure package.json bin entry for unified `ctx` command

### 1.2 Core Configuration Schema (core-config)
- [ ] 1.2.1 Define Zod schema for `config.yaml`
- [ ] 1.2.2 Define Zod schema for rule frontmatter (id, description, domain, globs, priority, tags)
- [ ] 1.2.3 Implement config loader with defaults
- [ ] 1.2.4 Create template files: `project.md`, `architecture.md`, `config.yaml`
- [ ] 1.2.5 Write unit tests for config parsing
- [ ] 1.2.6 Document schema in README

### 1.3 Phase 1 Validation
- [ ] 1.3.1 Run `npm run build` - verify TypeScript compiles without errors
- [ ] 1.3.2 Run `npm run lint` - verify ESLint passes
- [ ] 1.3.3 Run `npm test` - verify all config tests pass
- [ ] 1.3.4 Generate `docs/validation/phase1-foundation.md` with:
  - [ ] Build output log
  - [ ] Test coverage report (target: ≥80%)
  - [ ] Dependency tree (`npm ls --depth=0`)
  - [ ] Directory structure screenshot
  - [ ] Sample config.yaml parsing output

---

## Phase 2: Rule Parsing and Validation

### 2.1 Rule Parser (rule-parser)
- [ ] 2.1.1 Implement frontmatter extraction using `gray-matter`
- [ ] 2.1.2 Implement frontmatter validation against Zod schema
- [ ] 2.1.3 Implement content body extraction (markdown after frontmatter)
- [ ] 2.1.4 Apply default values (priority=50)
- [ ] 2.1.5 Implement glob inference from directory path
- [ ] 2.1.6 Implement path traversal protection (block `..`, absolute paths, URL-encoded, null bytes)
- [ ] 2.1.7 Implement symlink validation (target must be within project)
- [ ] 2.1.8 Handle edge cases: empty content, malformed YAML, non-UTF8 files
- [ ] 2.1.9 Write unit tests for parsing, validation, and path security

### 2.2 Static Analysis (static-analysis)
- [ ] 2.2.1 Implement schema validation check (blocking)
- [ ] 2.2.2 Implement dead link detection for markdown links (blocking)
- [ ] 2.2.3 Implement duplicate ID detection across rules (blocking)
- [ ] 2.2.4 Implement circular reference detection in rule imports (blocking)
- [ ] 2.2.5 Implement path traversal detection in references (blocking)
- [ ] 2.2.6 Implement ghost rule detection - globs matching no files (warning)
- [ ] 2.2.7 Implement token limit warning based on config thresholds
- [ ] 2.2.8 Create analysis result type with errors, warnings, and file locations
- [ ] 2.2.9 Write unit tests for each analysis rule

### 2.3 Phase 2 Validation
- [ ] 2.3.1 Run full test suite - verify all parser and analysis tests pass
- [ ] 2.3.2 Test path traversal protection with attack vectors
- [ ] 2.3.3 Generate `docs/validation/phase2-parsing.md` with:
  - [ ] Test coverage report for rule-parser module (target: ≥85%)
  - [ ] Test coverage report for static-analysis module (target: ≥85%)
  - [ ] Sample rule parsing output (valid rule)
  - [ ] Sample error outputs for each blocking error type
  - [ ] Security test results (path traversal, symlink attacks)
  - [ ] Glob inference examples from different directory depths

---

## Phase 3: Compilation Engine

### 3.1 Compilation Core (compilation-engine)
- [ ] 3.1.1 Implement content-aware token estimation:
  - [ ] 3.1.1a Detect content type (prose, code, mixed, CJK)
  - [ ] 3.1.1b Apply ratio: prose=3.5, code=2.5, mixed=3.0, CJK=1.5
  - [ ] 3.1.1c Reserve 5% margin for metadata overhead
- [ ] 3.1.2 Implement rule selection by directory filter
- [ ] 3.1.3 Implement rule selection by glob matching
- [ ] 3.1.4 Implement rule selection by priority sorting
- [ ] 3.1.5 Implement rule selection by tag filter
- [ ] 3.1.6 Create compiler interface/abstract class
- [ ] 3.1.7 Write unit tests for token estimation accuracy

### 3.2 Cursor Compiler
- [ ] 3.2.1 Implement .mdc file format generation
- [ ] 3.2.2 Implement glob field mapping (source globs → .mdc globs)
- [ ] 3.2.3 Implement directory-based glob inference when source has no globs
- [ ] 3.2.4 Generate output path: `.cursor/rules/[domain]-[name].mdc`
- [ ] 3.2.5 Write integration tests with sample rules

### 3.3 Claude Compiler
- [ ] 3.3.1 Implement token-budgeted aggregation
- [ ] 3.3.2 Include `project.md` content as header
- [ ] 3.3.3 Include `architecture.md` summary
- [ ] 3.3.4 Select rules by configured strategy (priority default)
- [ ] 3.3.5 Generate `.context/` directory index for agent navigation
- [ ] 3.3.6 Inject Context Hygiene meta-rule
- [ ] 3.3.7 Write integration tests with token budget verification

### 3.4 Agents Compiler
- [ ] 3.4.1 Implement comprehensive document generation
- [ ] 3.4.2 Include full `project.md` content
- [ ] 3.4.3 Include full `architecture.md` content
- [ ] 3.4.4 Include rule directory index with summaries
- [ ] 3.4.5 Inject Context Hygiene meta-rule
- [ ] 3.4.6 Write integration tests

### 3.5 Phase 3 Validation
- [ ] 3.5.1 Run compilation tests - verify all three compilers work
- [ ] 3.5.2 Validate token estimation accuracy against tiktoken
- [ ] 3.5.3 Generate `docs/validation/phase3-compilation.md` with:
  - [ ] Test coverage report for compilation modules (target: ≥80%)
  - [ ] Token estimation accuracy comparison table
  - [ ] Sample .mdc output file
  - [ ] Sample CLAUDE.md output (with token count)
  - [ ] Sample AGENTS.md output (with token count)
  - [ ] Rule selection examples (by priority, directory, glob, tag)
  - [ ] Token budget enforcement proof (show truncation at limit)

---

## Phase 4: Build System

### 4.1 Incremental Build (incremental-build)
- [ ] 4.1.1 Define build manifest schema (JSON)
- [ ] 4.1.2 Implement mtime-based fast change detection
- [ ] 4.1.3 Implement SHA-256 content hash calculation (with "sha256:" prefix)
- [ ] 4.1.4 Implement output dependency tracking (rule → compiled files)
- [ ] 4.1.5 Implement selective recompilation based on changed files
- [ ] 4.1.6 Add manifest read/write to `.context/.build-manifest.json`
- [ ] 4.1.7 Write unit tests for change detection
- [ ] 4.1.8 Write integration tests for incremental rebuild

### 4.2 Atomic Writes and Build Locking
- [ ] 4.2.1 Implement atomic file writes:
  - [ ] 4.2.1a Write to temp file (e.g., `CLAUDE.md.tmp.{pid}`)
  - [ ] 4.2.1b Atomic rename to target path
  - [ ] 4.2.1c Cleanup temp files on error
- [ ] 4.2.2 Implement multi-file transaction (all-or-nothing)
- [ ] 4.2.3 Implement build locking:
  - [ ] 4.2.3a Create `.context/.build.lock` with pid, timestamp, hostname
  - [ ] 4.2.3b Block new builds if active lock exists
  - [ ] 4.2.3c Remove stale locks (>5 minutes old)
  - [ ] 4.2.3d Release lock on build completion
- [ ] 4.2.4 Write unit tests for atomic operations
- [ ] 4.2.5 Write unit tests for lock handling

### 4.3 Build Orchestration
- [ ] 4.3.1 Implement full build pipeline: scan → validate → compile
- [ ] 4.3.2 Implement incremental build pipeline
- [ ] 4.3.3 Handle compilation errors gracefully with clear messages
- [ ] 4.3.4 Handle disk full and permission errors with specific messages
- [ ] 4.3.5 Implement parallel rule processing for performance
- [ ] 4.3.6 Add build timing and statistics output

### 4.4 Phase 4 Validation
- [ ] 4.4.1 Run build system tests - verify incremental builds work
- [ ] 4.4.2 Test concurrent build blocking
- [ ] 4.4.3 Test crash recovery (stale lock removal)
- [ ] 4.4.4 Generate `docs/validation/phase4-build-system.md` with:
  - [ ] Test coverage report for build modules (target: ≥80%)
  - [ ] Sample build manifest JSON
  - [ ] Incremental build timing comparison (full vs incremental)
  - [ ] Atomic write test results (interrupt simulation)
  - [ ] Lock file format example
  - [ ] Concurrent build blocking proof
  - [ ] Stale lock recovery proof
  - [ ] Error message examples (disk full, permission denied)

---

## Phase 5: CLI Interface (Unified `ctx` Binary)

### 5.1 Initialization Command (cli-interface)
- [ ] 5.1.1 Implement `ctx init` command with interactive prompts
- [ ] 5.1.2 Prompt for agent selection (Cursor, Claude, All)
- [ ] 5.1.3 Create `.context/` directory structure
- [ ] 5.1.4 Generate template files based on selection
- [ ] 5.1.5 Detect and warn about existing `.context/` directory
- [ ] 5.1.6 Add `--force` flag to overwrite existing
- [ ] 5.1.7 Add `--no-interactive` flag for CI/automation
- [ ] 5.1.8 Write E2E tests for initialization flow

### 5.2 Migration Wizard
- [ ] 5.2.1 Implement `ctx init --wizard` for guided migration
- [ ] 5.2.2 Detect existing context files (.cursorrules, CLAUDE.md, AGENTS.md)
- [ ] 5.2.3 Analyze content structure and size
- [ ] 5.2.4 Recommend migration strategy (direct vs attach mode)
- [ ] 5.2.5 Preview planned changes
- [ ] 5.2.6 Implement `--dry-run` mode
- [ ] 5.2.7 Handle Ctrl+C gracefully (no changes made)
- [ ] 5.2.8 Write tests for wizard flow

### 5.3 Build Command
- [ ] 5.3.1 Implement `ctx build` command
- [ ] 5.3.2 Implement `ctx build --incremental` flag
- [ ] 5.3.3 Implement `--verbose` and `--quiet` output modes
- [ ] 5.3.4 Run static analysis before compilation
- [ ] 5.3.5 Display validation errors and warnings
- [ ] 5.3.6 Output compilation summary (files generated, tokens used, duration)
- [ ] 5.3.7 Return appropriate exit codes (0=success, 1=validation error, 2=runtime error)
- [ ] 5.3.8 Write E2E tests for build command

### 5.4 Lint Command
- [ ] 5.4.1 Implement `ctx lint` command for standalone validation
- [ ] 5.4.2 Output machine-readable format option (--json)
- [ ] 5.4.3 Support file path arguments for targeted linting

### 5.5 Other CLI Commands
- [ ] 5.5.1 Implement `ctx diff --legacy` for migration comparison
- [ ] 5.5.2 Implement `ctx verify` for checksum verification
- [ ] 5.5.3 Implement `ctx migrate` subcommand for migration operations
- [ ] 5.5.4 Implement `ctx --help` and `ctx --version`
- [ ] 5.5.5 Implement command-specific help (e.g., `ctx build --help`)
- [ ] 5.5.6 Handle unknown commands with suggestions

### 5.6 Windows Compatibility
- [ ] 5.6.1 Handle both `/` and `\` path separators
- [ ] 5.6.2 Configure platform-appropriate line endings
- [ ] 5.6.3 Ensure CLI executable without additional setup
- [ ] 5.6.4 Write cross-platform tests

### 5.7 Phase 5 Validation
- [ ] 5.7.1 Run CLI E2E tests on macOS, Linux, Windows
- [ ] 5.7.2 Test all commands with `--help` flag
- [ ] 5.7.3 Generate `docs/validation/phase5-cli.md` with:
  - [ ] Test coverage report for CLI modules (target: ≥80%)
  - [ ] Command help output for all commands
  - [ ] `ctx init` terminal recording (asciinema or screenshots)
  - [ ] `ctx build` output examples (success, error, warning)
  - [ ] `ctx lint --json` output sample
  - [ ] Exit code verification table
  - [ ] Cross-platform test results (macOS, Linux, Windows)
  - [ ] Migration wizard flow screenshots

---

## Phase 6: Git Integration

### 6.1 Hook Setup (git-integration)
- [ ] 6.1.1 Implement Husky installation check
- [ ] 6.1.2 Install Husky if not present (with user confirmation)
- [ ] 6.1.3 Generate pre-commit hook script
- [ ] 6.1.4 Hook calls `ctx build --incremental`
- [ ] 6.1.5 Stage updated compilation products on success
- [ ] 6.1.6 Block commit on blocking validation errors
- [ ] 6.1.7 Add `.husky/pre-commit` to generated files
- [ ] 6.1.8 Write integration tests for hook behavior

### 6.2 Gitignore Management
- [ ] 6.2.1 Detect existing `.gitignore`
- [ ] 6.2.2 Add `.context/.build-manifest.json` to ignore list
- [ ] 6.2.3 Optionally add compilation products to ignore (user choice)

### 6.3 Phase 6 Validation
- [ ] 6.3.1 Test hook installation in fresh Git repo
- [ ] 6.3.2 Test commit blocking on validation errors
- [ ] 6.3.3 Test auto-staging of compiled outputs
- [ ] 6.3.4 Generate `docs/validation/phase6-git.md` with:
  - [ ] Test coverage report for git module (target: ≥80%)
  - [ ] Pre-commit hook script content
  - [ ] Hook execution log (successful commit)
  - [ ] Hook execution log (blocked commit with errors)
  - [ ] Auto-staging proof (git status before/after)
  - [ ] .gitignore additions example

---

## Phase 7: Migration Support

### 7.1 Analysis Mode (migration-support)
- [ ] 7.1.1 Implement `ctx migrate --analyze` command
- [ ] 7.1.2 Detect existing `.cursorrules`, `CLAUDE.md`, `AGENTS.md`
- [ ] 7.1.3 Analyze file sizes and content structure
- [ ] 7.1.4 Output migration recommendations
- [ ] 7.1.5 Write tests for detection logic

### 7.2 Attach Mode
- [ ] 7.2.1 Implement `ctx migrate --attach` command
- [ ] 7.2.2 Create `.context/` alongside existing files
- [ ] 7.2.3 Import existing rules as `.context/rules/legacy.md`
- [ ] 7.2.4 Configure attach mode in `config.yaml`
- [ ] 7.2.5 Compilation appends to existing files instead of overwriting

### 7.3 Completion Mode
- [ ] 7.3.1 Implement `ctx migrate --complete` command
- [ ] 7.3.2 Implement `ctx diff --legacy` for comparison
- [ ] 7.3.3 Remove legacy files after confirmation
- [ ] 7.3.4 Update `config.yaml` to remove attach mode

### 7.4 Phase 7 Validation
- [ ] 7.4.1 Test full migration workflow (analyze → attach → complete)
- [ ] 7.4.2 Test with various legacy file combinations
- [ ] 7.4.3 Generate `docs/validation/phase7-migration.md` with:
  - [ ] Test coverage report for migration module (target: ≥80%)
  - [ ] `ctx migrate --analyze` output example
  - [ ] Attach mode config.yaml example
  - [ ] Section markers in appended content
  - [ ] `ctx diff --legacy` output example
  - [ ] Before/after file comparison for full migration
  - [ ] Backup directory contents after completion

---

## Phase 8: Self-Healing and Polish

### 8.1 Self-Healing Features (self-healing)
- [ ] 8.1.1 Define Context Hygiene meta-rule template
- [ ] 8.1.2 Inject meta-rule into all compilation outputs
- [ ] 8.1.3 Generate SHA-256 checksum of compiled content
- [ ] 8.1.4 Embed checksum as HTML comment in output
- [ ] 8.1.5 Embed build timestamp in output
- [ ] 8.1.6 Implement `ctx verify` checksum validation

### 8.2 Documentation
- [ ] 8.2.1 Write comprehensive README.md
- [ ] 8.2.2 Create CONTRIBUTING.md
- [ ] 8.2.3 Add JSDoc comments to public APIs
- [ ] 8.2.4 Create example project in `examples/` directory

### 8.3 Release Preparation
- [ ] 8.3.1 Set up npm publishing workflow
- [ ] 8.3.2 Add CHANGELOG.md
- [ ] 8.3.3 Configure semantic versioning
- [ ] 8.3.4 Create GitHub Actions CI pipeline
- [ ] 8.3.5 Add test coverage reporting
- [ ] 8.3.6 Publish v0.1.0 to npm

### 8.4 Phase 8 Validation
- [ ] 8.4.1 Verify meta-rule appears in all outputs
- [ ] 8.4.2 Test checksum verification (detect tampering)
- [ ] 8.4.3 Generate `docs/validation/phase8-self-healing.md` with:
  - [ ] Test coverage report for self-healing module (target: ≥80%)
  - [ ] Meta-rule content as embedded in outputs
  - [ ] Checksum format and placement example
  - [ ] Timestamp format example
  - [ ] `ctx verify` output (clean file)
  - [ ] `ctx verify` output (tampered file)
  - [ ] Version marker example
  - [ ] Example project structure and outputs

---

## Phase 9: Testing and Quality Assurance

### 9.1 Unit Test Coverage
- [ ] 9.1.1 Core Config: Schema validation, defaults, error handling
- [ ] 9.1.2 Rule Parser: Frontmatter, body extraction, path validation, glob inference
- [ ] 9.1.3 Static Analysis: All blocking/warning rules, error aggregation
- [ ] 9.1.4 Token Estimation: Content type detection, ratio accuracy
- [ ] 9.1.5 Compilation Engine: Selection strategies, conflict resolution
- [ ] 9.1.6 Incremental Build: Change detection, manifest handling
- [ ] 9.1.7 Atomic Writes: Temp files, transactions, error recovery
- [ ] 9.1.8 Build Locking: Lock creation, stale detection, cleanup
- [ ] 9.1.9 Self-Healing: Meta-rule, checksums, timestamps

### 9.2 Integration Tests
- [ ] 9.2.1 Full initialization flow with all options
- [ ] 9.2.2 Complete build pipeline (scan → validate → compile)
- [ ] 9.2.3 Incremental build with various change patterns
- [ ] 9.2.4 Migration workflow (analyze → attach → complete)
- [ ] 9.2.5 Git hook installation and execution
- [ ] 9.2.6 Cross-compilation (all three targets)

### 9.3 E2E Tests
- [ ] 9.3.1 `ctx init` → `ctx build` → verify outputs
- [ ] 9.3.2 `ctx init --wizard` migration flow
- [ ] 9.3.3 Pre-commit hook blocks invalid commits
- [ ] 9.3.4 `ctx verify` detects modified files

### 9.4 Security Tests
- [ ] 9.4.1 Path traversal attempts blocked
- [ ] 9.4.2 Symlink attacks prevented
- [ ] 9.4.3 URL-encoded traversal rejected
- [ ] 9.4.4 Null byte injection rejected

### 9.5 Edge Case Tests
- [ ] 9.5.1 Empty rules directory
- [ ] 9.5.2 Very large rule files (>100KB)
- [ ] 9.5.3 Deep nesting (>10 levels)
- [ ] 9.5.4 Unicode in file names and content
- [ ] 9.5.5 Concurrent build attempts
- [ ] 9.5.6 Interrupted builds (simulate crash)

### 9.6 Phase 9 Validation
- [ ] 9.6.1 Run full test suite with coverage
- [ ] 9.6.2 Generate `docs/validation/phase9-testing.md` with:
  - [ ] Overall test coverage report (target: ≥80% total)
  - [ ] Module-by-module coverage breakdown
  - [ ] Security test results summary
  - [ ] Edge case test results summary
  - [ ] Test execution time
  - [ ] Failed test analysis (if any)

---

## Phase 10: Performance Benchmarks

### 10.1 Baseline Benchmarks
- [ ] 10.1.1 Establish baseline: 100 rules compile in <3 seconds
- [ ] 10.1.2 Change detection overhead: <100ms for 100 files
- [ ] 10.1.3 Incremental build with 1 changed file: <500ms
- [ ] 10.1.4 Token estimation: <10ms per file

### 10.2 Scale Testing
- [ ] 10.2.1 Test with 10 rules - measure time and memory
- [ ] 10.2.2 Test with 50 rules - measure time and memory
- [ ] 10.2.3 Test with 100 rules - measure time and memory
- [ ] 10.2.4 Test with 500 rules - measure time and memory (stress test)

### 10.3 Memory Profiling
- [ ] 10.3.1 Peak memory usage during full build
- [ ] 10.3.2 Memory usage during incremental build
- [ ] 10.3.3 Memory leak detection over multiple builds

### 10.4 CI Performance
- [ ] 10.4.1 Pre-commit hook execution time target: <2 seconds
- [ ] 10.4.2 Full build in CI target: <10 seconds
- [ ] 10.4.3 Document performance regression detection

### 10.5 Phase 10 Validation
- [ ] 10.5.1 Run all benchmarks
- [ ] 10.5.2 Generate `docs/validation/phase10-performance.md` with:
  - [ ] Benchmark results table (rule count vs time vs memory)
  - [ ] Performance charts (if applicable)
  - [ ] Baseline targets vs actual results
  - [ ] Incremental vs full build comparison
  - [ ] Memory profile graphs
  - [ ] CI performance measurements
  - [ ] Recommendations for optimization (if needed)

---

## Parallelization Notes

**Can run in parallel:**
- 2.1 (Rule Parser) and 2.2 (Static Analysis) - independent modules
- 3.2 (Cursor), 3.3 (Claude), 3.4 (Agents) - after 3.1 is complete
- 8.2 (Documentation) - throughout development
- 9.1 (Unit Tests) - can run concurrently per module

**Must run sequentially:**
- Phase 1 → Phase 2 → Phase 3 → Phase 4 (core dependencies)
- Phase 5 depends on Phase 4 (needs build system)
- Phase 6 depends on Phase 5 (needs CLI)
- Phase 7 depends on Phase 5 (needs CLI)
- Phase 8 depends on all phases
- Phase 9 (Testing) runs alongside development
- Phase 10 (Benchmarks) runs after Phase 9

---

## Validation Documentation Structure

```
docs/
└── validation/
    ├── phase1-foundation.md
    ├── phase2-parsing.md
    ├── phase3-compilation.md
    ├── phase4-build-system.md
    ├── phase5-cli.md
    ├── phase6-git.md
    ├── phase7-migration.md
    ├── phase8-self-healing.md
    ├── phase9-testing.md
    └── phase10-performance.md
```

Each validation document must include:
1. **Date completed**
2. **Test coverage percentage**
3. **All tests passing** (screenshot or log)
4. **Sample outputs** proving functionality
5. **Known issues** (if any)
6. **Sign-off** (ready for next phase)

---

## Phase Completion Checklist

Before moving to the next phase:
- [ ] All tasks in phase marked complete
- [ ] All unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] No TypeScript errors
- [ ] ESLint passes with no warnings
- [ ] Test coverage ≥80% for phase modules
- [ ] Validation document generated and reviewed
- [ ] Performance within targets (if applicable)
