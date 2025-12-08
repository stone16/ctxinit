import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  calculateHash,
  calculateFileHash,
  createManifestEntry,
  createEmptyManifest,
  getManifestPath,
  readManifest,
  writeManifest,
  hasFileChanged,
  detectChanges,
  updateManifest,
  findAffectedOutputs,
  BuildManifest,
  ManifestEntry,
} from '../../src/build/manifest';

describe('Build Manifest', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'manifest-test-'));
    // Create .context directory
    await fs.promises.mkdir(path.join(tempDir, '.context'), { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash with prefix', () => {
      const hash = calculateHash('test content');
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for same content', () => {
      const hash1 = calculateHash('same content');
      const hash2 = calculateHash('same content');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = calculateHash('content A');
      const hash2 = calculateHash('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle Buffer input', () => {
      const hash = calculateHash(Buffer.from('buffer content'));
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should handle empty content', () => {
      const hash = calculateHash('');
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  describe('calculateFileHash', () => {
    it('should calculate hash of file content', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.promises.writeFile(filePath, 'file content');

      const hash = await calculateFileHash(filePath);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(hash).toBe(calculateHash('file content'));
    });
  });

  describe('createManifestEntry', () => {
    it('should create entry with hash, mtime, and size', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.promises.writeFile(filePath, 'test content');

      const entry = await createManifestEntry(filePath);

      expect(entry.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(typeof entry.mtime).toBe('number');
      expect(entry.mtime).toBeGreaterThan(0);
      expect(entry.size).toBe(12); // 'test content'.length
    });
  });

  describe('createEmptyManifest', () => {
    it('should create manifest with version and target', () => {
      const manifest = createEmptyManifest('claude');

      expect(manifest.version).toBe('1.0');
      expect(manifest.target).toBe('claude');
      expect(manifest.lastBuildTime).toBe(0);
      expect(manifest.sources).toEqual({});
      expect(manifest.configHash).toBe('');
      expect(manifest.outputs).toEqual([]);
    });
  });

  describe('getManifestPath', () => {
    it('should return path to .context/.build-manifest.json', () => {
      const manifestPath = getManifestPath('/project');
      expect(manifestPath).toBe('/project/.context/.build-manifest.json');
    });
  });

  describe('readManifest / writeManifest', () => {
    it('should write and read manifest', async () => {
      const manifest = createEmptyManifest('cursor');
      manifest.lastBuildTime = Date.now();
      manifest.configHash = 'sha256:abc123';

      await writeManifest(tempDir, manifest);
      const read = await readManifest(tempDir);

      expect(read).toEqual(manifest);
    });

    it('should return null for non-existent manifest', async () => {
      const read = await readManifest(tempDir);
      expect(read).toBeNull();
    });

    it('should return null for incompatible version', async () => {
      const manifestPath = getManifestPath(tempDir);
      const oldManifest = { version: '0.1', target: 'claude' };
      await fs.promises.writeFile(manifestPath, JSON.stringify(oldManifest));

      const read = await readManifest(tempDir);
      expect(read).toBeNull();
    });
  });

  describe('hasFileChanged', () => {
    it('should return true for new file (no entry)', async () => {
      const filePath = path.join(tempDir, 'new.txt');
      await fs.promises.writeFile(filePath, 'new content');

      const changed = await hasFileChanged(filePath, undefined);
      expect(changed).toBe(true);
    });

    it('should return false for unchanged file (same mtime and size)', async () => {
      const filePath = path.join(tempDir, 'unchanged.txt');
      await fs.promises.writeFile(filePath, 'content');

      const entry = await createManifestEntry(filePath);
      const changed = await hasFileChanged(filePath, entry);

      expect(changed).toBe(false);
    });

    it('should return true for modified file (different content)', async () => {
      const filePath = path.join(tempDir, 'modified.txt');
      await fs.promises.writeFile(filePath, 'original content here');

      const entry = await createManifestEntry(filePath);

      // Modify the file with different length content to ensure size change is detected
      await fs.promises.writeFile(filePath, 'modified');

      const changed = await hasFileChanged(filePath, entry);
      expect(changed).toBe(true);
    });

    it('should return true for deleted file', async () => {
      const entry: ManifestEntry = {
        hash: 'sha256:abc',
        mtime: Date.now(),
        size: 100,
      };

      const changed = await hasFileChanged('/nonexistent/file.txt', entry);
      expect(changed).toBe(true);
    });
  });

  describe('detectChanges', () => {
    it('should detect added files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      await fs.promises.writeFile(file1, 'content 1');
      await fs.promises.writeFile(file2, 'content 2');

      const manifest = createEmptyManifest('claude');
      manifest.sources['file1.txt'] = await createManifestEntry(file1);

      const changes = await detectChanges(tempDir, [file1, file2], manifest);

      expect(changes.added).toContain('file2.txt');
      expect(changes.unchanged).toContain('file1.txt');
      expect(changes.modified).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
    });

    it('should detect modified files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      await fs.promises.writeFile(file1, 'original content here');

      const manifest = createEmptyManifest('claude');
      manifest.sources['file1.txt'] = await createManifestEntry(file1);

      // Modify the file with different length content to ensure size change is detected
      await fs.promises.writeFile(file1, 'modified');

      const changes = await detectChanges(tempDir, [file1], manifest);

      expect(changes.modified).toContain('file1.txt');
      expect(changes.added).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
    });

    it('should detect removed files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      await fs.promises.writeFile(file1, 'content');

      const manifest = createEmptyManifest('claude');
      manifest.sources['file1.txt'] = await createManifestEntry(file1);
      manifest.sources['file2.txt'] = {
        hash: 'sha256:abc',
        mtime: Date.now(),
        size: 100,
      };

      const changes = await detectChanges(tempDir, [file1], manifest);

      expect(changes.removed).toContain('file2.txt');
      expect(changes.unchanged).toContain('file1.txt');
    });
  });

  describe('updateManifest', () => {
    it('should create manifest with file entries', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      await fs.promises.writeFile(file1, 'content 1');
      await fs.promises.writeFile(file2, 'content 2');

      const outputs = [
        { outputPath: 'CLAUDE.md', sourceRules: ['file1.txt', 'file2.txt'], generatedAt: Date.now() },
      ];

      const manifest = await updateManifest(
        tempDir,
        [file1, file2],
        'claude',
        outputs,
        'sha256:config'
      );

      expect(manifest.version).toBe('1.0');
      expect(manifest.target).toBe('claude');
      expect(manifest.configHash).toBe('sha256:config');
      expect(manifest.lastBuildTime).toBeGreaterThan(0);
      expect(manifest.sources['file1.txt']).toBeDefined();
      expect(manifest.sources['file2.txt']).toBeDefined();
      expect(manifest.outputs).toEqual(outputs);
    });
  });

  describe('findAffectedOutputs', () => {
    it('should find outputs affected by changed files', () => {
      const manifest: BuildManifest = {
        version: '1.0',
        lastBuildTime: Date.now(),
        target: 'claude',
        sources: {},
        configHash: 'sha256:config',
        outputs: [
          { outputPath: 'CLAUDE.md', sourceRules: ['rule1.md', 'rule2.md'], generatedAt: Date.now() },
          { outputPath: 'AGENTS.md', sourceRules: ['rule2.md', 'rule3.md'], generatedAt: Date.now() },
        ],
      };

      const affected = findAffectedOutputs(manifest, ['rule1.md']);
      expect(affected).toContain('CLAUDE.md');
      expect(affected).not.toContain('AGENTS.md');
    });

    it('should find multiple affected outputs', () => {
      const manifest: BuildManifest = {
        version: '1.0',
        lastBuildTime: Date.now(),
        target: 'all',
        sources: {},
        configHash: 'sha256:config',
        outputs: [
          { outputPath: 'CLAUDE.md', sourceRules: ['rule1.md', 'rule2.md'], generatedAt: Date.now() },
          { outputPath: 'AGENTS.md', sourceRules: ['rule2.md', 'rule3.md'], generatedAt: Date.now() },
        ],
      };

      const affected = findAffectedOutputs(manifest, ['rule2.md']);
      expect(affected).toContain('CLAUDE.md');
      expect(affected).toContain('AGENTS.md');
    });

    it('should return empty for no matches', () => {
      const manifest: BuildManifest = {
        version: '1.0',
        lastBuildTime: Date.now(),
        target: 'claude',
        sources: {},
        configHash: 'sha256:config',
        outputs: [
          { outputPath: 'CLAUDE.md', sourceRules: ['rule1.md'], generatedAt: Date.now() },
        ],
      };

      const affected = findAffectedOutputs(manifest, ['other.md']);
      expect(affected).toHaveLength(0);
    });
  });
});
