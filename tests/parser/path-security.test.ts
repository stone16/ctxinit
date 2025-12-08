import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  validatePath,
  validateSymlink,
  isPathSafe,
  sanitizePath,
  PathSecurityError,
} from '../../src/parser/path-security';

describe('Path Security', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-security-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('validatePath', () => {
    describe('path traversal protection', () => {
      it('should reject parent directory references', () => {
        expect(() => validatePath('../outside', tempDir)).toThrow(PathSecurityError);
        expect(() => validatePath('foo/../../../etc/passwd', tempDir)).toThrow(PathSecurityError);
        expect(() => validatePath('rules/../../outside', tempDir)).toThrow(PathSecurityError);
      });

      it('should reject URL-encoded traversal', () => {
        expect(() => validatePath('foo%2f..%2fbar', tempDir)).toThrow(PathSecurityError);
        expect(() => validatePath('foo%2F..%2Fbar', tempDir)).toThrow(PathSecurityError);
      });

      it('should reject double-encoded traversal', () => {
        expect(() => validatePath('foo%252f..%252fbar', tempDir)).toThrow(PathSecurityError);
      });

      it('should have correct error type', () => {
        try {
          validatePath('../outside', tempDir);
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(PathSecurityError);
          expect((error as PathSecurityError).type).toBe('traversal');
        }
      });
    });

    describe('absolute path protection', () => {
      it('should reject Unix absolute paths', () => {
        expect(() => validatePath('/etc/passwd', tempDir)).toThrow(PathSecurityError);
        expect(() => validatePath('/tmp/file.md', tempDir)).toThrow(PathSecurityError);
      });

      it('should reject Windows absolute paths', () => {
        expect(() => validatePath('C:\\Windows\\System32', tempDir)).toThrow(PathSecurityError);
        expect(() => validatePath('C:/Users/test', tempDir)).toThrow(PathSecurityError);
        expect(() => validatePath('\\\\server\\share', tempDir)).toThrow(PathSecurityError);
      });

      it('should have correct error type', () => {
        try {
          validatePath('/etc/passwd', tempDir);
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(PathSecurityError);
          expect((error as PathSecurityError).type).toBe('absolute');
        }
      });
    });

    describe('null byte protection', () => {
      it('should reject null bytes', () => {
        expect(() => validatePath('file\0.md', tempDir)).toThrow(PathSecurityError);
        expect(() => validatePath('file%00.md', tempDir)).toThrow(PathSecurityError);
      });

      it('should have correct error type', () => {
        try {
          validatePath('file\0.md', tempDir);
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(PathSecurityError);
          expect((error as PathSecurityError).type).toBe('null_byte');
        }
      });
    });

    describe('valid paths', () => {
      it('should accept simple relative paths', () => {
        expect(() => validatePath('rules/my-rule.md', tempDir)).not.toThrow();
        expect(() => validatePath('backend/auth.md', tempDir)).not.toThrow();
      });

      it('should accept nested paths', () => {
        expect(() => validatePath('api/v2/handlers/users.md', tempDir)).not.toThrow();
      });

      it('should accept paths with dots in filenames', () => {
        expect(() => validatePath('rules/config.test.md', tempDir)).not.toThrow();
      });
    });
  });

  describe('validateSymlink', () => {
    it('should allow symlinks within project', () => {
      // Create a file and symlink to it
      const targetDir = path.join(tempDir, 'target');
      fs.mkdirSync(targetDir);
      const targetFile = path.join(targetDir, 'file.md');
      fs.writeFileSync(targetFile, 'content');

      const linkPath = path.join(tempDir, 'link.md');
      fs.symlinkSync(targetFile, linkPath);

      expect(() => validateSymlink('link.md', tempDir)).not.toThrow();
    });

    it('should reject symlinks outside project', () => {
      // Create a symlink pointing outside project
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
      const outsideFile = path.join(outsideDir, 'secret.md');
      fs.writeFileSync(outsideFile, 'secret content');

      const linkPath = path.join(tempDir, 'evil-link.md');
      fs.symlinkSync(outsideFile, linkPath);

      expect(() => validateSymlink('evil-link.md', tempDir)).toThrow(PathSecurityError);

      // Cleanup
      fs.rmSync(outsideDir, { recursive: true, force: true });
    });

    it('should handle non-existent files gracefully', () => {
      expect(() => validateSymlink('nonexistent.md', tempDir)).not.toThrow();
    });

    it('should handle non-symlink files', () => {
      const filePath = path.join(tempDir, 'regular.md');
      fs.writeFileSync(filePath, 'content');
      expect(() => validateSymlink('regular.md', tempDir)).not.toThrow();
    });
  });

  describe('isPathSafe', () => {
    it('should return true for safe paths', () => {
      expect(isPathSafe('rules/my-rule.md', tempDir)).toBe(true);
      expect(isPathSafe('nested/path/file.md', tempDir)).toBe(true);
    });

    it('should return false for unsafe paths', () => {
      expect(isPathSafe('../outside', tempDir)).toBe(false);
      expect(isPathSafe('/etc/passwd', tempDir)).toBe(false);
      expect(isPathSafe('file\0.md', tempDir)).toBe(false);
    });
  });

  describe('sanitizePath', () => {
    it('should remove null bytes', () => {
      expect(sanitizePath('file\0.md')).toBe('file.md');
      expect(sanitizePath('file%00.md')).toBe('file.md');
    });

    it('should decode URL-encoded slashes', () => {
      expect(sanitizePath('path%2fto%2ffile')).toBe('path/to/file');
    });

    it('should remove parent directory references', () => {
      // After removing '..' and normalizing slashes, foo/../bar becomes foo/bar
      expect(sanitizePath('foo/../bar')).toBe('foo/bar');
    });

    it('should normalize multiple slashes', () => {
      expect(sanitizePath('path//to///file')).toBe('path/to/file');
    });

    it('should remove leading slashes', () => {
      expect(sanitizePath('/path/to/file')).toBe('path/to/file');
    });
  });
});

describe('PathSecurityError', () => {
  it('should have correct name', () => {
    const error = new PathSecurityError('test', 'traversal');
    expect(error.name).toBe('PathSecurityError');
  });

  it('should store error type', () => {
    const traversalError = new PathSecurityError('test', 'traversal');
    expect(traversalError.type).toBe('traversal');

    const absoluteError = new PathSecurityError('test', 'absolute');
    expect(absoluteError.type).toBe('absolute');

    const nullByteError = new PathSecurityError('test', 'null_byte');
    expect(nullByteError.type).toBe('null_byte');
  });
});
