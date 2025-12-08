/**
 * Git Hooks Generator
 *
 * Generates pre-commit hook scripts for ctx integration.
 */

/**
 * Pre-commit hook options
 */
export interface PreCommitOptions {
  /** Use incremental build (default: true) */
  incremental?: boolean;
  /** Auto-stage compiled outputs (default: true) */
  autoStage?: boolean;
  /** Skip validation (not recommended) */
  skipValidation?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Quiet output */
  quiet?: boolean;
}

/**
 * Generate pre-commit hook script content
 */
export function generatePreCommitHook(options: PreCommitOptions = {}): string {
  const {
    incremental = true,
    autoStage = true,
    skipValidation = false,
    verbose = false,
    quiet = false,
  } = options;

  // Build the ctx command
  const cmdParts = ['npx ctx build'];
  if (incremental) cmdParts.push('--incremental');
  if (skipValidation) cmdParts.push('--skip-validation');
  if (verbose) cmdParts.push('--verbose');
  if (quiet) cmdParts.push('--quiet');

  const ctxCommand = cmdParts.join(' ');

  // Generate the hook script
  const script = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# ctx pre-commit hook
# Automatically builds context files and stages them for commit

# Run ctx build
${ctxCommand}
BUILD_EXIT_CODE=$?

# Check if build succeeded
if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ ctx build failed with exit code $BUILD_EXIT_CODE"
  echo ""
  if [ $BUILD_EXIT_CODE -eq 1 ]; then
    echo "   Validation errors found. Fix the issues above and try again."
  elif [ $BUILD_EXIT_CODE -eq 2 ]; then
    echo "   Runtime error occurred. Check the error message above."
  fi
  echo ""
  exit $BUILD_EXIT_CODE
fi

${
  autoStage
    ? `# Stage compiled outputs
OUTPUTS_TO_STAGE=""

# Check for CLAUDE.md
if [ -f "CLAUDE.md" ]; then
  OUTPUTS_TO_STAGE="$OUTPUTS_TO_STAGE CLAUDE.md"
fi

# Check for AGENTS.md
if [ -f "AGENTS.md" ]; then
  OUTPUTS_TO_STAGE="$OUTPUTS_TO_STAGE AGENTS.md"
fi

# Check for .cursor/rules/*.mdc files
if [ -d ".cursor/rules" ]; then
  MDC_FILES=$(find .cursor/rules -name "*.mdc" 2>/dev/null)
  if [ -n "$MDC_FILES" ]; then
    OUTPUTS_TO_STAGE="$OUTPUTS_TO_STAGE $MDC_FILES"
  fi
fi

# Stage the files if any exist
if [ -n "$OUTPUTS_TO_STAGE" ]; then
  git add $OUTPUTS_TO_STAGE
  ${!quiet ? 'echo "✅ Staged compiled context files"' : ''}
fi`
    : '# Auto-staging disabled'
}

exit 0
`;

  return script;
}

/**
 * Generate a minimal pre-commit hook (without husky.sh sourcing)
 * For use in non-husky setups
 */
export function generateStandalonePreCommitHook(options: PreCommitOptions = {}): string {
  const {
    incremental = true,
    autoStage = true,
    skipValidation = false,
    verbose = false,
    quiet = false,
  } = options;

  // Build the ctx command
  const cmdParts = ['npx ctx build'];
  if (incremental) cmdParts.push('--incremental');
  if (skipValidation) cmdParts.push('--skip-validation');
  if (verbose) cmdParts.push('--verbose');
  if (quiet) cmdParts.push('--quiet');

  const ctxCommand = cmdParts.join(' ');

  const script = `#!/bin/sh
# ctx pre-commit hook (standalone)

# Run ctx build
${ctxCommand}
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "❌ ctx build failed"
  exit $BUILD_EXIT_CODE
fi

${
  autoStage
    ? `# Stage outputs
[ -f "CLAUDE.md" ] && git add CLAUDE.md
[ -f "AGENTS.md" ] && git add AGENTS.md
[ -d ".cursor/rules" ] && git add .cursor/rules/*.mdc 2>/dev/null`
    : ''
}

exit 0
`;

  return script;
}

/**
 * Get the list of files that will be auto-staged
 */
export function getAutoStagedFiles(): string[] {
  return ['CLAUDE.md', 'AGENTS.md', '.cursor/rules/*.mdc'];
}
