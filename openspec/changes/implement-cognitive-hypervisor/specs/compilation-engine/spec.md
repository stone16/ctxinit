## ADDED Requirements

### Requirement: Token Estimation
The system SHALL estimate token counts using a content-aware character-to-token ratio for budget control.

#### Scenario: Token calculation - prose content
- **WHEN** content is detected as primarily prose (English text)
- **THEN** the system calculates tokens as `ceil(characterCount / 3.5)`

#### Scenario: Token calculation - code content
- **WHEN** content is detected as primarily code (imports, functions, classes)
- **THEN** the system calculates tokens as `ceil(characterCount / 2.5)`

#### Scenario: Token calculation - mixed content
- **WHEN** content type cannot be determined
- **THEN** the system uses conservative ratio `ceil(characterCount / 3.0)`

#### Scenario: Token calculation - CJK content
- **WHEN** content contains CJK characters (Chinese, Japanese, Korean)
- **THEN** the system calculates tokens as `ceil(characterCount / 1.5)`

#### Scenario: Content type detection
- **WHEN** analyzing content for token estimation
- **THEN** the system detects content type using:
  - Code indicators: `import`, `export`, `function`, `class`, `const`, `let`, `var`, `def`, `async`, `=>`
  - CJK patterns: Unicode ranges for CJK ideographs and scripts
  - Default to mixed content if no clear indicators

#### Scenario: Budget enforcement
- **WHEN** selecting rules for a token-budgeted output
- **THEN** the system stops adding rules when the budget would be exceeded

#### Scenario: Budget margin
- **WHEN** enforcing token budget
- **THEN** the system reserves 5% margin for metadata and formatting overhead

### Requirement: Rule Selection by Directory
The system SHALL support selecting rules based on their containing directory.

#### Scenario: Directory filter
- **WHEN** config specifies `include_dirs: ["backend", "security"]`
- **THEN** only rules in those directories are included in compilation

#### Scenario: Nested directories
- **WHEN** config specifies `include_dirs: ["backend"]`
- **THEN** rules in `backend/` and all subdirectories (e.g., `backend/auth/`) are included

### Requirement: Rule Selection by Glob
The system SHALL support selecting rules based on glob pattern matching against project files.

#### Scenario: Glob-based activation
- **WHEN** a rule has `globs: ["**/auth/**"]` and the current context includes auth files
- **THEN** the rule is selected for inclusion

#### Scenario: No matching files
- **WHEN** a rule's globs match no files in the current context
- **THEN** the rule is excluded from selection

### Requirement: Rule Selection by Priority
The system SHALL support selecting rules in priority order until token budget is exhausted.

#### Scenario: Priority ordering
- **WHEN** rules have priorities 80, 60, 50, 40
- **THEN** they are processed in order 80, 60, 50, 40

#### Scenario: Budget exhaustion
- **WHEN** adding the next priority rule would exceed the token budget
- **THEN** that rule and lower priority rules are excluded

#### Scenario: Equal priority
- **WHEN** multiple rules have the same priority
- **THEN** they are processed in alphabetical order by ID

### Requirement: Rule Selection by Tag
The system SHALL support selecting rules based on tag filtering.

#### Scenario: Tag inclusion
- **WHEN** config specifies `include_tags: ["security", "critical"]`
- **THEN** only rules with at least one matching tag are included

#### Scenario: No tags specified
- **WHEN** a rule has no tags and tag filtering is active
- **THEN** the rule is excluded

### Requirement: Cursor Compilation Strategy
The system SHALL compile rules to individual `.cursor/rules/*.mdc` files for Cursor IDE.

#### Scenario: MDC file generation
- **WHEN** compiling for Cursor target
- **THEN** each rule generates a separate `.mdc` file

#### Scenario: MDC file naming
- **WHEN** a rule at `rules/backend/auth.md` is compiled
- **THEN** the output file is `.cursor/rules/backend-auth.mdc`

#### Scenario: MDC frontmatter format
- **WHEN** generating an .mdc file
- **THEN** the frontmatter includes:
  - `description`: from source rule
  - `globs`: from source rule or inferred
  - `alwaysApply`: false by default

#### Scenario: Glob preservation
- **WHEN** a source rule has explicit globs
- **THEN** the .mdc file uses those exact globs

#### Scenario: Glob inference for Cursor
- **WHEN** a source rule has no globs (inferred from directory)
- **THEN** the .mdc file uses the inferred globs

### Requirement: Claude Compilation Strategy
The system SHALL compile rules to a single `CLAUDE.md` entry file with token budget control.

#### Scenario: Entry file structure
- **WHEN** compiling for Claude target
- **THEN** the output CLAUDE.md contains:
  1. Project context from `project.md`
  2. Architecture summary from `architecture.md`
  3. Selected rules based on strategy
  4. Directory index for agent navigation

#### Scenario: Token budget enforcement
- **WHEN** the configured `max_tokens` is 4000
- **THEN** the total estimated tokens in CLAUDE.md does not exceed 4000

#### Scenario: Always include files
- **WHEN** config specifies `always_include: ["project.md", "architecture.md"]`
- **THEN** those files are included before applying token budget to rules

#### Scenario: Directory index generation
- **WHEN** compiling CLAUDE.md
- **THEN** a summary index of `.context/` structure is included for agent reference

### Requirement: Agents Compilation Strategy
The system SHALL compile rules to a comprehensive `AGENTS.md` file for general AI agents.

#### Scenario: Comprehensive content
- **WHEN** compiling for Agents target
- **THEN** the output AGENTS.md contains:
  1. Full content of `project.md`
  2. Full content of `architecture.md`
  3. Rule directory index with summaries

#### Scenario: Token budget for Agents
- **WHEN** the configured `max_tokens` is 8000
- **THEN** the total estimated tokens in AGENTS.md does not exceed 8000

#### Scenario: Rule summaries
- **WHEN** including rules in AGENTS.md
- **THEN** each rule's description and first paragraph are included as summary

### Requirement: Output Directory Management
The system SHALL create necessary output directories before writing compiled files.

#### Scenario: Cursor rules directory
- **WHEN** compiling for Cursor and `.cursor/rules/` does not exist
- **THEN** the system creates the directory

#### Scenario: Existing output files
- **WHEN** compiled output files already exist
- **THEN** the system overwrites them with new content

### Requirement: Conflict Resolution
The system SHALL resolve conflicts when multiple rules match the same context.

#### Scenario: Priority wins strategy
- **WHEN** `conflict_resolution.strategy` is "priority_wins"
- **AND** multiple rules match the same file
- **THEN** the highest priority rule takes precedence

#### Scenario: Merge fallback
- **WHEN** conflicting rules have equal priority
- **AND** `conflict_resolution.fallback` is "merge"
- **THEN** both rules' content is included

### Requirement: Compilation Failure Handling
The system SHALL handle compilation failures gracefully with clear error messages.

#### Scenario: Missing project.md
- **WHEN** compiling for Claude or Agents target
- **AND** `project.md` does not exist
- **THEN** the system reports a blocking error specifying the missing file

#### Scenario: Missing architecture.md
- **WHEN** compiling for Claude or Agents target
- **AND** `architecture.md` does not exist
- **THEN** the system continues with a warning (file is optional)

#### Scenario: Empty rules directory
- **WHEN** compiling and `.context/rules/` contains no rule files
- **THEN** the system reports a warning and generates minimal output

#### Scenario: Disk write failure
- **WHEN** writing compiled output fails (permissions, disk full)
- **THEN** the system reports a blocking error with the specific I/O error

#### Scenario: Invalid rule content
- **WHEN** a rule file cannot be parsed
- **THEN** the system reports the parsing error and skips that rule with warning

## Testing Requirements

### Unit Tests

#### Token Estimation Tests
- [ ] Test prose content (README text) uses 3.5 ratio
- [ ] Test code content (TypeScript file) uses 2.5 ratio
- [ ] Test mixed content uses 3.0 ratio
- [ ] Test CJK content uses 1.5 ratio
- [ ] Test content type detection identifies code indicators
- [ ] Test content type detection identifies CJK patterns
- [ ] Test budget margin reserves 5% correctly
- [ ] Test budget enforcement stops at limit

#### Rule Selection Tests
- [ ] Test directory filter includes matching directories
- [ ] Test directory filter includes nested subdirectories
- [ ] Test glob matching selects rules with matching patterns
- [ ] Test glob matching excludes rules with no matches
- [ ] Test priority ordering processes high priority first
- [ ] Test equal priority falls back to alphabetical order
- [ ] Test tag filtering includes matching tags
- [ ] Test tag filtering excludes untagged rules when filter active

#### Cursor Compilation Tests
- [ ] Test .mdc file generation creates valid format
- [ ] Test file naming follows `[domain]-[name].mdc` pattern
- [ ] Test frontmatter includes description, globs, alwaysApply
- [ ] Test explicit globs are preserved
- [ ] Test inferred globs use directory path
- [ ] Test special characters in names are sanitized

#### Claude Compilation Tests
- [ ] Test output includes project.md content
- [ ] Test output includes architecture.md summary
- [ ] Test token budget is enforced
- [ ] Test directory index is generated
- [ ] Test meta-rule is injected
- [ ] Test always_include files are added before budget check

#### Agents Compilation Tests
- [ ] Test output includes full project.md
- [ ] Test output includes full architecture.md
- [ ] Test rule summaries include description and first paragraph
- [ ] Test token budget is enforced
- [ ] Test meta-rule is injected

#### Conflict Resolution Tests
- [ ] Test priority_wins strategy selects highest priority
- [ ] Test merge fallback combines equal priority rules
- [ ] Test conflict detection identifies overlapping globs

### Integration Tests

#### Full Compilation Pipeline Tests
- [ ] Test compilation of sample project with all three targets
- [ ] Test incremental compilation after single rule change
- [ ] Test compilation with validation errors (should fail)
- [ ] Test compilation with warnings only (should succeed)

### Performance Tests

#### Benchmark Tests
- [ ] Measure compilation time for 10 rules
- [ ] Measure compilation time for 50 rules
- [ ] Measure compilation time for 100 rules
- [ ] Test parallel rule processing improves performance
- [ ] Establish baseline: 100 rules should compile in <3 seconds
