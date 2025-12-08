## ADDED Requirements

### Requirement: Legacy File Detection
The system SHALL detect existing AI context files in the project.

#### Scenario: Detect .cursorrules
- **WHEN** user runs `ctxinit --analyze`
- **AND** `.cursorrules` exists in the project
- **THEN** the file is reported with size and line count

#### Scenario: Detect CLAUDE.md
- **WHEN** user runs `ctxinit --analyze`
- **AND** `CLAUDE.md` exists in the project
- **THEN** the file is reported with size and line count

#### Scenario: Detect AGENTS.md
- **WHEN** user runs `ctxinit --analyze`
- **AND** `AGENTS.md` exists in the project
- **THEN** the file is reported with size and line count

#### Scenario: Detect .cursor/rules/
- **WHEN** user runs `ctxinit --analyze`
- **AND** `.cursor/rules/*.mdc` files exist
- **THEN** the files are reported with count and total size

#### Scenario: No legacy files
- **WHEN** user runs `ctxinit --analyze`
- **AND** no legacy files are found
- **THEN** the system reports a clean state

### Requirement: Migration Recommendation
The system SHALL provide migration recommendations based on detected files.

#### Scenario: Simple migration
- **WHEN** only single legacy files exist (e.g., just CLAUDE.md)
- **THEN** the system recommends direct migration

#### Scenario: Complex migration
- **WHEN** multiple legacy formats exist
- **THEN** the system recommends attach mode for gradual migration

#### Scenario: Large files
- **WHEN** legacy files exceed reasonable size (>5KB)
- **THEN** the system warns about potential content review needs

### Requirement: Attach Mode Initialization
The system SHALL support initializing alongside existing files without replacing them.

#### Scenario: Attach mode activation
- **WHEN** user runs `ctxinit --attach`
- **THEN** the system creates `.context/` without modifying existing files

#### Scenario: Legacy content import
- **WHEN** `ctxinit --attach` runs with existing legacy files
- **THEN** the system offers to import content as `.context/rules/legacy.md`

#### Scenario: Attach mode configuration
- **WHEN** attach mode is used
- **THEN** `config.yaml` includes:
  ```yaml
  migration:
    mode: "attach"
    preserve_legacy: true
    legacy_files:
      - ".cursorrules"
      - "CLAUDE.md"
  ```

### Requirement: Attach Mode Compilation
The system SHALL append to existing files instead of replacing them during attach mode.

#### Scenario: Append behavior
- **WHEN** compiling in attach mode
- **AND** `preserve_legacy: true`
- **THEN** new compiled content is appended to existing legacy files

#### Scenario: Section markers
- **WHEN** appending to legacy files
- **THEN** new content is wrapped in identifiable markers:
  ```markdown
  <!-- ctx-generated:start -->
  ...compiled content...
  <!-- ctx-generated:end -->
  ```

#### Scenario: Regeneration
- **WHEN** recompiling in attach mode
- **THEN** only the ctx-generated section is replaced

### Requirement: Legacy Comparison
The system SHALL support comparing compiled output with legacy files.

#### Scenario: Diff command
- **WHEN** user runs `ctx diff --legacy`
- **THEN** the system shows differences between:
  - Compiled CLAUDE.md vs existing CLAUDE.md
  - Compiled AGENTS.md vs existing AGENTS.md

#### Scenario: Diff output format
- **WHEN** differences exist
- **THEN** they are displayed in a unified diff format

#### Scenario: No differences
- **WHEN** compiled output matches legacy files
- **THEN** the system reports migration is complete

### Requirement: Migration Completion
The system SHALL support finalizing migration and removing legacy mode.

#### Scenario: Complete migration command
- **WHEN** user runs `ctxinit --complete-migration`
- **THEN** the system:
  1. Prompts for confirmation
  2. Removes legacy files (with backup option)
  3. Updates config.yaml to remove attach mode
  4. Performs a full rebuild

#### Scenario: Migration validation
- **WHEN** completing migration
- **THEN** the system validates that `.context/` contains equivalent rules

#### Scenario: Backup creation
- **WHEN** completing migration
- **THEN** legacy files are backed up to `.context/legacy-backup/`

#### Scenario: Abort option
- **WHEN** user chooses not to proceed
- **THEN** no changes are made

### Requirement: Partial Migration Support
The system SHALL support migrating rules incrementally.

#### Scenario: Rule by rule migration
- **WHEN** a rule is added to `.context/rules/`
- **THEN** it can coexist with legacy files

#### Scenario: Progressive replacement
- **WHEN** `.context/` rules cover the same content as legacy
- **THEN** the attach mode section grows while legacy content becomes redundant

#### Scenario: Migration tracking
- **WHEN** in attach mode
- **THEN** `config.yaml` can track migration_complete: false

## Testing Requirements

### Unit Tests

#### Legacy File Detection Tests
- [ ] Test .cursorrules detection with size/line count
- [ ] Test CLAUDE.md detection with size/line count
- [ ] Test AGENTS.md detection with size/line count
- [ ] Test .cursor/rules/*.mdc detection with count
- [ ] Test clean state when no legacy files exist

#### Migration Recommendation Tests
- [ ] Test simple migration recommendation for single file
- [ ] Test complex migration recommendation for multiple formats
- [ ] Test large file warning (>5KB threshold)
- [ ] Test recommendation accuracy for different scenarios

#### Attach Mode Tests
- [ ] Test .context/ creation without modifying existing files
- [ ] Test legacy content import offer
- [ ] Test config.yaml attach mode settings
- [ ] Test preserve_legacy flag behavior

#### Attach Mode Compilation Tests
- [ ] Test append behavior to existing files
- [ ] Test section markers (ctx-generated:start/end)
- [ ] Test only ctx-generated section replaced on recompile
- [ ] Test marker integrity across multiple builds

#### Legacy Comparison Tests
- [ ] Test diff command output format
- [ ] Test unified diff display
- [ ] Test "migration complete" message when no differences
- [ ] Test comparison accuracy between compiled and legacy

#### Migration Completion Tests
- [ ] Test confirmation prompt
- [ ] Test legacy file removal
- [ ] Test backup creation to .context/legacy-backup/
- [ ] Test config.yaml update to remove attach mode
- [ ] Test full rebuild after migration
- [ ] Test abort option preserves state

#### Partial Migration Tests
- [ ] Test rule coexistence with legacy files
- [ ] Test progressive replacement behavior
- [ ] Test migration tracking in config.yaml

### Integration Tests

#### Full Migration Pipeline Tests
- [ ] Test analyze → attach → migrate → complete workflow
- [ ] Test migration with all legacy file types present
- [ ] Test migration with mixed content sizes
- [ ] Test rollback capability using backups

#### Edge Case Tests
- [ ] Test migration with empty legacy files
- [ ] Test migration with malformed legacy content
- [ ] Test migration with special characters in content
- [ ] Test migration interruption and recovery
