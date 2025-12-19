import { generatePreCommitHook, generateStandalonePreCommitHook } from '../../src/git/hooks';

describe('Pre-commit Hook Generation', () => {
  describe('generatePreCommitHook', () => {
    it('should generate hook with incremental build by default', () => {
      const hook = generatePreCommitHook({ incremental: true });

      expect(hook).toContain('ctx build --incremental');
    });

    it('should generate hook with full build when incremental is false', () => {
      const hook = generatePreCommitHook({ incremental: false });

      expect(hook).toContain('ctx build');
      expect(hook).not.toContain('--incremental');
    });

    it('should include auto-stage commands when autoStage is true', () => {
      const hook = generatePreCommitHook({ autoStage: true });

      expect(hook).toContain('CLAUDE.md');
      expect(hook).toContain('AGENTS.md');
      expect(hook).toContain('.cursor/rules');
      expect(hook).toContain('git add -A');
    });

    it('should not include auto-stage when autoStage is false', () => {
      const hook = generatePreCommitHook({ autoStage: false });

      expect(hook).not.toContain('git add -A "CLAUDE.md"');
    });

    it('should include verbose flag when verbose is true', () => {
      const hook = generatePreCommitHook({ verbose: true });

      expect(hook).toContain('--verbose');
    });

    it('should include quiet flag when quiet is true', () => {
      const hook = generatePreCommitHook({ quiet: true });

      expect(hook).toContain('--quiet');
    });

    it('should include skip-validation flag when skipValidation is true', () => {
      const hook = generatePreCommitHook({ skipValidation: true });

      expect(hook).toContain('--skip-validation');
    });

    it('should include ctx comment marker', () => {
      const hook = generatePreCommitHook({});

      expect(hook).toContain('# ctx pre-commit');
    });

    it('should handle exit codes correctly', () => {
      const hook = generatePreCommitHook({});

      expect(hook).toContain('exit $BUILD_EXIT_CODE');
      expect(hook).toContain('exit 0');
    });
  });

  describe('generateStandalonePreCommitHook', () => {
    it('should generate shebang line', () => {
      const hook = generateStandalonePreCommitHook({});

      expect(hook).toMatch(/^#!/);
      expect(hook).toContain('/bin/sh');
    });

    it('should include ctx pre-commit section', () => {
      const hook = generateStandalonePreCommitHook({ incremental: true });

      expect(hook).toContain('# ctx pre-commit');
      expect(hook).toContain('ctx build');
    });

    it('should be a complete script with proper structure', () => {
      const hook = generateStandalonePreCommitHook({
        incremental: true,
        autoStage: true,
      });

      // Should start with shebang
      expect(hook.startsWith('#!/')).toBe(true);

      // Should have ctx build command
      expect(hook).toContain('ctx build --incremental');

      // Should have auto-stage commands
      expect(hook).toContain('git add -A');
    });
  });

  describe('option combinations', () => {
    it('should handle all options enabled', () => {
      const hook = generatePreCommitHook({
        incremental: true,
        autoStage: true,
        verbose: true,
        skipValidation: false,
        quiet: false,
      });

      expect(hook).toContain('--incremental');
      expect(hook).toContain('--verbose');
      expect(hook).toContain('git add -A');
    });

    it('should handle conflicting options (verbose and quiet)', () => {
      const hook = generatePreCommitHook({
        verbose: true,
        quiet: true,
      });

      // Both flags should be present - let ctx build handle the conflict
      expect(hook).toContain('--verbose');
      expect(hook).toContain('--quiet');
    });

    it('should handle minimal options', () => {
      const hook = generatePreCommitHook({});

      // Should have basic ctx build command
      expect(hook).toContain('ctx build');
      expect(hook).toContain('# ctx pre-commit');
    });
  });
});
