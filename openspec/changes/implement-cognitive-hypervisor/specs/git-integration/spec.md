## ADDED Requirements

### Requirement: Pre-commit Hook Installation
The system SHALL install a Git pre-commit hook for automated compilation.

#### Scenario: Hook installation during init
- **WHEN** user runs `ctxinit` in a Git repository
- **THEN** the system offers to install a pre-commit hook

#### Scenario: Husky detection
- **WHEN** Husky is already installed in the project
- **THEN** the system adds the hook to `.husky/pre-commit`

#### Scenario: Husky installation
- **WHEN** Husky is not installed and user agrees
- **THEN** the system installs Husky as a dev dependency
- **AND** initializes Husky in the project

#### Scenario: No Git repository
- **WHEN** `ctxinit` runs in a directory without `.git/`
- **THEN** hook installation is skipped with a message

### Requirement: Pre-commit Hook Behavior
The system SHALL run incremental builds during pre-commit.

#### Scenario: Hook execution
- **WHEN** a commit is initiated
- **THEN** the hook runs `ctx build --incremental`

#### Scenario: Validation success
- **WHEN** build succeeds with no blocking errors
- **THEN** the commit proceeds normally

#### Scenario: Validation failure
- **WHEN** build fails with blocking errors
- **THEN** the commit is blocked with error details

#### Scenario: Auto-staging outputs
- **WHEN** compilation generates or updates output files
- **THEN** the hook stages updated CLAUDE.md, AGENTS.md, and .cursor/rules/*.mdc

### Requirement: Hook Script Generation
The system SHALL generate a pre-commit hook script compatible with Husky.

#### Scenario: Script content
- **WHEN** generating the pre-commit hook
- **THEN** the script includes:
  - Shebang for shell execution
  - Call to `ctx build --incremental`
  - Exit code propagation
  - Auto-staging of output files

#### Scenario: Script permissions
- **WHEN** the hook script is created
- **THEN** it has executable permissions (chmod +x)

### Requirement: Gitignore Management
The system SHALL manage `.gitignore` entries for build artifacts.

#### Scenario: Build manifest ignore
- **WHEN** `.context/` is created
- **THEN** `.context/.build-manifest.json` is added to `.gitignore`

#### Scenario: Optional output ignore
- **WHEN** user chooses not to commit compiled outputs
- **THEN** the system adds CLAUDE.md, AGENTS.md, .cursor/rules/ to `.gitignore`

#### Scenario: Existing gitignore
- **WHEN** `.gitignore` already exists
- **THEN** new entries are appended without duplicating existing ones

#### Scenario: No gitignore
- **WHEN** `.gitignore` does not exist
- **THEN** the system creates it with the required entries

### Requirement: Hook Bypass
The system SHALL support bypassing the hook when needed.

#### Scenario: Skip hook flag
- **WHEN** user runs `git commit --no-verify`
- **THEN** the pre-commit hook is skipped

#### Scenario: CI environment
- **WHEN** CI=true environment variable is set
- **THEN** the hook may run in a non-interactive mode

### Requirement: Hook Update
The system SHALL support updating the hook script.

#### Scenario: Version update
- **WHEN** the ctxinit tool is updated
- **THEN** `ctxinit --update-hooks` can regenerate hook scripts

#### Scenario: Hook customization preservation
- **WHEN** user has added custom logic to the hook
- **THEN** the system warns before overwriting

## Testing Requirements

### Unit Tests

#### Hook Installation Tests
- [ ] Test hook installation offer in Git repository
- [ ] Test Husky detection and integration
- [ ] Test Husky installation when not present
- [ ] Test skip message when not in Git repository
- [ ] Test hook script content generation
- [ ] Test hook script has executable permissions

#### Hook Behavior Tests
- [ ] Test hook runs `ctx build --incremental`
- [ ] Test commit proceeds on build success
- [ ] Test commit blocked on build failure
- [ ] Test auto-staging of updated output files
- [ ] Test exit code propagation

#### Gitignore Management Tests
- [ ] Test .build-manifest.json added to .gitignore
- [ ] Test optional output files added to .gitignore
- [ ] Test entries appended without duplicates
- [ ] Test .gitignore creation when not exists

#### Hook Bypass Tests
- [ ] Test --no-verify skips hook
- [ ] Test CI=true environment handling
- [ ] Test non-interactive mode behavior

#### Hook Update Tests
- [ ] Test --update-hooks regenerates scripts
- [ ] Test customization preservation warning
- [ ] Test version update detection

### Integration Tests

#### E2E Git Workflow Tests
- [ ] Test full init + commit workflow
- [ ] Test hook execution during commit
- [ ] Test auto-staging in real Git repository
- [ ] Test Husky integration end-to-end

#### Cross-Platform Tests
- [ ] Test hook execution on macOS
- [ ] Test hook execution on Linux
- [ ] Test hook execution on Windows (Git Bash)
