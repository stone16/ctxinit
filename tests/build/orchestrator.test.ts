import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  BuildOrchestrator,
  formatBuildResult,
  BuildResult,
} from '../../src/build/orchestrator';
import { Config } from '../../src/schemas/config';

describe('Build Orchestrator', () => {
  let tempDir: string;
  let rulesDir: string;
  let contextDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'orchestrator-test-'));
    contextDir = path.join(tempDir, '.context');
    rulesDir = path.join(contextDir, 'rules');

    // Create directory structure
    await fs.promises.mkdir(rulesDir, { recursive: true });

    // Create project.md
    await fs.promises.writeFile(
      path.join(contextDir, 'project.md'),
      '# Test Project\n\nA test project for build orchestration.'
    );

    // Create config.yaml
    await fs.promises.writeFile(
      path.join(contextDir, 'config.yaml'),
      `compile_target: claude
max_tokens: 4000
selection_strategy: priority
`
    );

    // Create sample rules
    await fs.promises.writeFile(
      path.join(rulesDir, 'rule1.md'),
      `---
id: test-rule-1
description: First test rule
priority: 80
tags: [testing]
---

# Rule 1

This is the first test rule.
`
    );

    await fs.promises.writeFile(
      path.join(rulesDir, 'rule2.md'),
      `---
id: test-rule-2
description: Second test rule
priority: 60
tags: [testing, code]
---

# Rule 2

This is the second test rule.
`
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('BuildOrchestrator', () => {
    it('should write outputs to projectRoot, not current working directory', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const otherDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'orchestrator-othercwd-'));
      const originalCwd = process.cwd();
      process.chdir(otherDir);

      try {
        const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
        const result = await orchestrator.build({
          projectRoot: tempDir,
          targets: ['claude'],
          force: true,
        });

        expect(result.success).toBe(true);
        expect(await fs.promises.access(path.join(tempDir, 'CLAUDE.md')).then(() => true).catch(() => false)).toBe(true);
        expect(await fs.promises.access(path.join(otherDir, 'CLAUDE.md')).then(() => true).catch(() => false)).toBe(false);
      } finally {
        process.chdir(originalCwd);
        await fs.promises.rm(otherDir, { recursive: true, force: true });
      }
    });

    it('should not rewrite outputs when only metadata would change', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });

      // First build
      let result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      });
      expect(result.success).toBe(true);

      const outputPath = path.join(tempDir, 'CLAUDE.md');
      const firstContent = await fs.promises.readFile(outputPath, 'utf-8');

      // Second build forces compilation, but should not rewrite the file if the "real" content is unchanged
      result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      });
      expect(result.success).toBe(true);

      const secondContent = await fs.promises.readFile(outputPath, 'utf-8');
      expect(secondContent).toBe(firstContent);
    });

    it('should build requested targets even when incremental and sources are unchanged', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
          cursor: {
            strategy: 'all',
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });

      // Initial build only for claude (creates a manifest without cursor outputs)
      let result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      });
      expect(result.success).toBe(true);
      expect(await fs.promises.access(path.join(tempDir, 'CLAUDE.md')).then(() => true).catch(() => false)).toBe(true);

      // Incremental build for cursor only should still run (even if sources unchanged)
      result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['cursor'],
        force: false,
      });
      expect(result.success).toBe(true);

      const cursorDir = path.join(tempDir, '.cursor', 'rules');
      expect(await fs.promises.access(cursorDir).then(() => true).catch(() => false)).toBe(true);
      const files = await fs.promises.readdir(cursorDir);
      expect(files.some((f) => f.endsWith('.mdc'))).toBe(true);
    });

    it('should self-heal when compiled outputs drift but sources do not', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });

      // First build
      let result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      });
      expect(result.success).toBe(true);

      // Tamper with CLAUDE.md directly (sources unchanged)
      const claudePath = path.join(tempDir, 'CLAUDE.md');
      const original = await fs.promises.readFile(claudePath, 'utf-8');
      await fs.promises.writeFile(claudePath, original + '\n\nTAMPERED\n', 'utf-8');

      // Incremental build should detect drift and regenerate outputs
      result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: false,
      });
      expect(result.success).toBe(true);

      const healed = await fs.promises.readFile(claudePath, 'utf-8');
      expect(healed).not.toContain('TAMPERED');
    });

    it('should execute full build pipeline', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      const result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });

      expect(result.success).toBe(true);
      expect(result.stats.rulesProcessed).toBe(2);
      expect(result.stats.filesGenerated).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should create CLAUDE.md for claude target', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });

      const claudeMdPath = path.join(tempDir, 'CLAUDE.md');
      const exists = await fs.promises.access(claudeMdPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.promises.readFile(claudeMdPath, 'utf-8');
      expect(content).toContain('Test Project');
      expect(content).toContain('Rule 1');
    });

    it('should create AGENTS.md for agents target', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          agents: {
            max_tokens: 10000,
            strategy: 'all',
            include_dirs: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['agents'],
      });

      const agentsMdPath = path.join(tempDir, 'AGENTS.md');
      const exists = await fs.promises.access(agentsMdPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create .mdc files for cursor target', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          cursor: {
            strategy: 'all',
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['cursor'],
      });

      const cursorDir = path.join(tempDir, '.cursor', 'rules');
      const exists = await fs.promises.access(cursorDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const files = await fs.promises.readdir(cursorDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.endsWith('.mdc'))).toBe(true);
    });

    it('should update build manifest after successful build', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });

      const manifestPath = path.join(contextDir, '.build-manifest.json');
      const exists = await fs.promises.access(manifestPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.promises.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      expect(manifest.version).toBe('1.0');
      expect(manifest.lastBuildTime).toBeGreaterThan(0);
    });

    it('should detect incremental changes', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });

      // First build
      const result1 = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });
      expect(result1.success).toBe(true);
      expect(result1.stats.incremental).toBe(false);

      // Second build without changes
      const result2 = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });
      expect(result2.success).toBe(true);
      expect(result2.stats.incremental).toBe(true);
      expect(result2.stats.rulesChanged).toBe(0);
    });

    it('should rebuild when rule changes', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });

      // First build
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });

      // Modify a rule
      await fs.promises.writeFile(
        path.join(rulesDir, 'rule1.md'),
        `---
id: test-rule-1
description: Modified test rule
priority: 80
---

# Rule 1 Modified

This rule was modified.
`
      );

      // Second build should detect change
      const result2 = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });
      expect(result2.success).toBe(true);
      expect(result2.stats.incremental).toBe(true);
      expect(result2.stats.rulesChanged).toBeGreaterThan(0);
    });

    it('should force full rebuild with force option', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });

      // First build
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });

      // Force rebuild
      const result2 = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
      });
      expect(result2.success).toBe(true);
      expect(result2.stats.incremental).toBe(false);
    });

    it('should handle validation errors', async () => {
      // Create a rule with invalid frontmatter
      await fs.promises.writeFile(
        path.join(rulesDir, 'invalid.md'),
        `---
description: Missing required id field
---

# Invalid Rule

This rule is missing the required id field.
`
      );

      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      const result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
      });

      // Build should fail due to validation error
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip validation when option set', async () => {
      // Create a rule with duplicate ID (which would fail static analysis)
      await fs.promises.writeFile(
        path.join(rulesDir, 'duplicate.md'),
        `---
id: test-rule-1
description: This rule has a duplicate ID with rule1.md
priority: 50
---

# Duplicate Rule

This rule has the same ID as rule1.md.
`
      );

      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      const result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        skipValidation: true,
      });

      // With skipValidation, the duplicate ID won't cause a validation error
      // Build should succeed because static analysis is skipped
      expect(result.success).toBe(true);
      expect(result.stats.rulesProcessed).toBe(3); // rule1, rule2, duplicate
    });

    it('should build multiple targets', async () => {
      const config: Config = {
        version: '1.0',
        compile: {
          claude: {
            max_tokens: 4000,
            strategy: 'priority',
            always_include: [],
          },
          agents: {
            max_tokens: 8000,
            strategy: 'priority',
            include_dirs: [],
          },
        },
        conflict_resolution: { strategy: 'priority_wins' },
      };

      const orchestrator = new BuildOrchestrator(tempDir, config, { quiet: true });
      const result = await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude', 'agents'],
      });

      expect(result.success).toBe(true);
      expect(result.compilations.size).toBe(2);
      expect(result.stats.targets).toContain('claude');
      expect(result.stats.targets).toContain('agents');
    });
  });

  describe('formatBuildResult', () => {
    it('should format successful build result', () => {
      const result: BuildResult = {
        success: true,
        stats: {
          duration: 1234,
          rulesProcessed: 10,
          rulesChanged: 5,
          filesGenerated: 3,
          totalTokens: 5000,
          incremental: true,
          targets: ['claude', 'agents'],
        },
        compilations: new Map(),
        errors: [],
        warnings: [],
      };

      const formatted = formatBuildResult(result);

      expect(formatted).toContain('✅ Build completed successfully');
      expect(formatted).toContain('Duration: 1234ms');
      expect(formatted).toContain('Rules processed: 10');
      expect(formatted).toContain('Rules changed: 5');
      expect(formatted).toContain('Files generated: 3');
      expect(formatted).toContain('Total tokens: 5000');
      expect(formatted).toContain('claude, agents');
    });

    it('should format failed build result', () => {
      const result: BuildResult = {
        success: false,
        stats: {
          duration: 500,
          rulesProcessed: 5,
          rulesChanged: 0,
          filesGenerated: 0,
          totalTokens: 0,
          incremental: false,
          targets: ['claude'],
        },
        compilations: new Map(),
        errors: ['Validation failed: Missing id', 'Parse error in rule.md'],
        warnings: ['Token budget exceeded'],
      };

      const formatted = formatBuildResult(result);

      expect(formatted).toContain('❌ Build failed');
      expect(formatted).toContain('Errors:');
      expect(formatted).toContain('Validation failed: Missing id');
      expect(formatted).toContain('Warnings:');
      expect(formatted).toContain('Token budget exceeded');
    });
  });
});
