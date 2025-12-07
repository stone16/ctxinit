## ADDED Requirements

### Requirement: Build Manifest
The system SHALL maintain a build manifest file to track compilation state for incremental builds.

#### Scenario: Manifest location
- **WHEN** a build completes successfully
- **THEN** the manifest is written to `.context/.build-manifest.json`

#### Scenario: Manifest content
- **WHEN** the manifest is updated
- **THEN** it contains:
  - `version`: Manifest format version
  - `lastBuild`: ISO 8601 timestamp of last build
  - `files`: Map of source files to their build state

#### Scenario: File entry content
- **WHEN** a file entry is recorded
- **THEN** it contains:
  - `hash`: SHA-256 hash of file content
  - `mtime`: File modification timestamp (Unix epoch)
  - `compiledTo`: Array of output file paths

#### Scenario: Manifest not committed
- **WHEN** `.context/.build-manifest.json` exists
- **THEN** it should be listed in `.gitignore`

### Requirement: Change Detection via Modification Time
The system SHALL use file modification time as a fast-path for change detection.

#### Scenario: Mtime unchanged
- **WHEN** a file's mtime matches the manifest entry
- **THEN** the file is considered unchanged (skip hash check)

#### Scenario: Mtime changed
- **WHEN** a file's mtime differs from the manifest entry
- **THEN** the system proceeds to content hash verification

#### Scenario: New file detected
- **WHEN** a file exists but has no manifest entry
- **THEN** the file is considered changed and requires compilation

### Requirement: Change Detection via Content Hash
The system SHALL use SHA-256 content hashing to verify actual content changes.

#### Scenario: Hash unchanged
- **WHEN** a file's mtime changed but its content hash matches the manifest
- **THEN** the file is considered unchanged (mtime-only change, e.g., touch)
- **AND** the manifest mtime is updated

#### Scenario: Hash changed
- **WHEN** a file's content hash differs from the manifest
- **THEN** the file is marked for recompilation

#### Scenario: Hash algorithm
- **WHEN** computing a file hash
- **THEN** the system uses SHA-256 and stores as hex string with "sha256:" prefix

### Requirement: Dependency Tracking
The system SHALL track dependencies between rules for cascading rebuilds.

#### Scenario: Rule references another rule
- **WHEN** rule A contains a reference to rule B (e.g., link or import)
- **THEN** the dependency is recorded in the manifest

#### Scenario: Cascading rebuild
- **WHEN** rule B changes and rule A depends on rule B
- **THEN** rule A is also marked for recompilation

#### Scenario: Config file dependency
- **WHEN** `config.yaml` changes
- **THEN** all outputs are marked for recompilation

#### Scenario: Global context file dependency
- **WHEN** `project.md` or `architecture.md` changes
- **THEN** CLAUDE.md and AGENTS.md are marked for recompilation

### Requirement: Selective Recompilation
The system SHALL only recompile outputs affected by changed source files.

#### Scenario: Single rule change
- **WHEN** only `rules/backend/auth.md` has changed
- **THEN** only `.cursor/rules/backend-auth.mdc` and affected aggregate files are recompiled

#### Scenario: Multiple rule changes
- **WHEN** multiple rules have changed
- **THEN** all their corresponding outputs are recompiled

#### Scenario: No changes detected
- **WHEN** no source files have changed since last build
- **THEN** the system reports "No changes detected" and exits early

### Requirement: Incremental Build Command
The system SHALL support an `--incremental` flag for partial rebuilds.

#### Scenario: Incremental flag
- **WHEN** user runs `ctx build --incremental`
- **THEN** the system uses the manifest to detect and compile only changed files

#### Scenario: Full build without flag
- **WHEN** user runs `ctx build` without `--incremental`
- **THEN** all sources are compiled regardless of manifest state

#### Scenario: Missing manifest
- **WHEN** `--incremental` is specified but manifest does not exist
- **THEN** the system performs a full build and creates the manifest

### Requirement: Manifest Integrity
The system SHALL handle corrupt or incompatible manifests gracefully.

#### Scenario: Corrupt manifest
- **WHEN** the manifest contains invalid JSON
- **THEN** the system warns and performs a full build

#### Scenario: Version mismatch
- **WHEN** the manifest version does not match the current tool version
- **THEN** the system warns and performs a full build

#### Scenario: Missing source file
- **WHEN** a file in the manifest no longer exists
- **THEN** its compiled outputs are deleted and the entry is removed

### Requirement: Deleted File Handling
The system SHALL clean up outputs when source files are deleted.

#### Scenario: Rule file deleted
- **WHEN** a previously compiled rule file no longer exists
- **THEN** its corresponding .mdc output file is deleted
- **AND** it is removed from aggregate outputs (CLAUDE.md, AGENTS.md)

#### Scenario: Manifest cleanup
- **WHEN** a source file is deleted
- **THEN** its entry is removed from the manifest

### Requirement: Atomic File Writes
The system SHALL use atomic write operations to prevent corrupt outputs.

#### Scenario: Atomic write process
- **WHEN** writing a compiled output file
- **THEN** the system:
  1. Writes to a temporary file (e.g., `CLAUDE.md.tmp.{pid}`)
  2. Renames the temporary file to the target path atomically
  3. Deletes any leftover temp files on error

#### Scenario: Multi-file transaction
- **WHEN** compilation produces multiple output files
- **THEN** the system writes all files atomically as a transaction:
  1. Write all files to temporary locations
  2. Rename all temp files to targets in sequence
  3. On any failure, clean up all temp files (rollback)

#### Scenario: Interrupted write recovery
- **WHEN** a previous build was interrupted (temp files exist)
- **THEN** the system cleans up stale temp files before starting

#### Scenario: Manifest atomic update
- **WHEN** updating the build manifest
- **THEN** the manifest is also written atomically

### Requirement: Build Locking
The system SHALL prevent concurrent build operations.

#### Scenario: Lock acquisition
- **WHEN** a build starts
- **THEN** the system creates `.context/.build.lock` with:
  - Process ID (pid)
  - Timestamp (ISO 8601)
  - Hostname

#### Scenario: Lock already exists - active
- **WHEN** a build starts and lock file exists
- **AND** the lock is less than 5 minutes old
- **THEN** the build is aborted with error: "Another build is in progress"

#### Scenario: Lock already exists - stale
- **WHEN** a build starts and lock file exists
- **AND** the lock is more than 5 minutes old
- **THEN** the system removes the stale lock and acquires a new one

#### Scenario: Lock release
- **WHEN** a build completes (success or failure)
- **THEN** the lock file is removed

#### Scenario: Lock not released on crash
- **WHEN** the build process crashes without cleanup
- **THEN** the stale lock detection handles recovery

### Requirement: Build Failure Handling
The system SHALL handle build failures gracefully.

#### Scenario: Partial build failure
- **WHEN** compilation fails for one rule but others succeed
- **THEN** successful outputs are retained
- **AND** the manifest is updated with successful files only

#### Scenario: Complete build failure
- **WHEN** compilation fails before any output is written
- **THEN** no output files are modified
- **AND** the manifest is not updated

#### Scenario: Disk full error
- **WHEN** disk space is exhausted during write
- **THEN** the system reports clear error with disk space info

#### Scenario: Permission denied error
- **WHEN** the system cannot write to output directory
- **THEN** the system reports clear error with path and required permissions

## Testing Requirements

### Unit Tests

#### Build Manifest Tests
- [ ] Test manifest creation on first build
- [ ] Test manifest location is `.context/.build-manifest.json`
- [ ] Test manifest contains version, lastBuild, files
- [ ] Test file entry contains hash, mtime, compiledTo
- [ ] Test manifest is not committed (in .gitignore)

#### Change Detection Tests
- [ ] Test mtime unchanged skips hash check
- [ ] Test mtime changed triggers hash verification
- [ ] Test new file is detected as changed
- [ ] Test hash unchanged with mtime change updates manifest
- [ ] Test hash changed triggers recompilation
- [ ] Test SHA-256 hash format with prefix

#### Dependency Tracking Tests
- [ ] Test rule-to-rule dependencies are recorded
- [ ] Test cascading rebuild when dependency changes
- [ ] Test config.yaml change triggers full rebuild
- [ ] Test project.md change triggers CLAUDE.md/AGENTS.md rebuild
- [ ] Test architecture.md change triggers CLAUDE.md/AGENTS.md rebuild

#### Atomic Write Tests
- [ ] Test successful write creates target file
- [ ] Test interrupted write leaves no partial file
- [ ] Test temp file cleanup on error
- [ ] Test multi-file transaction commits all or none
- [ ] Test manifest is written atomically

#### Build Locking Tests
- [ ] Test lock file created on build start
- [ ] Test lock contains pid, timestamp, hostname
- [ ] Test active lock blocks new builds
- [ ] Test stale lock (>5 min) is removed
- [ ] Test lock is released on success
- [ ] Test lock is released on failure

### Integration Tests

#### Incremental Build Tests
- [ ] Test incremental build with single file change
- [ ] Test incremental build with no changes (early exit)
- [ ] Test full build ignores manifest
- [ ] Test missing manifest triggers full build
- [ ] Test corrupt manifest triggers full build with warning

#### Concurrent Build Tests
- [ ] Test two concurrent builds - second is blocked
- [ ] Test build after stale lock - proceeds after cleanup

### Performance Tests

#### Benchmark Tests
- [ ] Test incremental build with 1 changed file in 100 rule project
- [ ] Test change detection overhead (<100ms for 100 files)
- [ ] Test hash computation performance
