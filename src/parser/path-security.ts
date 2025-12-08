import * as fs from 'fs';
import * as path from 'path';

/**
 * Path security validation error
 */
export class PathSecurityError extends Error {
  constructor(
    message: string,
    public readonly type: 'traversal' | 'absolute' | 'encoded' | 'null_byte' | 'symlink'
  ) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Dangerous patterns that indicate path traversal attempts
 */
const TRAVERSAL_PATTERNS = [
  /\.\./,                    // Parent directory reference
  /\.\.%2[fF]/,              // URL-encoded ../
  /%2[fF]\.\./,              // URL-encoded /..
  /%252[fF]/,                // Double-encoded /
  /%00/,                     // Null byte (URL encoded)
  /\0/,                      // Null byte (literal)
];

/**
 * Check if a path contains traversal attempts
 */
function containsTraversalAttempt(filePath: string): boolean {
  return TRAVERSAL_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a path is absolute
 */
function isAbsolutePath(filePath: string): boolean {
  // Check for Windows-style paths (C:\ or \\)
  if (/^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')) {
    return true;
  }
  // Check for Unix-style absolute paths
  return path.isAbsolute(filePath);
}

/**
 * Check if a path contains null bytes
 */
function containsNullByte(filePath: string): boolean {
  return filePath.includes('\0') || /%00/i.test(filePath);
}

/**
 * Validate that a path is safe and within the project directory
 *
 * @param filePath - The file path to validate (relative to project root)
 * @param projectRoot - The project root directory
 * @throws PathSecurityError if the path is unsafe
 */
export function validatePath(filePath: string, projectRoot: string): void {
  // Check for null bytes first (most critical)
  if (containsNullByte(filePath)) {
    throw new PathSecurityError(
      `Path contains null byte: ${filePath}`,
      'null_byte'
    );
  }

  // Check for URL-encoded traversal patterns
  if (/%2[fF]/.test(filePath) || /%252[fF]/.test(filePath)) {
    throw new PathSecurityError(
      `Path contains URL-encoded characters: ${filePath}`,
      'encoded'
    );
  }

  // Check for absolute paths
  if (isAbsolutePath(filePath)) {
    throw new PathSecurityError(
      `Absolute paths are not allowed: ${filePath}`,
      'absolute'
    );
  }

  // Check for traversal attempts
  if (containsTraversalAttempt(filePath)) {
    throw new PathSecurityError(
      `Path traversal detected: ${filePath}`,
      'traversal'
    );
  }

  // Resolve the full path and verify it's within project
  const resolvedPath = path.resolve(projectRoot, filePath);
  const normalizedProject = path.normalize(projectRoot);

  if (!resolvedPath.startsWith(normalizedProject)) {
    throw new PathSecurityError(
      `Path escapes project directory: ${filePath}`,
      'traversal'
    );
  }
}

/**
 * Validate that a symlink target is within the project directory
 *
 * @param symlinkPath - The path to the symlink
 * @param projectRoot - The project root directory
 * @throws PathSecurityError if the symlink target is outside the project
 */
export function validateSymlink(symlinkPath: string, projectRoot: string): void {
  const fullPath = path.resolve(projectRoot, symlinkPath);

  try {
    const stats = fs.lstatSync(fullPath);
    if (!stats.isSymbolicLink()) {
      return; // Not a symlink, nothing to validate
    }

    // Get the real path (follows all symlinks)
    const realPath = fs.realpathSync(fullPath);
    // Also resolve the project root to handle macOS /var -> /private/var symlinks
    const realProjectRoot = fs.realpathSync(projectRoot);

    if (!realPath.startsWith(realProjectRoot)) {
      throw new PathSecurityError(
        `Symlink target is outside project: ${symlinkPath} -> ${realPath}`,
        'symlink'
      );
    }
  } catch (error) {
    if (error instanceof PathSecurityError) {
      throw error;
    }
    // File doesn't exist or can't be read - that's okay for validation
    // The actual file reading will fail later with a clearer error
  }
}

/**
 * Check if a path is safe (returns boolean instead of throwing)
 *
 * @param filePath - The file path to validate
 * @param projectRoot - The project root directory
 * @returns true if path is safe, false otherwise
 */
export function isPathSafe(filePath: string, projectRoot: string): boolean {
  try {
    validatePath(filePath, projectRoot);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a path by removing dangerous components
 * Note: This is for display purposes only - always use validatePath for security
 *
 * @param filePath - The file path to sanitize
 * @returns Sanitized path string
 */
export function sanitizePath(filePath: string): string {
  return filePath
    .replace(/\0/g, '')           // Remove null bytes
    .replace(/%00/gi, '')         // Remove encoded null bytes
    .replace(/%2[fF]/g, '/')      // Decode URL-encoded slashes
    .replace(/%252[fF]/g, '/')    // Decode double-encoded slashes
    .replace(/\.\./g, '')         // Remove parent references
    .replace(/\/+/g, '/')         // Normalize multiple slashes
    .replace(/^\//, '');          // Remove leading slash
}
