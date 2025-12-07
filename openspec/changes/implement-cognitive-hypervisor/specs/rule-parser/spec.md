## ADDED Requirements

### Requirement: Frontmatter Extraction
The system SHALL extract YAML frontmatter from rule files using the standard `---` delimiters.

#### Scenario: Valid frontmatter
- **WHEN** a rule file contains YAML frontmatter between `---` delimiters
- **THEN** the system parses the YAML content into a structured object
- **AND** separates the remaining markdown as the rule body

#### Scenario: Missing frontmatter
- **WHEN** a rule file has no frontmatter delimiters
- **THEN** the system reports a validation error for missing required fields

#### Scenario: Malformed YAML
- **WHEN** the frontmatter contains invalid YAML syntax
- **THEN** the system reports a parsing error with line number

### Requirement: Required Frontmatter Fields
The system SHALL require the following frontmatter fields: `id`, `description`, and `domain`.

#### Scenario: Valid required fields
- **WHEN** frontmatter contains `id`, `description`, and `domain`
- **THEN** the rule is accepted for further processing

#### Scenario: Missing id field
- **WHEN** frontmatter is missing the `id` field
- **THEN** the system reports a blocking validation error

#### Scenario: Missing description field
- **WHEN** frontmatter is missing the `description` field
- **THEN** the system reports a blocking validation error

#### Scenario: Missing domain field
- **WHEN** frontmatter is missing the `domain` field
- **THEN** the system reports a blocking validation error

### Requirement: Optional Frontmatter Fields
The system SHALL support optional frontmatter fields: `globs`, `priority`, and `tags`.

#### Scenario: Globs field parsing
- **WHEN** frontmatter contains a `globs` array
- **THEN** the system stores glob patterns for file matching
- **AND** each pattern is a string following glob syntax

#### Scenario: Priority field parsing
- **WHEN** frontmatter contains a `priority` number
- **THEN** the system validates it is between 0 and 100 inclusive
- **AND** uses the value for rule selection ordering

#### Scenario: Priority default value
- **WHEN** frontmatter does not contain a `priority` field
- **THEN** the system applies the default value of 50

#### Scenario: Tags field parsing
- **WHEN** frontmatter contains a `tags` array
- **THEN** the system stores tags for filtering and categorization

### Requirement: Glob Inference
The system SHALL infer glob patterns from the rule file's directory path when globs are not explicitly specified.

#### Scenario: Directory-based inference
- **WHEN** a rule file at `rules/backend/auth.md` has no `globs` field
- **THEN** the system infers `globs: ["**/backend/**"]`

#### Scenario: Nested directory inference
- **WHEN** a rule file at `rules/frontend/components/forms.md` has no `globs` field
- **THEN** the system infers `globs: ["**/frontend/components/**"]`

#### Scenario: Root rules directory
- **WHEN** a rule file at `rules/general.md` (directly in rules/) has no `globs` field
- **THEN** the system does not infer globs (applies to all files)

#### Scenario: Explicit globs override
- **WHEN** a rule file has an explicit `globs` field
- **THEN** the system uses the explicit value and does not infer

### Requirement: Content Body Extraction
The system SHALL extract the markdown content after the frontmatter as the rule body.

#### Scenario: Content preservation
- **WHEN** a rule file has content after the closing `---`
- **THEN** the system preserves all markdown formatting, including headers, lists, and code blocks

#### Scenario: Empty content body
- **WHEN** a rule file has no content after the frontmatter
- **THEN** the system allows the rule but warns about empty content

### Requirement: ID Uniqueness
The system SHALL ensure all rule IDs are globally unique across the project.

#### Scenario: Unique IDs
- **WHEN** all rules have distinct `id` values
- **THEN** the system accepts all rules

#### Scenario: Duplicate IDs
- **WHEN** two or more rules have the same `id` value
- **THEN** the system reports a blocking validation error listing all duplicate files

### Requirement: Path Validation
The system SHALL validate all file paths in rule files to prevent path traversal attacks.

#### Scenario: Rule file path validation
- **WHEN** loading a rule file
- **THEN** the system validates the file path is within `.context/rules/`

#### Scenario: Reference path validation
- **WHEN** a rule contains file references (links, imports)
- **THEN** the system validates each reference path:
  1. Normalizes the path (removes `.`, resolves `..`)
  2. Resolves the path relative to `.context/`
  3. Verifies the resolved path is within the project directory

#### Scenario: Dangerous path patterns
- **WHEN** a path contains dangerous patterns:
  - `..` (parent directory traversal)
  - Absolute paths outside project
  - URL-encoded sequences (`%2e%2e`)
  - Null bytes (`\0`)
- **THEN** the system rejects the path with a security error

#### Scenario: Symlink validation
- **WHEN** a file path resolves to a symlink
- **THEN** the system validates the symlink target is within the project directory

### Requirement: Rule File Discovery
The system SHALL discover all rule files within the `.context/rules/` directory.

#### Scenario: Recursive discovery
- **WHEN** scanning for rule files
- **THEN** the system recursively finds all `.md` files in `.context/rules/` and subdirectories

#### Scenario: File extension filtering
- **WHEN** scanning for rule files
- **THEN** only files with `.md` extension are processed

#### Scenario: Hidden files
- **WHEN** scanning for rule files
- **THEN** files starting with `.` are ignored

#### Scenario: Non-UTF8 files
- **WHEN** a file cannot be decoded as UTF-8
- **THEN** the system reports a blocking error for that file

### Requirement: Parsing Error Handling
The system SHALL provide clear error messages for parsing failures.

#### Scenario: YAML syntax error
- **WHEN** frontmatter contains invalid YAML
- **THEN** the error message includes:
  - File path
  - Line number in frontmatter
  - Description of the syntax issue

#### Scenario: Field type mismatch
- **WHEN** a field has wrong type (e.g., priority as "high" instead of number)
- **THEN** the error message specifies expected type

#### Scenario: Invalid glob pattern
- **WHEN** a glob pattern is syntactically invalid
- **THEN** the error message identifies the problematic pattern

## Testing Requirements

### Unit Tests

#### Frontmatter Extraction Tests
- [ ] Test valid frontmatter extraction
- [ ] Test missing frontmatter detection
- [ ] Test malformed YAML error handling
- [ ] Test empty frontmatter handling
- [ ] Test content body preservation

#### Required Fields Tests
- [ ] Test all required fields present passes validation
- [ ] Test missing id field returns error
- [ ] Test missing description field returns error
- [ ] Test missing domain field returns error
- [ ] Test empty string values for required fields

#### Optional Fields Tests
- [ ] Test globs array parsing
- [ ] Test priority validation (0-100 range)
- [ ] Test priority default value (50)
- [ ] Test tags array parsing
- [ ] Test invalid priority value (negative, >100)

#### Glob Inference Tests
- [ ] Test directory-based glob inference
- [ ] Test nested directory inference
- [ ] Test root directory (no inference)
- [ ] Test explicit globs override inference

#### Path Validation Tests
- [ ] Test valid relative paths accepted
- [ ] Test `..` traversal rejected
- [ ] Test absolute paths rejected
- [ ] Test URL-encoded traversal rejected
- [ ] Test null bytes rejected
- [ ] Test symlinks within project accepted
- [ ] Test symlinks outside project rejected

#### File Discovery Tests
- [ ] Test recursive discovery finds nested files
- [ ] Test only .md files are included
- [ ] Test hidden files are excluded
- [ ] Test non-UTF8 files cause error

### Integration Tests

#### Full Parsing Pipeline Tests
- [ ] Test parsing multiple rules
- [ ] Test duplicate ID detection across files
- [ ] Test glob inference with multiple directories
- [ ] Test error aggregation for multiple failures
