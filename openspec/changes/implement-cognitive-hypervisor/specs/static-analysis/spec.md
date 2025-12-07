## ADDED Requirements

### Requirement: Schema Validation
The system SHALL validate all rule files against the required schema before compilation.

#### Scenario: Valid schema
- **WHEN** a rule file has valid frontmatter with all required fields
- **THEN** the schema validation passes

#### Scenario: Invalid field type
- **WHEN** a rule file has a field with wrong type (e.g., priority as string)
- **THEN** the system reports a blocking error with field name and expected type

#### Scenario: Unknown fields
- **WHEN** a rule file has unrecognized frontmatter fields
- **THEN** the system ignores them (extensibility) but may warn

### Requirement: Dead Link Detection
The system SHALL detect and report broken file references within rule markdown content.

#### Scenario: Valid internal link
- **WHEN** a rule contains `[Link](../other-rule.md)` and the target exists
- **THEN** no error is reported

#### Scenario: Broken internal link
- **WHEN** a rule contains `[Link](../missing.md)` and the target does not exist
- **THEN** the system reports a blocking error with source file and broken path

#### Scenario: External links
- **WHEN** a rule contains `[Link](https://example.com)`
- **THEN** the system does not validate external URLs

#### Scenario: At-symbol references
- **WHEN** a rule contains `@path/to/file` references
- **THEN** the system validates the referenced file exists

### Requirement: Duplicate ID Detection
The system SHALL detect and report when multiple rules use the same ID.

#### Scenario: Duplicate detection
- **WHEN** rules `auth.md` and `security.md` both have `id: "auth"`
- **THEN** the system reports a blocking error listing both file paths

#### Scenario: Unique IDs
- **WHEN** all rules have distinct IDs
- **THEN** no duplicate ID errors are reported

### Requirement: Ghost Rule Detection
The system SHALL warn when rule glob patterns match no existing files in the project.

#### Scenario: Ghost rule detected
- **WHEN** a rule has `globs: ["**/legacy/**"]` but no files match that pattern
- **THEN** the system reports a warning (not blocking) about the orphaned rule

#### Scenario: Matching globs
- **WHEN** a rule has globs that match at least one project file
- **THEN** no ghost rule warning is reported

#### Scenario: Rules without globs
- **WHEN** a rule has no globs (applies globally)
- **THEN** no ghost rule check is performed

### Requirement: Circular Reference Detection
The system SHALL detect and block circular references between rules.

#### Scenario: Direct circular reference
- **WHEN** rule A references rule B and rule B references rule A
- **THEN** the system reports a blocking error about circular dependency
- **AND** the build is halted

#### Scenario: Transitive circular reference
- **WHEN** rule A references B, B references C, and C references A
- **THEN** the system reports a blocking error listing the full dependency chain: A → B → C → A
- **AND** the build is halted

#### Scenario: No circular references
- **WHEN** all rule references form a directed acyclic graph
- **THEN** no circular reference errors are reported

#### Scenario: Self-reference
- **WHEN** rule A references itself
- **THEN** the system reports a blocking error about self-referential dependency

### Requirement: Token Limit Warning
The system SHALL warn when compiled output is projected to exceed target platform limits.

#### Scenario: CLAUDE.md token warning
- **WHEN** the compiled CLAUDE.md is estimated to exceed 4000 tokens (or configured limit)
- **THEN** the system reports a warning with estimated token count

#### Scenario: MDC file token warning
- **WHEN** a compiled .mdc file is estimated to exceed 10000 tokens
- **THEN** the system reports a warning for that specific file

#### Scenario: AGENTS.md token warning
- **WHEN** the compiled AGENTS.md is estimated to exceed 8000 tokens (or configured limit)
- **THEN** the system reports a warning with estimated token count

#### Scenario: Within limits
- **WHEN** all compiled outputs are within their respective limits
- **THEN** no token warnings are reported

### Requirement: Validation Result Types
The system SHALL categorize validation issues as either blocking errors or non-blocking warnings.

#### Scenario: Blocking errors
- **WHEN** schema validation, dead links, duplicate IDs, circular references, or path traversal are detected
- **THEN** the build is blocked and a non-zero exit code (1) is returned

#### Scenario: Non-blocking warnings
- **WHEN** ghost rules or token limits are detected
- **THEN** the build continues but warnings are displayed to the user

#### Scenario: Combined output
- **WHEN** both errors and warnings exist
- **THEN** all issues are reported with clear categorization (ERROR vs WARNING prefix)

### Requirement: Path Traversal Protection
The system SHALL detect and block attempts to access files outside the project scope.

#### Scenario: Parent directory traversal
- **WHEN** a rule file path or reference contains `..` patterns
- **THEN** the system reports a blocking security error

#### Scenario: Absolute path outside project
- **WHEN** a rule reference uses an absolute path outside the project directory
- **THEN** the system reports a blocking security error

#### Scenario: URL-encoded traversal
- **WHEN** a path contains URL-encoded traversal patterns (e.g., `%2e%2e`)
- **THEN** the system decodes and detects the traversal attempt
- **AND** reports a blocking security error

#### Scenario: Null byte injection
- **WHEN** a path contains null bytes (`\0`)
- **THEN** the system reports a blocking security error

#### Scenario: Symlink outside project
- **WHEN** a rule file is a symlink pointing outside the project directory
- **THEN** the system reports a blocking security error

#### Scenario: Valid nested paths
- **WHEN** a rule reference uses valid relative paths within `.context/`
- **THEN** the path is accepted and resolved correctly

### Requirement: Validation Error Details
The system SHALL provide actionable error details for all validation failures.

#### Scenario: Error message format
- **WHEN** a validation error is reported
- **THEN** the message includes:
  - Error type (SCHEMA, DEAD_LINK, DUPLICATE_ID, CIRCULAR_REF, PATH_TRAVERSAL)
  - Source file path with line number if applicable
  - Specific issue description
  - Suggested fix when determinable

#### Scenario: Multiple errors in same file
- **WHEN** a single file has multiple validation errors
- **THEN** all errors are reported, not just the first one

## Testing Requirements

### Unit Tests

#### Schema Validation Tests
- [ ] Test valid frontmatter with all required fields passes validation
- [ ] Test missing required field (id) returns specific error
- [ ] Test missing required field (description) returns specific error
- [ ] Test missing required field (domain) returns specific error
- [ ] Test invalid field type (priority as string) returns type error
- [ ] Test unknown fields are ignored with optional warning
- [ ] Test empty frontmatter fails with clear error message

#### Dead Link Detection Tests
- [ ] Test valid internal link passes validation
- [ ] Test broken internal link returns error with source and target paths
- [ ] Test external URLs are skipped (not validated)
- [ ] Test @-symbol references are validated
- [ ] Test relative paths (../sibling.md) resolve correctly
- [ ] Test absolute paths within project resolve correctly

#### Duplicate ID Detection Tests
- [ ] Test unique IDs across all rules pass validation
- [ ] Test duplicate IDs return error listing both file paths
- [ ] Test case-sensitive ID comparison (auth vs Auth are different)
- [ ] Test empty ID field is caught as schema error

#### Ghost Rule Detection Tests
- [ ] Test globs matching existing files produce no warning
- [ ] Test globs matching no files produce warning with glob pattern
- [ ] Test rules without globs skip ghost rule check
- [ ] Test complex glob patterns are evaluated correctly

#### Circular Reference Detection Tests
- [ ] Test direct A↔B circular reference returns blocking error
- [ ] Test transitive A→B→C→A cycle returns full chain in error
- [ ] Test self-reference returns blocking error
- [ ] Test DAG (valid) produces no error
- [ ] Test complex graphs with multiple entry points

#### Path Traversal Protection Tests
- [ ] Test `..` patterns are blocked
- [ ] Test absolute paths outside project are blocked
- [ ] Test URL-encoded `%2e%2e` is decoded and blocked
- [ ] Test null bytes in paths are blocked
- [ ] Test symlinks outside project are blocked
- [ ] Test valid nested paths within `.context/` are allowed

### Integration Tests

#### Full Pipeline Tests
- [ ] Test pipeline with mix of valid and invalid rules
- [ ] Test error aggregation from multiple files
- [ ] Test warning aggregation with continuing build
- [ ] Test exit code is 1 for blocking errors
- [ ] Test exit code is 0 for warnings only

### Performance Tests

#### Scale Testing
- [ ] Test validation of 100+ rule files completes in <5 seconds
- [ ] Test memory usage stays bounded during large validation runs
