## ADDED Requirements

### Requirement: Context Directory Structure
The system SHALL create and manage a `.context/` directory structure as the single source of truth for all AI context rules.

#### Scenario: Directory initialization
- **WHEN** the user runs `ctxinit` in a project directory
- **THEN** the system creates the following structure:
  - `.context/config.yaml` (compilation configuration)
  - `.context/project.md` (global project context)
  - `.context/architecture.md` (global design patterns)
  - `.context/rules/` (atomic rule library directory)

#### Scenario: Directory already exists
- **WHEN** the user runs `ctxinit` and `.context/` already exists
- **THEN** the system warns the user and requires `--force` flag to overwrite

### Requirement: Configuration Schema
The system SHALL support a `config.yaml` file with compilation settings for each target platform.

#### Scenario: Claude target configuration
- **WHEN** `config.yaml` contains a `compile.claude` section
- **THEN** the system reads:
  - `max_tokens`: Maximum token budget (default: 4000)
  - `strategy`: Rule selection strategy (priority, directory, glob, tag)
  - `always_include`: List of files to always include

#### Scenario: Cursor target configuration
- **WHEN** `config.yaml` contains a `compile.cursor` section
- **THEN** the system reads:
  - `strategy`: Rule selection strategy (default: all)

#### Scenario: Agents target configuration
- **WHEN** `config.yaml` contains a `compile.agents` section
- **THEN** the system reads:
  - `max_tokens`: Maximum token budget (default: 8000)
  - `strategy`: Rule selection strategy
  - `include_dirs`: List of directories to include

#### Scenario: Conflict resolution configuration
- **WHEN** `config.yaml` contains a `conflict_resolution` section
- **THEN** the system reads:
  - `strategy`: Resolution strategy (priority_wins, merge)
  - `fallback`: Fallback strategy when priority is equal

#### Scenario: Missing configuration file
- **WHEN** `.context/config.yaml` does not exist
- **THEN** the system uses default configuration values

### Requirement: Rule File Location
The system SHALL recognize rule files as any `.md` file within the `.context/rules/` directory tree.

#### Scenario: Rule discovery
- **WHEN** the system scans for rules
- **THEN** it finds all `.md` files recursively under `.context/rules/`
- **AND** ignores non-markdown files

#### Scenario: Nested directories
- **WHEN** rules are organized in nested directories (e.g., `rules/backend/auth.md`)
- **THEN** the directory path is used for domain inference and file naming

### Requirement: Global Context Files
The system SHALL support `project.md` and `architecture.md` as global context files that are included in compiled outputs.

#### Scenario: Project context inclusion
- **WHEN** `.context/project.md` exists
- **THEN** its content is included in CLAUDE.md and AGENTS.md outputs

#### Scenario: Architecture context inclusion
- **WHEN** `.context/architecture.md` exists
- **THEN** its content is included in CLAUDE.md (summarized) and AGENTS.md (full)

#### Scenario: Missing project.md file
- **WHEN** `project.md` does not exist
- **THEN** the system reports an error indicating project.md is required

#### Scenario: Missing architecture.md file
- **WHEN** `architecture.md` does not exist
- **THEN** the system proceeds without error, omitting that section from output

### Requirement: Configuration Validation
The system SHALL validate configuration file content.

#### Scenario: Invalid YAML syntax
- **WHEN** `config.yaml` contains invalid YAML
- **THEN** the system reports a clear error with line number

#### Scenario: Unknown configuration keys
- **WHEN** `config.yaml` contains unrecognized keys
- **THEN** the system warns but continues with valid keys

#### Scenario: Invalid token budget
- **WHEN** `max_tokens` is negative or non-numeric
- **THEN** the system reports a validation error

#### Scenario: Invalid strategy value
- **WHEN** `strategy` is not one of: priority, directory, glob, tag, all
- **THEN** the system reports a validation error with valid options

## Testing Requirements

### Unit Tests

#### Directory Structure Tests
- [ ] Test `.context/` directory creation
- [ ] Test all required files are created (config.yaml, project.md, architecture.md, rules/)
- [ ] Test existing directory detection with warning
- [ ] Test --force flag overwrites existing directory

#### Configuration Schema Tests
- [ ] Test valid Claude configuration parsing
- [ ] Test valid Cursor configuration parsing
- [ ] Test valid Agents configuration parsing
- [ ] Test default values when config is missing
- [ ] Test invalid YAML syntax error handling
- [ ] Test unknown keys produce warning
- [ ] Test invalid max_tokens validation
- [ ] Test invalid strategy validation

#### Rule Discovery Tests
- [ ] Test recursive .md file discovery
- [ ] Test non-markdown files are ignored
- [ ] Test nested directory handling

#### Global Context Tests
- [ ] Test project.md inclusion in outputs
- [ ] Test architecture.md inclusion in outputs
- [ ] Test missing global files handled gracefully

### Integration Tests

#### Full Config Pipeline Tests
- [ ] Test initialization with different target selections
- [ ] Test configuration override behavior
- [ ] Test config changes trigger rebuilds
