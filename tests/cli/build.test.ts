import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runBuild } from '../../src/cli/build';

describe('Build Command', () => {
  let tempDir: string;
  let contextDir: string;
  let rulesDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'build-test-'));
    contextDir = path.join(tempDir, '.context');
    rulesDir = path.join(contextDir, 'rules');
    originalCwd = process.cwd();

    // Create directory structure
    await fs.promises.mkdir(rulesDir, { recursive: true });

    // Create config.yaml
    await fs.promises.writeFile(
      path.join(contextDir, 'config.yaml'),
      `version: '1.0'
compile:
  claude:
    max_tokens: 4000
    strategy: priority
`
    );

    // Create project.md
    await fs.promises.writeFile(
      path.join(contextDir, 'project.md'),
      '# Test Project\n\nA test project.'
    );

    // Change to temp directory
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('should build successfully with valid rules', async () => {
    // Create valid rule
    await fs.promises.writeFile(
      path.join(rulesDir, 'valid.md'),
      `---
id: valid-rule
description: A valid test rule
priority: 50
---

# Valid Rule

This is valid content.
`
    );

    const exitCode = await runBuild({ quiet: true });
    expect(exitCode).toBe(0);

    // Verify CLAUDE.md was created
    const claudeMdPath = path.join(tempDir, 'CLAUDE.md');
    expect(fs.existsSync(claudeMdPath)).toBe(true);
  });

  it('should fail build for invalid rules', async () => {
    // Create rule with missing ID
    await fs.promises.writeFile(
      path.join(rulesDir, 'invalid.md'),
      `---
description: Missing required id field
---

# Invalid Rule
`
    );

    const exitCode = await runBuild({ quiet: true });
    expect(exitCode).toBe(1);
  });

  it('should report error when .context directory not found', async () => {
    // Remove .context directory
    await fs.promises.rm(contextDir, { recursive: true, force: true });

    const exitCode = await runBuild({ quiet: true });
    expect(exitCode).toBe(2);
  });

  it('should build specific targets', async () => {
    // Update config for multiple targets
    await fs.promises.writeFile(
      path.join(contextDir, 'config.yaml'),
      `version: '1.0'
compile:
  claude:
    max_tokens: 4000
    strategy: priority
  cursor:
    strategy: all
`
    );

    // Create valid rule
    await fs.promises.writeFile(
      path.join(rulesDir, 'valid.md'),
      `---
id: valid-rule
description: A valid test rule
---

# Valid Rule
`
    );

    // Build only claude target
    const exitCode = await runBuild({
      quiet: true,
      target: ['claude'],
    });
    expect(exitCode).toBe(0);

    // CLAUDE.md should exist
    expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
  });

  it('should reject invalid targets', async () => {
    await fs.promises.writeFile(
      path.join(rulesDir, 'valid.md'),
      `---
id: valid-rule
description: A valid test rule
---

# Valid Rule
`
    );

    const exitCode = await runBuild({
      quiet: true,
      target: ['invalid-target'],
    });
    expect(exitCode).toBe(2);
  });

  it('should perform incremental builds', async () => {
    // Create valid rule
    await fs.promises.writeFile(
      path.join(rulesDir, 'valid.md'),
      `---
id: valid-rule
description: A valid test rule
---

# Valid Rule
`
    );

    // First build
    let exitCode = await runBuild({ quiet: true });
    expect(exitCode).toBe(0);

    // Second build with incremental flag
    exitCode = await runBuild({ quiet: true, incremental: true });
    expect(exitCode).toBe(0);
  });

  it('should force full rebuild', async () => {
    // Create valid rule
    await fs.promises.writeFile(
      path.join(rulesDir, 'valid.md'),
      `---
id: valid-rule
description: A valid test rule
---

# Valid Rule
`
    );

    // First build
    let exitCode = await runBuild({ quiet: true });
    expect(exitCode).toBe(0);

    // Force rebuild
    exitCode = await runBuild({ quiet: true, force: true });
    expect(exitCode).toBe(0);
  });

  it('should skip validation when flag is set', async () => {
    // Create two rules with duplicate IDs (would fail validation)
    await fs.promises.writeFile(
      path.join(rulesDir, 'rule1.md'),
      `---
id: duplicate-id
description: First rule
---

# Rule 1
`
    );

    await fs.promises.writeFile(
      path.join(rulesDir, 'rule2.md'),
      `---
id: duplicate-id
description: Second rule
---

# Rule 2
`
    );

    // Should pass with skip-validation
    const exitCode = await runBuild({
      quiet: true,
      skipValidation: true,
    });
    expect(exitCode).toBe(0);
  });
});
