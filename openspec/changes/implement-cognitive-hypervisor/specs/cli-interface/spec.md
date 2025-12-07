## ADDED Requirements

### Requirement: Unified CLI Binary
The system SHALL provide a single `ctx` command with subcommands for all operations.

#### Scenario: Single entry point
- **WHEN** user interacts with the tool
- **THEN** all operations are accessed through the `ctx` binary

#### Scenario: npx execution
- **WHEN** user runs `npx ctx init`
- **THEN** the tool executes without requiring global installation

#### Scenario: Subcommand structure
- **WHEN** user runs `ctx`
- **THEN** available subcommands are displayed:
  - `init` - Project initialization
  - `build` - Compile rules to targets
  - `lint` - Validate rules
  - `diff` - Compare with legacy files
  - `migrate` - Migration operations
  - `verify` - Verify checksums

### Requirement: Initialization Command
The system SHALL provide a `ctx init` subcommand for project initialization.

#### Scenario: Basic initialization
- **WHEN** user runs `ctx init` in a project directory
- **THEN** the system creates the `.context/` directory structure
- **AND** generates template files for configuration and rules

#### Scenario: Interactive agent selection
- **WHEN** `ctx init` runs interactively
- **THEN** the user is prompted to select target agents:
  - Cursor IDE
  - Claude Code
  - All agents

#### Scenario: Non-interactive mode
- **WHEN** `ctx init --no-interactive` is specified
- **THEN** default options are used without prompts

### Requirement: Migration Wizard
The system SHALL provide a guided migration wizard for existing projects.

#### Scenario: Wizard activation
- **WHEN** user runs `ctx init --wizard`
- **THEN** an interactive migration wizard is launched

#### Scenario: Wizard steps
- **WHEN** the migration wizard runs
- **THEN** it guides the user through:
  1. Detecting existing context files (.cursorrules, CLAUDE.md, AGENTS.md)
  2. Analyzing content structure and size
  3. Recommending migration strategy (direct vs attach mode)
  4. Previewing planned changes
  5. Confirming migration actions
  6. Executing migration with progress display

#### Scenario: Wizard abort
- **WHEN** user presses Ctrl+C or selects "Cancel" during wizard
- **THEN** no changes are made and the wizard exits gracefully

#### Scenario: Wizard dry-run
- **WHEN** user runs `ctx init --wizard --dry-run`
- **THEN** the wizard shows what would happen without making changes

### Requirement: Initialization Conflict Detection
The system SHALL detect existing context files and warn before overwriting.

#### Scenario: Existing .context directory
- **WHEN** `.context/` already exists
- **THEN** the system warns and requires `--force` to overwrite

#### Scenario: Force flag
- **WHEN** `ctx init --force` is specified
- **THEN** existing `.context/` is backed up and replaced

### Requirement: Build Command
The system SHALL provide a `ctx build` subcommand for compiling rules to target formats.

#### Scenario: Full build
- **WHEN** user runs `ctx build`
- **THEN** the system:
  1. Scans `.context/rules/` for all rule files
  2. Runs static analysis and reports issues
  3. Compiles to all configured targets
  4. Displays compilation summary

#### Scenario: Incremental build
- **WHEN** user runs `ctx build --incremental`
- **THEN** only changed files are recompiled based on manifest

#### Scenario: Build output
- **WHEN** build completes successfully
- **THEN** the system displays:
  - Number of rules processed
  - Files generated
  - Estimated token counts per output
  - Build duration

### Requirement: Build Error Handling
The system SHALL handle build errors gracefully with clear error messages.

#### Scenario: Validation errors
- **WHEN** static analysis finds blocking errors
- **THEN** the build stops with error details and non-zero exit code

#### Scenario: Validation warnings
- **WHEN** static analysis finds warnings only
- **THEN** the build continues and warnings are displayed

#### Scenario: File system errors
- **WHEN** the system cannot read or write files
- **THEN** a clear error message indicates the problematic path

### Requirement: Lint Command
The system SHALL provide a `ctx lint` command for standalone validation.

#### Scenario: Lint all rules
- **WHEN** user runs `ctx lint`
- **THEN** all rules are validated without compilation

#### Scenario: Lint specific files
- **WHEN** user runs `ctx lint rules/auth.md`
- **THEN** only the specified file is validated

#### Scenario: JSON output
- **WHEN** user runs `ctx lint --json`
- **THEN** validation results are output as JSON for tooling integration

### Requirement: Diff Command for Migration
The system SHALL provide a `ctx diff` command for comparing with legacy files.

#### Scenario: Legacy comparison
- **WHEN** user runs `ctx diff --legacy`
- **THEN** the system compares compiled output with existing legacy files
- **AND** displays differences in a readable format

#### Scenario: No legacy files
- **WHEN** no legacy files exist
- **THEN** the system reports that no comparison is available

### Requirement: Help and Version
The system SHALL provide standard help and version information.

#### Scenario: Help flag
- **WHEN** user runs `ctx --help`
- **THEN** available commands and options are displayed

#### Scenario: Version flag
- **WHEN** user runs `ctx --version`
- **THEN** the current tool version is displayed

#### Scenario: Command-specific help
- **WHEN** user runs `ctx build --help`
- **THEN** options specific to the build command are displayed

### Requirement: Exit Codes
The system SHALL return appropriate exit codes for automation.

#### Scenario: Success
- **WHEN** a command completes successfully
- **THEN** exit code is 0

#### Scenario: Validation error
- **WHEN** blocking validation errors are found
- **THEN** exit code is 1

#### Scenario: Runtime error
- **WHEN** an unexpected error occurs
- **THEN** exit code is 2

### Requirement: Verbose Output
The system SHALL support verbose output for debugging.

#### Scenario: Verbose flag
- **WHEN** user runs `ctx build --verbose`
- **THEN** detailed progress information is displayed
- **AND** includes file-by-file processing details

#### Scenario: Quiet flag
- **WHEN** user runs `ctx build --quiet`
- **THEN** only errors and final summary are displayed

### Requirement: CLI Error Messages
The system SHALL provide clear, actionable error messages.

#### Scenario: Unknown command
- **WHEN** user runs `ctx unknown`
- **THEN** the system reports:
  - Error: Unknown command 'unknown'
  - Suggests similar commands if available
  - Displays help hint

#### Scenario: Missing required argument
- **WHEN** a command is missing required arguments
- **THEN** the system reports the missing argument with usage example

#### Scenario: Invalid option value
- **WHEN** an option receives an invalid value
- **THEN** the system reports the expected value type/range

#### Scenario: Build lock conflict
- **WHEN** user runs `ctx build` and another build is running
- **THEN** the system reports:
  - Error: Build already in progress
  - Lock file location
  - Suggestion to wait or use --force-unlock (with warning)

### Requirement: Windows Compatibility
The system SHALL work correctly on Windows systems.

#### Scenario: Path separators
- **WHEN** running on Windows
- **THEN** the system handles both `/` and `\` path separators

#### Scenario: Line endings
- **WHEN** writing output files on Windows
- **THEN** the system uses platform-appropriate line endings (or configurable)

#### Scenario: Executable permissions
- **WHEN** installing via npm on Windows
- **THEN** the CLI is executable without additional setup

## Testing Requirements

### Unit Tests

#### CLI Parsing Tests
- [ ] Test subcommand routing (init, build, lint, diff, migrate, verify)
- [ ] Test flag parsing for all commands
- [ ] Test unknown command handling
- [ ] Test missing argument handling
- [ ] Test help text generation

#### Init Command Tests
- [ ] Test directory structure creation
- [ ] Test template file generation
- [ ] Test agent selection prompts
- [ ] Test --no-interactive mode
- [ ] Test --force flag with existing directory
- [ ] Test --wizard launches migration wizard

#### Build Command Tests
- [ ] Test full build execution
- [ ] Test --incremental flag
- [ ] Test --verbose output
- [ ] Test --quiet output
- [ ] Test exit codes (0, 1, 2)

#### Lint Command Tests
- [ ] Test validation of all rules
- [ ] Test specific file validation
- [ ] Test --json output format
- [ ] Test exit codes for errors vs warnings

#### Migration Wizard Tests
- [ ] Test wizard detects legacy files
- [ ] Test wizard recommends strategies
- [ ] Test wizard dry-run mode
- [ ] Test wizard abort handling

### Integration Tests

#### E2E Command Tests
- [ ] Test full initialization flow
- [ ] Test build after initialization
- [ ] Test lint with validation errors
- [ ] Test diff with legacy files

### Platform Tests

#### Cross-Platform Tests
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Test on Windows (path handling, line endings)
- [ ] Test npx execution on each platform
