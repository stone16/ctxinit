import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

jest.mock('../../src/bootstrap', () => ({
  runEnhancedBootstrap: jest.fn().mockResolvedValue({
    success: true,
    analysis: {},
    filesWritten: [],
    errors: [],
    warnings: [],
  }),
}));

const { runInit } = require('../../src/cli/init') as typeof import('../../src/cli/init');
const { runEnhancedBootstrap } = require('../../src/bootstrap') as typeof import('../../src/bootstrap');

describe('Init Command (bootstrap)', () => {
  let tempDir: string;
  let originalCwd: string;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'init-bootstrap-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('runs enhanced bootstrap by default', async () => {
    const exitCode = await runInit({ interactive: false });
    expect(exitCode).toBe(0);

    expect(fs.existsSync(path.join(tempDir, '.context', 'config.yaml'))).toBe(true);
    expect(runEnhancedBootstrap).toHaveBeenCalledTimes(1);
    const projectRootArg = (runEnhancedBootstrap as unknown as jest.Mock).mock.calls[0][0] as string;
    expect(fs.realpathSync(projectRootArg)).toBe(fs.realpathSync(tempDir));
    expect((runEnhancedBootstrap as unknown as jest.Mock).mock.calls[0][1]).toMatchObject({ autoBuild: true });
  });

  it('skips enhanced bootstrap when bootstrap is false', async () => {
    const exitCode = await runInit({ interactive: false, bootstrap: false });
    expect(exitCode).toBe(0);

    expect(runEnhancedBootstrap).not.toHaveBeenCalled();
  });
});
