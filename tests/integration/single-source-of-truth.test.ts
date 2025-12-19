import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runInit } from '../../src/cli/init';
import { runBuild } from '../../src/cli/build';
import { runVerify } from '../../src/cli/verify';

function writeRule(rulesDir: string, fileName: string, rule: { id: string; description?: string; content: string }) {
  const frontmatter = [
    '---',
    `id: ${rule.id}`,
    rule.description ? `description: ${rule.description}` : '',
    'priority: 50',
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(path.join(rulesDir, fileName), `${frontmatter}\n\n${rule.content}\n`, 'utf-8');
}

describe('Single source of truth workflows', () => {
  let tempDir: string;
  let originalCwd: string;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-sot-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('new repo: init → build → check → incremental rebuild', async () => {
    const initExit = await runInit({ interactive: false, bootstrap: false });
    expect(initExit).toBe(0);

    const rulesDir = path.join(tempDir, '.context', 'rules');
    writeRule(rulesDir, 'rule-a.md', { id: 'rule-a', description: 'Rule A', content: '# Rule A\n\nApplies everywhere.' });

    let exitCode = await runBuild({ quiet: true, force: true });
    expect(exitCode).toBe(0);

    exitCode = await runBuild({ quiet: true, check: true });
    expect(exitCode).toBe(0);

    // Change a source-of-truth file: outputs should be out of date until rebuilt
    fs.writeFileSync(path.join(tempDir, '.context', 'project.md'), '# Changed Project\n\nUpdated.', 'utf-8');

    exitCode = await runBuild({ quiet: true, check: true });
    expect(exitCode).toBe(1);

    // Incremental build should detect project.md change
    exitCode = await runBuild({ quiet: true, incremental: true });
    expect(exitCode).toBe(0);

    exitCode = await runBuild({ quiet: true, check: true });
    expect(exitCode).toBe(0);

    const verifyExit = await runVerify({ json: true });
    expect(verifyExit).toBe(0);
  });

  it('existing repo: verify can pass while check fails (source drift)', async () => {
    const initExit = await runInit({ interactive: false, bootstrap: false });
    expect(initExit).toBe(0);

    const rulesDir = path.join(tempDir, '.context', 'rules');
    writeRule(rulesDir, 'rule-a.md', { id: 'rule-a', content: '# Rule A\n\nV1.' });

    let exitCode = await runBuild({ quiet: true, force: true });
    expect(exitCode).toBe(0);

    // Outputs exist and checksums should verify
    let verifyExit = await runVerify({ json: true });
    expect(verifyExit).toBe(0);

    // Drift the source-of-truth without touching outputs: verify still passes, but check must fail
    fs.writeFileSync(path.join(tempDir, '.context', 'project.md'), '# Drifted\n\nSource changed.', 'utf-8');

    verifyExit = await runVerify({ json: true });
    expect(verifyExit).toBe(0);

    exitCode = await runBuild({ quiet: true, check: true });
    expect(exitCode).toBe(1);
  });

  it('existing repo: cursor stale generated outputs are removed after build', async () => {
    const initExit = await runInit({ interactive: false, bootstrap: false });
    expect(initExit).toBe(0);

    const rulesDir = path.join(tempDir, '.context', 'rules');
    writeRule(rulesDir, 'alpha.md', { id: 'alpha', content: '# Alpha\n\nFirst.' });
    writeRule(rulesDir, 'beta.md', { id: 'beta', content: '# Beta\n\nSecond.' });

    let exitCode = await runBuild({ quiet: true, target: ['cursor'], force: true });
    expect(exitCode).toBe(0);

    const alphaMdc = path.join(tempDir, '.cursor', 'rules', 'alpha.mdc');
    const betaMdc = path.join(tempDir, '.cursor', 'rules', 'beta.mdc');
    expect(fs.existsSync(alphaMdc)).toBe(true);
    expect(fs.existsSync(betaMdc)).toBe(true);

    // Remove a rule source: old generated .mdc should be cleaned up
    fs.rmSync(path.join(rulesDir, 'beta.md'));

    exitCode = await runBuild({ quiet: true, target: ['cursor'], incremental: true });
    expect(exitCode).toBe(0);

    expect(fs.existsSync(alphaMdc)).toBe(true);
    expect(fs.existsSync(betaMdc)).toBe(false);

    exitCode = await runBuild({ quiet: true, target: ['cursor'], check: true });
    expect(exitCode).toBe(0);
  });
});
